import time
import json
import threading
import sys
import requests
from collections import deque
import paho.mqtt.client as mqtt

from ai.config import (
    MQTT_BROKER,
    MQTT_PORT,
    MQTT_TOPIC_TELEMETRY,
    MODEL_VERSION,
    INFERENCE_INTERVAL,
    MIN_PROCESS_INTERVAL,
    BATTERY_CAPACITY_WH,
    INFLUX_URL
)
from ai.inference import predict_power
from ai.analytics import (
    calculate_csi,
    detect_anomaly,
    predict_maintenance,
    estimate_backup_time
)
from ai.db_writer import write_prediction, write_analytics

# Global State & Buffers
# Stores 2D vectors of 10 features: [power, voltage, battery, solar, temperature, humidity, hour_sin, hour_cos, day_sin, day_cos]
live_history_buffer = deque(maxlen=48)
latest_telemetry = None
latest_telemetry_lock = threading.Lock()

last_processed_time = 0.0
previous_battery = None

def run_health_checks():
    """
    Startup health checks to verify Keras model loading, 
    InfluxDB connectivity, and MQTT broker configuration.
    """
    print("=" * 60)
    print("               ECOEDGE STARTUP HEALTH CHECKS")
    print("=" * 60)
    
    # 1. Verify Keras Model Load
    print("[Health Check 1/3] Verifying Keras Model load and inference...")
    try:
        # Expecting shape (48, 10) for multivariate model
        # [power, voltage, battery, solar, temperature, humidity, hour_sin, hour_cos, day_sin, day_cos]
        mock_sequence = [[150.0, 230.0, 80.0, 100.0, 25.0, 50.0, 0.0, 1.0, 0.0, 1.0]] * 48
        mock_pred = predict_power(mock_sequence)
        print(f"  --> SUCCESS: Multivariate LSTM Model loaded. Mock prediction (150W input) = {mock_pred:.2f} W")
    except Exception as e:
        print(f"  --> FAILED: Keras model failed to load or run inference: {e}")
        sys.exit(1)
        
    # 2. Verify InfluxDB Connection
    print("[Health Check 2/3] Verifying InfluxDB connectivity...")
    try:
        health_url = f"{INFLUX_URL}/health"
        res = requests.get(health_url, timeout=3)
        if res.status_code == 200:
            print(f"  --> SUCCESS: InfluxDB is reachable at {INFLUX_URL}")
        else:
            print(f"  --> WARNING: InfluxDB returned status {res.status_code} at {health_url}")
    except Exception as e:
        print(f"  --> WARNING: InfluxDB health check failed (is it running?): {e}")

    # 3. Verify MQTT Broker Connection Configuration
    print("[Health Check 3/3] Verifying MQTT connection parameters...")
    print(f"  --> MQTT Broker: {MQTT_BROKER}:{MQTT_PORT}")
    print(f"  --> Subscription Topic: {MQTT_TOPIC_TELEMETRY}")
    print("=" * 60)
    print("Health checks finished. Starting MQTT loop & scheduler...")
    print("=" * 60)


def on_connect(client, userdata, flags, rc, properties=None):
    """Callback when client connects to MQTT broker."""
    if rc == 0:
        print(f"[MQTT] Connected successfully to broker at {MQTT_BROKER}:{MQTT_PORT}")
        client.subscribe(MQTT_TOPIC_TELEMETRY)
        print(f"[MQTT] Subscribed to topic: {MQTT_TOPIC_TELEMETRY}")
    else:
        print(f"[MQTT] Connection failed with result code {rc}")


def on_message(client, userdata, msg):
    """Callback when a telemetry message is received from MQTT."""
    global latest_telemetry, last_processed_time, previous_battery
    
    current_time = time.time()
    
    # Phase 6: Backpressure Protection
    if current_time - last_processed_time < MIN_PROCESS_INTERVAL:
        return
        
    try:
        payload = json.loads(msg.payload.decode('utf-8'))
        
        device_id = payload.get("device_id", "device01")
        power = float(payload.get("power", 0.0))
        voltage = float(payload.get("voltage", 0.0))
        battery = float(payload.get("battery", 0.0))
        current = float(payload.get("current", 0.0))
        solar = float(payload.get("solar", 0.0))
        temperature = float(payload.get("temperature", 25.0))
        humidity = float(payload.get("humidity", 50.0))
        
        # Grid Present flag (handle both snake_case and camelCase formats)
        grid_present = payload.get("grid_present", payload.get("gridPresent", True))
        grid_present = bool(grid_present)

        # ----------------------------------------------------
        # Step 2: Data Validation Layer
        # ----------------------------------------------------
        if power < 0 or voltage < 100.0 or battery > 100.0 or battery < 0.0:
            print(f"[Validation] Rejected bad telemetry payload: power={power}, voltage={voltage}, battery={battery}")
            return

        # ----------------------------------------------------
        # Step 3: Feature Engineering Layer
        # ----------------------------------------------------
        # A. Power Factor (PF) approximation
        if voltage * current > 0.0:
            pf = power / (voltage * current)
        else:
            pf = 1.0
        pf = max(0.0, min(1.0, pf)) # Clamp between 0 and 1

        # B. Battery Consumption Rate: Battery(t) - Battery(t-1)
        if previous_battery is not None:
            battery_drop_rate = previous_battery - battery
        else:
            battery_drop_rate = 0.0
        previous_battery = battery

        # C. Renewable Utilization Ratio: Solar Generation / Total Load (Power)
        if power > 0.0:
            renewable_ratio = solar / power
        else:
            renewable_ratio = 0.0
        renewable_ratio = max(0.0, min(1.0, renewable_ratio))

        # Calculate cyclical time features based on system time
        import datetime
        import math
        now = datetime.datetime.now()
        hour_val = now.hour
        day_val = now.weekday()
        
        hour_sin = math.sin(2 * math.pi * hour_val / 24.0)
        hour_cos = math.cos(2 * math.pi * hour_val / 24.0)
        day_sin = math.sin(2 * math.pi * day_val / 7.0)
        day_cos = math.cos(2 * math.pi * day_val / 7.0)

        # Safely update latest telemetry and rolling history buffer
        with latest_telemetry_lock:
            # Step 4: Rolling Sequence Buffer (stores 10 features: power, voltage, battery, solar, temp, humidity, cyclical time features)
            live_history_buffer.append([power, voltage, battery, solar, temperature, humidity, hour_sin, hour_cos, day_sin, day_cos])
            
            latest_telemetry = {
                "device_id": device_id,
                "voltage": voltage,
                "current": current,
                "power": power,
                "battery": battery,
                "temperature": temperature,
                "humidity": humidity,
                "solar": solar,
                "grid_present": grid_present,
                "pf": pf,
                "battery_drop_rate": battery_drop_rate,
                "renewable_ratio": renewable_ratio,
                "hour_sin": hour_sin,
                "hour_cos": hour_cos,
                "day_sin": day_sin,
                "day_cos": day_cos
            }
            
        last_processed_time = current_time
        
    except Exception as e:
        print(f"[MQTT] Error parsing incoming MQTT message: {e}")


def scheduler_loop():
    """
    Periodically executes inference and analytics updates 
    at a fixed interval (e.g., every 5 seconds) to avoid CPU spikes.
    """
    print("[Scheduler] In-process inference scheduler started.")
    while True:
        time.sleep(INFERENCE_INTERVAL)
        
        # Fetch latest telemetry snapshot
        with latest_telemetry_lock:
            if latest_telemetry is None:
                continue
            telemetry = latest_telemetry.copy()
            # Copy rolling history buffer to avoid modification during inference
            history_snapshot = list(live_history_buffer)
            
        try:
            device_id = telemetry["device_id"]
            power = telemetry["power"]
            voltage = telemetry["voltage"]
            battery = telemetry["battery"]
            solar = telemetry["solar"]
            temperature = telemetry["temperature"]
            grid_present = telemetry["grid_present"]
            renewable_ratio = telemetry["renewable_ratio"]
            battery_drop_rate = telemetry["battery_drop_rate"]

            # ----------------------------------------------------
            # Step 5: Load Forecasting (LSTM)
            # ----------------------------------------------------
            # Pad the history sequence if we do not have 48 steps yet
            history_len = len(history_snapshot)
            current_vector = [
                power, voltage, battery, solar, temperature, telemetry["humidity"],
                telemetry["hour_sin"], telemetry["hour_cos"], telemetry["day_sin"], telemetry["day_cos"]
            ]
            if history_len < 48:
                pad_size = 48 - history_len
                sequence = [current_vector] * pad_size + history_snapshot
            else:
                sequence = history_snapshot

            predicted_power = predict_power(sequence)

            # ----------------------------------------------------
            # Step 6: Battery Backup Prediction
            # ----------------------------------------------------
            backup_time = estimate_backup_time(battery, predicted_power, BATTERY_CAPACITY_WH)

            # ----------------------------------------------------
            # Step 10A: Write Predictions to InfluxDB
            # ----------------------------------------------------
            write_prediction(device_id, predicted_power, backup_time, MODEL_VERSION)

            # ----------------------------------------------------
            # Step 7: CSI Computation
            # ----------------------------------------------------
            power_history = [step[0] for step in sequence]
            csi, csi_status = calculate_csi(renewable_ratio, battery, power_history, grid_present)

            # ----------------------------------------------------
            # Step 8: Anomaly Detection (using rolling stats)
            # ----------------------------------------------------
            anomaly_status = detect_anomaly(voltage, battery, power, power_history, battery_drop_rate, solar)

            # ----------------------------------------------------
            # Step 9: Predictive Maintenance
            # ----------------------------------------------------
            voltage_history = [step[1] for step in sequence]
            m_risk, m_status = predict_maintenance(temperature, voltage_history, power_history, battery)

            # ----------------------------------------------------
            # Step 10B: Write Analytics to InfluxDB
            # ----------------------------------------------------
            write_analytics(device_id, csi, anomaly_status, m_risk, m_status)
            
        except Exception as e:
            print(f"[Scheduler] Error during scheduled iteration: {e}")


def main():
    # Execute startup health checks
    run_health_checks()
    
    # Setup MQTT client compatible with paho-mqtt v1.x and v2.x
    try:
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    except Exception:
        client = mqtt.Client()
        
    client.on_connect = on_connect
    client.on_message = on_message
    
    # Start the scheduled inference thread
    scheduler_thread = threading.Thread(target=scheduler_loop, daemon=True)
    scheduler_thread.start()
    
    # Connect to broker and run network loop
    try:
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
        client.loop_forever()
    except KeyboardInterrupt:
        print("[Worker] Stopping worker cleanly...")
    except Exception as e:
        print(f"[Worker] MQTT broker connection exception: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
