import paho.mqtt.client as mqtt
import json
import random
import time

# MQTT CONFIG
BROKER = "localhost"
PORT = 1883
TOPIC = "ecoedge/device01/telemetry"

# Create MQTT client
client = mqtt.Client(
    mqtt.CallbackAPIVersion.VERSION1
)

# Connect to broker
client.connect(BROKER, PORT, 60)

# Start MQTT loop
client.loop_start()

print("EcoEdge Simulator Started...")
print(f"Publishing to: {TOPIC}")

while True:
    payload = {
        "voltage": round(random.uniform(220, 240), 2),
        "current": round(random.uniform(0.5, 5), 2),
        "battery": round(random.uniform(20, 100), 2),
        "power": round(random.uniform(50, 500), 2)
    }

    # Publish telemetry
    result = client.publish(
        TOPIC,
        json.dumps(payload)
    )

    # Print status
    if result.rc == 0:
        print("Published:", payload)
    else:
        print("Publish Failed")

    time.sleep(2)