import os
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
import paho.mqtt.client as mqtt

app = Flask(__name__)
CORS(app)

# MQTT Config
MQTT_BROKER = os.environ.get("MQTT_BROKER", "localhost")
MQTT_PORT = int(os.environ.get("MQTT_PORT", 1883))
MQTT_TOPIC = os.environ.get("MQTT_TOPIC", "ecoedge/device01/telemetry")

# Initialize MQTT Client
mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1)
try:
    mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
    mqtt_client.loop_start()
    print(f"Connected to MQTT Broker at {MQTT_BROKER}:{MQTT_PORT}")
except Exception as e:
    print(f"Failed to connect to MQTT Broker: {e}")

@app.route("/telemetry", methods=["POST"])
def telemetry():
    data = request.json or {}
    
    print("\n[ESP32 Ingestion] Received Hardware Telemetry via HTTP:")
    print(json.dumps(data, indent=2))
    
    # Extract ESP32 fields
    temp = float(data.get("temperature", 25.0))
    hum = float(data.get("humidity", 50.0))
    relay_val = int(data.get("relay", 0))
    
    # =========================================================================
    # INTEL MAPPER: Map physical sensor readings to electrical microgrid values
    # =========================================================================
    # 1. Temperature -> Voltage (20°C - 35°C maps gracefully to 180V - 250V stable zone)
    #    e.g. 30°C -> 225V. If temp spikes above 35.5°C, voltage will drop/spike to trigger alerts.
    voltage = round(temp * 7.5, 1)
    
    # 2. Humidity -> Battery level (0% - 100% maps directly to battery reserve)
    #    A standard indoor humidity of 40% - 80% maps to a healthy battery.
    battery = round(hum, 1)
    
    # 3. Relay State & Temp -> Power Draw (Watts)
    #    If the ESP32 active temperature controller switches ON the relay (heavy appliance),
    #    we simulate a substantial load surge (e.g. 380W). Otherwise, a standby load (e.g. 110W).
    if relay_val == 1:
        power = round(380.0 + (temp * 1.5), 1)
    else:
        power = round(110.0 + (temp * 0.5), 1)
        
    # Standardize values for EcoEdge
    mapped_payload = {
        "voltage": voltage,
        "battery": battery,
        "power": power,
        "relay": bool(relay_val),
        "temperature": temp,
        "humidity": hum
    }
    if "sent_at" in data:
        mapped_payload["sent_at"] = data["sent_at"]
    
    print("[EcoEdge Mapper] Translating physical parameters:")
    print(f"  DHT22 Temp: {temp}°C  ==>  Simulated Voltage: {voltage}V")
    print(f"  DHT22 Humid: {hum}%    ==>  Simulated Battery: {battery}%")
    # Relay status print matching state
    print(f"  Relay Switch: {'ON (Load Active)' if relay_val == 1 else 'OFF (Standby)'}  ==>  Power: {power}W")
    
    # Forward the mapped telemetry to the MQTT broker so the Node-RED flow writes to InfluxDB
    try:
        result = mqtt_client.publish(MQTT_TOPIC, json.dumps(mapped_payload))
        if result.rc == 0:
            print(f"Successfully published mapped telemetry to: {MQTT_TOPIC}")
        else:
            print(f"MQTT publish failed with status: {result.rc}")
    except Exception as e:
        print(f"Error publishing to MQTT: {e}")
        
    return jsonify({
        "success": True,
        "message": "Telemetry mapped & successfully published to EcoEdge pipeline.",
        "mapped": mapped_payload
    })

if __name__ == "__main__":
    # NOTE: Port 5000 is occupied by the EcoEdge AI Server (ai_server.py).
    # We host this HTTP-to-MQTT proxy on port 5002.
    app.run(host="0.0.0.0", port=5002, debug=True)
