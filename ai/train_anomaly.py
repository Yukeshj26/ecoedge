import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
import joblib

print("Loading real-world Renewable Energy Dataset for anomaly training...")
df_raw = pd.read_csv("Renewable_energy_dataset.csv")

# Map raw features to training variables
battery = df_raw["battery_state_of_charge"]
voltage = df_raw["voltage"]
power = df_raw["grid_load_demand"]

# Compute CSI using exact Next.js lib logic (vectorized for Series)
def calculate_csi(v, b, p):
    v_score = np.select([v >= 12, v >= 11], [100, 75], default=40)
    b_score = b
    p_score = np.select([p <= 20, p <= 35], [100, 80], default=60)
    csi = v_score * 0.3 + b_score * 0.4 + p_score * 0.3
    return np.round(csi)

csi = calculate_csi(voltage, battery, power)

# Assemble DataFrame matching live telemetry shapes
data = pd.DataFrame({
    "voltage": voltage,
    "battery": battery,
    "power": power,
    "csi": csi
})

print("Training Isolation Forest Anomaly Detector on real telemetry...")
model = IsolationForest(
    contamination=0.05,
    random_state=42
)
model.fit(data)

joblib.dump(model, "anomaly_detector.pkl")
print("Anomaly detection model trained and saved successfully on real dataset!")