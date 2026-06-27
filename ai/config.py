import os

# InfluxDB configuration
INFLUX_URL = os.environ.get("INFLUX_URL", "http://127.0.0.1:8086")
INFLUX_TOKEN = os.environ.get("INFLUX_TOKEN", "03VDOT3tpzwm7--nywROtKR0SPBpWTRZmPiVla6jw_5tgaP8syQQxARVt8d74OnGh0afh6Z85xgM1gRc6XF8lQ==")
INFLUX_ORG = os.environ.get("INFLUX_ORG", "EcoEdge")
INFLUX_BUCKET = os.environ.get("INFLUX_BUCKET", "telemetry")

# MQTT configuration
MQTT_BROKER = os.environ.get("MQTT_BROKER", "localhost")
MQTT_PORT = int(os.environ.get("MQTT_PORT", 1883))
MQTT_TOPIC_TELEMETRY = os.environ.get("MQTT_TOPIC_TELEMETRY", "ecoedge/normalized/device01")

# Worker Model Configuration
MODEL_VERSION = "LSTM_v1.0.0"
INFERENCE_INTERVAL = 5        # seconds
MIN_PROCESS_INTERVAL = 1      # seconds
BATTERY_CAPACITY_WH = 2000.0  # Battery Capacity in Wh (configurable)
