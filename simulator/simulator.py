import json
import random
import time
import os
import urllib.request
import urllib.error

# Function to load environment variables from .env.local
def load_env():
    # Look for .env.local in the parent directory
    env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env.local"))
    if not os.path.exists(env_path):
        print(f"[Simulator] No .env.local file found at {env_path}, using defaults.")
        return
    
    with open(env_path, "r") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, val = line.split("=", 1)
                os.environ[key.strip()] = val.strip()
    print("[Simulator] Loaded configurations from .env.local")

# Load environment
load_env()

# InfluxDB Configuration
INFLUX_URL = os.environ.get("INFLUX_URL", "http://localhost:8086").rstrip("/")
INFLUX_TOKEN = os.environ.get("INFLUX_TOKEN", "")
INFLUX_ORG = os.environ.get("INFLUX_ORG", "EcoEdge")
INFLUX_BUCKET = os.environ.get("INFLUX_BUCKET", "telemetry")

# MQTT Config (Optional / fallback)
BROKER = os.environ.get("MQTT_BROKER", "localhost")
PORT = int(os.environ.get("MQTT_PORT", 1883))
TOPIC = os.environ.get("MQTT_TOPIC", "ecoedge/device01/telemetry")

# Optional MQTT import
mqtt_available = False
try:
    import paho.mqtt.client as mqtt
    mqtt_available = True
except ImportError:
    print("[Simulator] paho-mqtt package not installed. Will skip MQTT and write directly to InfluxDB.")

client = None
if mqtt_available:
    try:
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1)
        client.connect(BROKER, PORT, 60)
        client.loop_start()
        print(f"[Simulator] MQTT initialized. Publishing to {BROKER}:{PORT} on {TOPIC}")
    except Exception as e:
        print(f"[Simulator] MQTT connection failed (is broker running?): {e}")

print(f"[Simulator] InfluxDB target: {INFLUX_URL} (Bucket: {INFLUX_BUCKET})")
print("EcoEdge Simulator Started...")

device_id = "device01"

while True:
    power_val = round(random.uniform(100, 300), 2)
    payload = {
        "device_id": device_id,
        "voltage": round(random.uniform(220, 240), 2),
        "dc_voltage": round(random.uniform(11.5, 14.2), 2),
        "battery": round(random.uniform(40, 95), 2),
        "power": power_val,
        "current": round(power_val / 230.0, 2),
        "temperature": round(random.uniform(22.0, 28.0), 2),
        "humidity": round(random.uniform(45.0, 65.0), 2),
        "relay": random.choice([True, False]),
        "gridPresent": True,
        "solar": round(power_val * 0.8, 2),
        "load": round(power_val * 1.1, 2)
    }

    # 1. Write telemetry directly to InfluxDB using HTTP POST (Line Protocol)
    if INFLUX_TOKEN:
        timestamp_ms = int(time.time() * 1000)
        relay_str = "true" if payload["relay"] else "false"
        grid_str = "true" if payload["gridPresent"] else "false"
        
        # InfluxDB line protocol format
        line_protocol = (
            f"ecoedge,device={device_id} "
            f"voltage={payload['voltage']:.2f},"
            f"dc_voltage={payload['dc_voltage']:.2f},"
            f"battery={payload['battery']:.2f},"
            f"power={payload['power']:.2f},"
            f"current={payload['current']:.2f},"
            f"temperature={payload['temperature']:.2f},"
            f"humidity={payload['humidity']:.2f},"
            f"relay={relay_str},"
            f"gridPresent={grid_str},"
            f"solar={payload['solar']:.2f},"
            f"load={payload['load']:.2f} "
            f"{timestamp_ms}"
        ).encode('utf-8')
        
        write_url = f"{INFLUX_URL}/api/v2/write?org={INFLUX_ORG}&bucket={INFLUX_BUCKET}&precision=ms"
        req = urllib.request.Request(
            write_url,
            data=line_protocol,
            headers={
                "Authorization": f"Token {INFLUX_TOKEN}",
                "Content-Type": "text/plain; charset=utf-8"
            },
            method="POST"
        )
        
        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                status = response.status
                if status in (204, 200):
                    print(f"[InfluxDB] Wrote telemetry successfully: {payload['voltage']}V, {payload['battery']}%, {payload['power']}W")
                else:
                    print(f"[InfluxDB] Unexpected status: {status}")
        except urllib.error.HTTPError as e:
            print(f"[InfluxDB] HTTP Error {e.code}: {e.read().decode('utf-8')}")
        except Exception as e:
            print(f"[InfluxDB] Connection Error: {e}")
    else:
        print("[InfluxDB] Token missing, skipping direct database write.")

    # 2. Publish to MQTT broker
    if client:
        try:
            result = client.publish(TOPIC, json.dumps(payload))
            if result.rc != 0:
                print(f"[MQTT] Publish failed: {result.rc}")
        except Exception as e:
            print(f"[MQTT] Publish error: {e}")

    time.sleep(3)