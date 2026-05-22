import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
import joblib

print("Loading real-world Renewable Energy Dataset...")
df_raw = pd.read_csv("Renewable_energy_dataset.csv")

# Map raw features to training variables
battery = df_raw["battery_state_of_charge"]
solar = df_raw["total_renewable_energy"]
load = df_raw["grid_load_demand"]
voltage = df_raw["voltage"]
power = df_raw["grid_load_demand"]  # power level is mapped to demand load

# Compute CSI using exact Next.js lib logic (vectorized for Series)
def calculate_csi(v, b, p):
    # Voltage stability score: v >= 12 -> 100, v >= 11 -> 75, else 40
    v_score = np.select([v >= 12, v >= 11], [100, 75], default=40)
    # Battery health score
    b_score = b
    # Power efficiency score: p <= 20 -> 100, p <= 35 -> 80, else 60
    p_score = np.select([p <= 20, p <= 35], [100, 80], default=60)
    # Weighted CSI calculation
    csi = v_score * 0.3 + b_score * 0.4 + p_score * 0.3
    return np.round(csi)

csi = calculate_csi(voltage, battery, power)

# Compute highly realistic backup time (in hours) based on a 5000 Wh battery capacity
battery_capacity_wh = 5000
remaining_energy_wh = (battery / 100.0) * battery_capacity_wh
backup_time = remaining_energy_wh / np.maximum(load, 1)

# Build features DataFrame matching all the endpoints
df = pd.DataFrame({
    "battery": battery,
    "solar": solar,
    "load": load,
    "voltage": voltage,
    "power": power,
    "csi": csi,
    "backup_time": backup_time
})

X = df[[
    "battery",
    "solar",
    "load",
    "voltage",
    "power",
    "csi"
]]

y = df["backup_time"]

print("Training Random Forest Regressor on real energy features...")
model = RandomForestRegressor(n_estimators=50, max_depth=10, random_state=42)
model.fit(X, y)

# Dump to both files to maintain consistency across all model definitions
joblib.dump(model, "backup_predictor.pkl")
joblib.dump(model, "backup_model.pkl")

print("Backup prediction models trained and saved successfully on real dataset!")