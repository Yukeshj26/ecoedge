"""
Evaluate EcoEdge anomaly detection precision, recall, and F1-score.

Strategy:
- Use the large dataset to generate ground-truth anomaly labels based on
  known physical thresholds (injected anomalies + natural edge cases).
- Run the rule-based detect_anomaly() function against the data.
- Compare predictions vs ground truth per anomaly type.
"""
import numpy as np
import pandas as pd
import os
from sklearn.metrics import precision_score, recall_score, f1_score, confusion_matrix, classification_report
from ai.analytics import detect_anomaly

script_dir = os.path.dirname(os.path.abspath(__file__))
csv_path = os.path.join(script_dir, "Renewable_energy_dataset_large.csv")

print(f"Loading dataset from {csv_path}...")
df = pd.read_csv(csv_path)

num_samples = len(df)
print(f"Dataset size: {num_samples} samples")

voltage = df["voltage"].values
power = df["power"].values
battery = df["battery"].values
solar = df["solar"].values

# =========================================================================
# STEP 1: Create ground-truth labels by injecting known anomalies
# =========================================================================
np.random.seed(42)

# Work on copies for the test set
test_voltage = voltage.copy()
test_power = power.copy()
test_battery = battery.copy()

# Ground truth arrays (0 = normal, 1 = anomaly)
gt_under_voltage = np.zeros(num_samples, dtype=int)
gt_over_voltage = np.zeros(num_samples, dtype=int)
gt_power_surge = np.zeros(num_samples, dtype=int)
gt_battery_fault = np.zeros(num_samples, dtype=int)

# Inject UNDER VOLTAGE anomalies (~2% of data)
uv_indices = np.random.choice(num_samples, size=int(num_samples * 0.02), replace=False)
test_voltage[uv_indices] = np.random.uniform(165.0, 190.0, size=len(uv_indices))
gt_under_voltage[uv_indices] = 1

# Inject OVER VOLTAGE anomalies (~2% of data)
ov_indices = np.random.choice(num_samples, size=int(num_samples * 0.02), replace=False)
test_voltage[ov_indices] = np.random.uniform(245.0, 270.0, size=len(ov_indices))
gt_over_voltage[ov_indices] = 1

# Inject POWER SURGE anomalies (~2% of data, using 48-step windows)
surge_indices = np.random.choice(range(48, num_samples), size=int(num_samples * 0.02), replace=False)
for idx in surge_indices:
    window = test_power[max(0, idx-48):idx]
    mean_p = np.mean(window)
    std_p = np.std(window)
    if std_p > 5.0:
        test_power[idx] = mean_p + 3.5 * std_p  # Inject clear surge
        gt_power_surge[idx] = 1

# Inject BATTERY FAULT anomalies (~2% of data)
bf_indices = np.random.choice(range(1, num_samples), size=int(num_samples * 0.02), replace=False)
for idx in bf_indices:
    test_battery[idx] = test_battery[idx - 1] - np.random.uniform(5.5, 15.0)
    gt_battery_fault[idx] = 1

# =========================================================================
# STEP 2: Run the EcoEdge anomaly detector on test data
# =========================================================================
pred_under_voltage = np.zeros(num_samples, dtype=int)
pred_over_voltage = np.zeros(num_samples, dtype=int)
pred_power_surge = np.zeros(num_samples, dtype=int)
pred_battery_fault = np.zeros(num_samples, dtype=int)

previous_battery = None
WINDOW_SIZE = 48

for i in range(num_samples):
    v = test_voltage[i]
    p = test_power[i]
    b = test_battery[i]

    # Battery drop rate
    if previous_battery is not None:
        battery_drop_rate = previous_battery - b
    else:
        battery_drop_rate = 0.0
    previous_battery = b

    # Power history window
    start = max(0, i - WINDOW_SIZE)
    power_history = list(test_power[start:i+1])

    # Call the production detect_anomaly function directly
    status = detect_anomaly(v, b, p, power_history, battery_drop_rate, solar[i])
    if "POWER SURGE" in status:
        pred_power_surge[i] = 1
    if "UNDER VOLTAGE" in status:
        pred_under_voltage[i] = 1
    if "OVER VOLTAGE" in status:
        pred_over_voltage[i] = 1
    if "BATTERY FAULT" in status:
        pred_battery_fault[i] = 1

# =========================================================================
# STEP 3: Compute metrics per anomaly type
# =========================================================================
anomaly_types = [
    ("Power Surge",    gt_power_surge,    pred_power_surge),
    ("Under Voltage",  gt_under_voltage,  pred_under_voltage),
    ("Over Voltage",   gt_over_voltage,   pred_over_voltage),
    ("Battery Fault",  gt_battery_fault,  pred_battery_fault),
]

print("\n" + "=" * 70)
print("        ECOEDGE ANOMALY DETECTION EVALUATION REPORT")
print("=" * 70)
print(f"{'Anomaly Type':<18} | {'Precision':>9} | {'Recall':>9} | {'F1-Score':>9} | {'Support':>9}")
print("-" * 70)

all_gt = np.zeros(num_samples, dtype=int)
all_pred = np.zeros(num_samples, dtype=int)

for name, gt, pred in anomaly_types:
    if gt.sum() == 0:
        print(f"{name:<18} | {'N/A':>9} | {'N/A':>9} | {'N/A':>9} | {int(gt.sum()):>9}")
        continue

    p = precision_score(gt, pred, zero_division=0)
    r = recall_score(gt, pred, zero_division=0)
    f1 = f1_score(gt, pred, zero_division=0)
    support = int(gt.sum())

    print(f"{name:<18} | {p:>9.4f} | {r:>9.4f} | {f1:>9.4f} | {support:>9}")

    all_gt = np.maximum(all_gt, gt)
    all_pred = np.maximum(all_pred, pred)

# Overall (any anomaly vs normal)
print("-" * 70)
p_all = precision_score(all_gt, all_pred, zero_division=0)
r_all = recall_score(all_gt, all_pred, zero_division=0)
f1_all = f1_score(all_gt, all_pred, zero_division=0)
print(f"{'Overall (Any)':<18} | {p_all:>9.4f} | {r_all:>9.4f} | {f1_all:>9.4f} | {int(all_gt.sum()):>9}")
print("=" * 70)

# Confusion matrix for overall
tn, fp, fn, tp = confusion_matrix(all_gt, all_pred).ravel()
print(f"\nOverall Confusion Matrix:")
print(f"  True Positives  : {tp}")
print(f"  True Negatives  : {tn}")
print(f"  False Positives : {fp}")
print(f"  False Negatives : {fn}")
print(f"  Accuracy        : {(tp + tn) / (tp + tn + fp + fn):.4f}")
