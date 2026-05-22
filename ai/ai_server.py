from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd

app = Flask(__name__)
CORS(app)

# load model (automatically reloaded with high-fidelity real-world dataset)
model = joblib.load("backup_predictor.pkl")


@app.route("/")
def home():
    return "EcoEdge AI Server Running"


# -------------------------
# PREDICTION ENDPOINT
# -------------------------
@app.route("/predict", methods=["POST"])
def predict():

    data = request.json or {}

    # validation (prevents crashes)
    required = ["voltage", "battery", "power", "csi", "load", "solar"]

    missing = [r for r in required if r not in data]
    if missing:
        return jsonify({
            "error": "Missing fields",
            "missing": missing
        }), 400

    features = pd.DataFrame([{
        "battery": data.get("battery", 0),
        "solar": data.get("solar", 0),
        "load": data.get("load", 0),
        "voltage": data.get("voltage", 0),
        "power": data.get("power", 0),
        "csi": data.get("csi", 0)
    }])

# FORCE EXACT TRAINING ORDER
    features = features.reindex(columns=model.feature_names_in_, fill_value=0)

    prediction = model.predict(features)[0]

    return jsonify({
        "backup_time": round(float(prediction), 2)
    })


# -------------------------
# ANOMALY ENDPOINT
# -------------------------
@app.route("/anomaly", methods=["POST"])
def anomaly():

    data = request.json or {}

    voltage = data.get("voltage", 0)
    battery = data.get("battery", 0)

    is_anomaly = (
        voltage > 260 or voltage < 180 or
        battery < 15
    )

    return jsonify({
        "anomaly": is_anomaly
    })


if __name__ == "__main__":
    app.run(
        debug=True,
        host="0.0.0.0",
        port=5000
    )