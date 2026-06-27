import numpy as np

def estimate_backup_time(battery: float, predicted_power: float, capacity_wh: float) -> float:
    """
    Estimate remaining operation duration in hours using battery capacity, 
    charge state, and predicted power.
    """
    # Available energy = capacity * SOC percentage
    available_energy_wh = capacity_wh * (battery / 100.0)
    
    # Avoid division by zero
    if predicted_power <= 0:
        predicted_power = 1.0
        
    backup_time = available_energy_wh / predicted_power
    return round(backup_time, 2)


def calculate_csi(
    renewable_ratio: float, 
    battery: float, 
    power_history: list[float], 
    grid_present: bool
) -> tuple[int, str]:
    """
    Calculate the Consumer Sustainability Index (CSI).
    Formula weighting:
      - 30% Renewable Usage
      - 25% Battery SOC
      - 25% Load Stability (inverse of coefficient of variation)
      - 20% Grid Independence (100% if off-grid, else relative solar load coverage)
    Returns:
      - csi: integer score (0-100)
      - status: string category ('Excellent', 'Good', 'Moderate', 'Poor')
    """
    # 1. Renewable Usage Score (0-100)
    renewable_score = min(100.0, max(0.0, renewable_ratio * 100.0))

    # 2. Battery SOC Score (0-100)
    battery_score = min(100.0, max(0.0, battery))

    # 3. Load Stability Score (0-100)
    # Computed using Coefficient of Variation (std / mean) over history window
    if len(power_history) >= 2:
        mean_power = np.mean(power_history)
        std_power = np.std(power_history)
        if mean_power > 0:
            coef_variation = std_power / mean_power
            # More variance = lower stability score
            stability_score = max(0.0, min(100.0, (1.0 - coef_variation) * 100.0))
        else:
            stability_score = 100.0
    else:
        stability_score = 80.0 # Default starting stability

    # 4. Grid Independence Score (0-100)
    # If off-grid, independence is 100. If on-grid, it is based on solar generation coverage.
    if not grid_present:
        grid_score = 100.0
    else:
        # If solar is active, how much load does it cover?
        grid_score = min(100.0, max(0.0, renewable_ratio * 100.0))

    # Weighted CSI Sum
    csi_val = (
        (renewable_score * 0.30) + 
        (battery_score * 0.25) + 
        (stability_score * 0.25) + 
        (grid_score * 0.20)
    )
    
    csi = int(round(csi_val))
    csi = max(0, min(100, csi))

    # Classification Table
    if csi >= 80:
        status = "Excellent"
    elif csi >= 60:
        status = "Good"
    elif csi >= 40:
        status = "Moderate"
    else:
        status = "Poor"

    return csi, status


def detect_anomaly(
    voltage: float, 
    battery: float, 
    power: float, 
    power_history: list[float], 
    battery_drop_rate: float,
    solar: float = 0.0
) -> str:
    """
    Detect system anomalies based on rolling stats and physical thresholds.
    """
    anomalies = []

    # 1. Rolling Power Surge Anomaly (power > mean + 3 * std)
    if len(power_history) >= 5:
        mean_p = np.mean(power_history)
        std_p = np.std(power_history)
        # Avoid false alarms on very steady loads with tiny std
        if std_p > 5.0 and power > (mean_p + 3.0 * std_p):
            anomalies.append("POWER SURGE")

    # 2. Voltage Threshold Anomalies
    if voltage < 185.0:
        anomalies.append("UNDER VOLTAGE")
    elif voltage > 255.0:
        anomalies.append("OVER VOLTAGE")

    # 3. Battery Drop Rate Anomaly
    # Expected drop rate based on net load and solar generation
    net_power = power - solar
    expected_drop = net_power * 0.05 if net_power > 0 else net_power * 0.025
    
    # Avoid false positives at battery boundary limits (10% and 100% SOC)
    if battery == 100.0 or battery == 10.0:
        expected_drop = battery_drop_rate

    if battery_drop_rate - expected_drop > 1.0:
        anomalies.append("BATTERY FAULT")

    if not anomalies:
        return "NORMAL"

    return " | ".join(anomalies)


def predict_maintenance(
    temperature: float, 
    voltage_history: list[float], 
    power_history: list[float], 
    battery: float
) -> tuple[int, str]:
    """
    Calculate predictive maintenance risk level (0-100) and status category.
    stresses: Temperature, Voltage stability, Power fluctuation, Battery SOC stress.
    """
    risk = 0.0

    # 1. Temperature Stress (up to 30 points)
    # High heat above 35°C adds risk
    if temperature > 35.0:
        risk += min(30.0, (temperature - 35.0) * 3.0)

    # 2. Voltage Instability Stress (up to 25 points)
    if len(voltage_history) >= 2:
        vol_std = np.std(voltage_history)
        # Voltage fluctuations > 2V indicate noise or instability
        risk += min(25.0, vol_std * 5.0)

    # 3. Power Fluctuation Stress (up to 20 points)
    if len(power_history) >= 2:
        pow_std = np.std(power_history)
        # Large load spikes add stress to active power electronics
        risk += min(20.0, (pow_std / 50.0) * 20.0)

    # 4. Battery SOC Stress (up to 25 points)
    # Extreme depletion adds rapid wear
    if battery < 30.0:
        risk += 15.0
    if battery < 15.0:
        risk += 10.0

    risk_score = int(round(risk))
    risk_score = max(0, min(100, risk_score))

    # Categories Table
    if risk_score > 80:
        status = "CRITICAL"
    elif risk_score > 60:
        status = "HIGH"
    elif risk_score > 30:
        status = "MEDIUM"
    else:
        status = "LOW"

    return risk_score, status
