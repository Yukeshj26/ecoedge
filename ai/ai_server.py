from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd
import numpy as np
import os
from tensorflow.keras.models import load_model

app = Flask(__name__)
CORS(app)

# Load models once at startup
script_dir = os.path.dirname(os.path.abspath(__file__))
rf_model = joblib.load(os.path.join(script_dir, "backup_predictor.pkl"))
lstm_model = load_model(os.path.join(script_dir, "lstm_power_model.keras"))
lstm_scaler = joblib.load(os.path.join(script_dir, "lstm_scaler.pkl"))

# Constants matching worker configuration
BATTERY_CAPACITY_WH = 2000.0

@app.route("/")
def home():
    return "EcoEdge AI Inference Server Running"

@app.route("/predict", methods=["POST"])
def predict():
    """
    Stateless inference endpoint for Random Forest (Live/Sandbox) 
    and LSTM (Sandbox simulation).
    """
    data = request.json or {}

    # Validation of required input parameters
    required = ["voltage", "battery", "power", "csi", "load", "solar"]
    missing = [r for r in required if r not in data]
    if missing:
        return jsonify({
            "error": "Missing fields",
            "missing": missing
        }), 400

    model_type = data.get("model", "rf") # 'rf' or 'lstm'
    mode = data.get("mode", "sandbox")   # 'live' or 'sandbox'

    # Extract inputs in standard order
    battery_val = float(data.get("battery", 0.0))
    solar_val = float(data.get("solar", 0.0))
    load_val = float(data.get("load", 0.0))
    voltage_val = float(data.get("voltage", 0.0))
    power_val = float(data.get("power", 0.0))
    csi_val = float(data.get("csi", 0.0))
    
    # Extra features for 10-feature LSTM scaling, with safe fallbacks
    temp_val = float(data.get("temperature", 25.0))
    hum_val = float(data.get("humidity", 50.0))

    if model_type == "lstm":
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

        # In Sandbox simulation mode, construct a static 48-timestep sequence 
        # using the 10 features: [power, voltage, battery, solar, temp, humidity, cyclical time features]
        step_vector = [power_val, voltage_val, battery_val, solar_val, temp_val, hum_val, hour_sin, hour_cos, day_sin, day_cos]
        sequence = [step_vector] * 48

        # Normalize and forecast using the Keras LSTM model
        seq_arr = np.array(sequence).astype(float) # shape (48, 10)
        seq_norm = lstm_scaler.transform(seq_arr)
        seq_norm = np.expand_dims(seq_norm, axis=0) # shape (1, 48, 10)
        
        pred_norm = lstm_model.predict(seq_norm, verbose=0)[0, 0]
        
        # Inverse transform to get predicted power (in Watts)
        dummy = np.zeros((1, 10))
        dummy[0, 0] = pred_norm
        predicted_power = lstm_scaler.inverse_transform(dummy)[0, 0]
        predicted_power = max(1.0, float(predicted_power))
        
        # Calculate backup time: remaining energy / predicted power load
        remaining_energy_wh = (battery_val / 100.0) * BATTERY_CAPACITY_WH
        prediction = remaining_energy_wh / predicted_power
    else:
        # Fallback/Direct prediction using the Random Forest Regressor
        features = pd.DataFrame([{
            "battery": battery_val,
            "solar": solar_val,
            "load": load_val,
            "voltage": voltage_val,
            "power": power_val,
            "csi": csi_val
        }])
        
        # Reindex features to match Random Forest training column ordering
        features = features.reindex(columns=rf_model.feature_names_in_, fill_value=0)
        prediction = rf_model.predict(features)[0]

    return jsonify({
        "backup_time": round(float(prediction), 2)
    })

if __name__ == "__main__":
    app.run(
        debug=True,
        host="0.0.0.0",
        port=5000
    )