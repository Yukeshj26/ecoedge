import time
import json
import random
import threading
import requests
import paho.mqtt.client as mqtt
import matplotlib.pyplot as plt
import pandas as pd
import numpy as np
import os

# Configuration matching the project structure
MQTT_BROKER = "localhost"
MQTT_PORT = 1883
MQTT_TOPIC_RAW = "ecoedge/device01/telemetry"
MQTT_TOPIC_NORM = "ecoedge/normalized/device01"

INFLUX_URL = "http://127.0.0.1:8086"
INFLUX_TOKEN = "03VDOT3tpzwm7--nywROtKR0SPBpWTRZmPiVla6jw_5tgaP8syQQxARVt8d74OnGh0afh6Z85xgM1gRc6XF8lQ=="
INFLUX_ORG = "EcoEdge"
INFLUX_BUCKET = "telemetry"

FLASK_PROXY_URL = "http://127.0.0.1:5002/telemetry"
NEXTJS_LIVE_URL = "http://127.0.0.1:3000/api/telemetry"
NEXTJS_LATEST_URL = "http://127.0.0.1:3000/api/telemetry/latest"

# Thread-safe dictionaries to store timestamps recorded by MQTT listeners
mqtt_raw_timestamps = {}
mqtt_norm_timestamps = {}

# MQTT callback functions
def on_connect(client, userdata, flags, rc, properties=None):
    client.subscribe(MQTT_TOPIC_RAW)
    client.subscribe(MQTT_TOPIC_NORM)
    print("MQTT Benchmark Client Subscribed to topics.")

def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode())
        sent_at = payload.get("sent_at")
        if sent_at is not None:
            now = time.time()
            # If it's the raw topic
            if msg.topic == MQTT_TOPIC_RAW:
                mqtt_raw_timestamps[float(sent_at)] = now
            # If it's the normalized topic
            elif msg.topic == MQTT_TOPIC_NORM:
                mqtt_norm_timestamps[float(sent_at)] = now
    except Exception as e:
        pass

# Initialize and run MQTT listener thread
def start_mqtt_listener():
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1)
    client.on_connect = on_connect
    client.on_message = on_message
    client.connect(MQTT_BROKER, MQTT_PORT, 60)
    client.loop_start()
    return client

def query_influxdb_sent_ats():
    """Queries InfluxDB for all sent_at field values recorded in the last 5 minutes."""
    query = f'''
    from(bucket: "{INFLUX_BUCKET}")
      |> range(start: -5m)
      |> filter(fn: (r) => r._measurement == "ecoedge")
      |> filter(fn: (r) => r._field == "sent_at")
      |> keep(columns: ["_value"])
    '''
    headers = {
        "Authorization": f"Token {INFLUX_TOKEN}",
        "Content-Type": "application/vnd.flux",
        "Accept": "application/csv"
    }
    try:
        response = requests.post(f"{INFLUX_URL}/api/v2/query?org={INFLUX_ORG}", headers=headers, data=query, timeout=5)
        if response.status_code == 200:
            lines = response.text.strip().split('\n')
            sent_ats = []
            for line in lines:
                if line.startswith(','):
                    parts = line.split(',')
                    # Typically, the _value is the last or second to last column in CSV format
                    # Flux query returns: ,result,table,_value
                    # Let's clean and parse float
                    for part in parts:
                        try:
                            val = float(part)
                            # InfluxDB stores high-precision timestamp fields
                            # Let's filter values that look like our sent_at timestamps
                            if 1500000000 < val < 2000000000:
                                sent_ats.append(val)
                        except ValueError:
                            continue
            return set(sent_ats)
    except Exception as e:
        print(f"Error querying InfluxDB: {e}")
    return set()

def test_latency_performance(num_messages=50):
    print(f"\n--- Phase 1: Measuring Pipeline Latency ({num_messages} samples) ---")
    results = []
    
    for i in range(num_messages):
        # Construct message payload with a high-resolution timestamp
        sent_at = time.time()
        payload = {
            "temperature": round(random.uniform(22.0, 33.0), 2),
            "humidity": round(random.uniform(45.0, 75.0), 2),
            "relay": random.choice([0, 1]),
            "sent_at": sent_at
        }
        
        # Send HTTP POST to Flask proxy (simulating ESP32 post)
        try:
            t_post_start = time.time()
            post_resp = requests.post(FLASK_PROXY_URL, json=payload, timeout=2)
            t_post_end = time.time()
            post_latency = t_post_end - t_post_start
        except Exception as e:
            print(f"HTTP Post error: {e}")
            time.sleep(0.5)
            continue
            
        # Wait up to 3 seconds for it to bubble through the pipeline
        t_live_arrival = None
        t_influx_arrival = None
        
        limit_time = time.time() + 3.0
        while time.time() < limit_time:
            # Poll Next.js live endpoint
            if t_live_arrival is None:
                try:
                    resp = requests.get(NEXTJS_LIVE_URL, timeout=1)
                    if resp.status_code == 200:
                        data = resp.json()
                        # Verify if current telemetry in store has our sent_at
                        if abs(data.get("sent_at", 0) - sent_at) < 0.0001:
                            t_live_arrival = time.time()
                except Exception:
                    pass
            
            # Poll Next.js InfluxDB-backed latest endpoint
            if t_influx_arrival is None:
                try:
                    resp = requests.get(NEXTJS_LATEST_URL, timeout=1)
                    if resp.status_code == 200:
                        res = resp.json()
                        data = res.get("data", {})
                        if abs(data.get("sent_at", 0) - sent_at) < 0.0001:
                            t_influx_arrival = time.time()
                except Exception:
                    pass
                    
            if t_live_arrival is not None and t_influx_arrival is not None:
                break
                
            time.sleep(0.005) # Poll every 5ms
            
        # Retrieve MQTT-recorded timestamps from the background threads
        mqtt_raw_time = mqtt_raw_timestamps.get(sent_at)
        mqtt_norm_time = mqtt_norm_timestamps.get(sent_at)
        
        # Calculate latencies in milliseconds
        flask_latency_ms = post_latency * 1000.0
        
        mqtt_raw_latency_ms = ((mqtt_raw_time - sent_at) * 1000.0) if mqtt_raw_time else None
        mqtt_norm_latency_ms = ((mqtt_norm_time - sent_at) * 1000.0) if mqtt_norm_time else None
        
        nextjs_live_latency_ms = ((t_live_arrival - sent_at) * 1000.0) if t_live_arrival else None
        influx_db_latency_ms = ((t_influx_arrival - sent_at) * 1000.0) if t_influx_arrival else None
        
        print(f"Sample {i+1:02d} | Flask: {flask_latency_ms:5.1f}ms | Raw MQTT: {mqtt_raw_latency_ms if mqtt_raw_latency_ms else -1:5.1f}ms | Node-RED: {mqtt_norm_latency_ms if mqtt_norm_latency_ms else -1:5.1f}ms | Live Store: {nextjs_live_latency_ms if nextjs_live_latency_ms else -1:5.1f}ms | InfluxDB: {influx_db_latency_ms if influx_db_latency_ms else -1:5.1f}ms")
        
        results.append({
            "sent_at": sent_at,
            "flask_ms": flask_latency_ms,
            "mqtt_raw_ms": mqtt_raw_latency_ms,
            "mqtt_norm_ms": mqtt_norm_latency_ms,
            "live_store_ms": nextjs_live_latency_ms,
            "influxdb_ms": influx_db_latency_ms
        })
        
        # Add slight jitter to simulate sensor reading frequency (500ms)
        time.sleep(0.5)
        
    return pd.DataFrame(results)

def test_throughput_performance():
    print("\n--- Phase 2: Testing Throughput and Packet Loss ---")
    rates = [5, 10, 20, 50] # messages per second
    throughput_results = []
    
    for rate in rates:
        print(f"Testing rate: {rate} messages/second...")
        sent_timestamps = []
        interval = 1.0 / rate
        
        # Send 100 messages at the specified rate
        for i in range(100):
            sent_at = time.time()
            payload = {
                "temperature": round(random.uniform(22.0, 33.0), 2),
                "humidity": round(random.uniform(45.0, 75.0), 2),
                "relay": random.choice([0, 1]),
                "sent_at": sent_at
            }
            sent_timestamps.append(sent_at)
            
            # Non-blocking send
            try:
                requests.post(FLASK_PROXY_URL, json=payload, timeout=0.1)
            except Exception:
                pass
            
            time.sleep(interval)
            
        print("Waiting 5 seconds for messages to propagate to InfluxDB...")
        time.sleep(5)
        
        # Query InfluxDB to see how many were recorded
        recorded_sent_ats = query_influxdb_sent_ats()
        
        # Check matching
        success_count = 0
        latencies = []
        for sent_at in sent_timestamps:
            # Check if there is a recorded timestamp within a tiny epsilon
            matched = False
            for rec_val in recorded_sent_ats:
                if abs(rec_val - sent_at) < 0.001:
                    matched = True
                    # Estimate the latency using MQTT norm listener as a proxy if NextJS polling is too slow at high rates
                    mqtt_norm_time = mqtt_norm_timestamps.get(sent_at)
                    if mqtt_norm_time:
                        latencies.append((mqtt_norm_time - sent_at) * 1000)
                    break
            if matched:
                success_count += 1
                
        loss_rate = ((100 - success_count) / 100.0) * 100.0
        avg_latency = np.mean(latencies) if latencies else 0.0
        
        print(f"Rate: {rate} msg/s | Sent: 100 | Received in InfluxDB: {success_count} | Loss: {loss_rate:.1f}% | Avg Latency: {avg_latency:.1f}ms")
        throughput_results.append({
            "rate": rate,
            "loss_rate": loss_rate,
            "avg_latency_ms": avg_latency
        })
        time.sleep(2)
        
    return pd.DataFrame(throughput_results)

def main():
    print("==================================================")
    print("EcoEdge IoT Pipeline Benchmark")
    print("==================================================")
    
    # Start the MQTT subscription listener
    mqtt_client = start_mqtt_listener()
    time.sleep(1) # Let MQTT client connect
    
    try:
        # Run Latency Benchmark
        df_latency = test_latency_performance(50)
        df_latency.to_csv("ai/latency_results.csv", index=False)
        
        # Run Throughput & Packet Loss Benchmark
        df_throughput = test_throughput_performance()
        df_throughput.to_csv("ai/throughput_results.csv", index=False)
        
        # --- Generate Latency Boxplot ---
        plt.figure(figsize=(10, 6))
        # Drop rows with null values to avoid matplotlib failures
        clean_df = df_latency.dropna()
        
        data_to_plot = [
            clean_df['flask_ms'],
            clean_df['mqtt_raw_ms'],
            clean_df['mqtt_norm_ms'],
            clean_df['live_store_ms'],
            clean_df['influxdb_ms']
        ]
        
        plt.boxplot(data_to_plot, tick_labels=[
            'Flask Ingestion\n(HTTP POST)',
            'MQTT Broker\n(ecoedge/device01/telemetry)',
            'Node-RED Processing\n(ecoedge/normalized/device01)',
            'Next.js Live Store\n(GET /api/telemetry)',
            'InfluxDB Storage\n(GET /api/telemetry/latest)'
        ])
        
        plt.title('EcoEdge IoT Pipeline Latency Distribution', fontsize=14, fontweight='bold', pad=15)
        plt.ylabel('Latency (milliseconds)', fontsize=12)
        plt.grid(axis='y', linestyle='--', alpha=0.7)
        plt.tight_layout()
        plt.savefig("ai/latency_breakdown.png", dpi=300)
        print("Saved latency breakdown plot to ai/latency_breakdown.png")
        
        # --- Generate Throughput Performance Plot ---
        fig, ax1 = plt.subplots(figsize=(10, 6))
        
        color = 'tab:blue'
        ax1.set_xlabel('Throughput Rate (messages/second)', fontsize=12)
        ax1.set_ylabel('Node-RED Propagation Latency (ms)', color=color, fontsize=12)
        ax1.plot(df_throughput['rate'], df_throughput['avg_latency_ms'], color=color, marker='o', linewidth=2, label='Avg Latency')
        ax1.tick_params(axis='y', labelcolor=color)
        ax1.grid(True, linestyle='--', alpha=0.7)
        
        ax2 = ax1.twinx()  
        color = 'tab:red'
        ax2.set_ylabel('Packet Loss Rate (%)', color=color, fontsize=12)
        ax2.plot(df_throughput['rate'], df_throughput['loss_rate'], color=color, marker='s', linestyle='--', linewidth=2, label='Packet Loss')
        ax2.tick_params(axis='y', labelcolor=color)
        
        plt.title('EcoEdge Pipeline Throughput vs. Latency and Packet Loss', fontsize=14, fontweight='bold', pad=15)
        fig.tight_layout()
        plt.savefig("ai/throughput_performance.png", dpi=300)
        print("Saved throughput performance plot to ai/throughput_performance.png")
        
    finally:
        mqtt_client.loop_stop()
        mqtt_client.disconnect()
        print("MQTT Listener disconnected. Benchmark complete.")

if __name__ == "__main__":
    main()
