import numpy as np
import pandas as pd
import os

def generate_large_dataset(num_hours=150000, output_filename="Renewable_energy_dataset_large.csv"):
    print(f"Generating high-fidelity time-series dataset ({num_hours} steps)...")
    
    np.random.seed(42)
    
    # 1. Timeline (hourly steps)
    time_indices = np.arange(num_hours)
    hours_of_day = time_indices % 24
    days_of_week = (time_indices // 24) % 7
    
    # 2. Temperature Cycle (diurnal: peak at 14:00, low at 05:00)
    # Average temp 25°C, daily fluctuation +/- 8°C + random noise + seasonal drift
    temp_base = 25.0
    temp_daily = 8.0 * np.sin(2 * np.pi * (hours_of_day - 8) / 24)
    temp_noise = np.random.normal(0, 1.5, num_hours)
    temp_seasonal = 5.0 * np.sin(2 * np.pi * time_indices / (24 * 365))
    temperature = temp_base + temp_daily + temp_noise + temp_seasonal
    
    # 3. Humidity (inversely proportional to temperature)
    humidity_base = 60.0
    humidity_daily = -15.0 * np.sin(2 * np.pi * (hours_of_day - 8) / 24)
    humidity_noise = np.random.normal(0, 3.0, num_hours)
    humidity = np.clip(humidity_base + humidity_daily + humidity_noise, 15.0, 100.0)
    
    # 4. Solar Irradiance & Solar PV Output
    # Active from 06:00 to 18:00, peak solar output around 12:00
    solar_base = np.zeros(num_hours)
    daylight_mask = (hours_of_day >= 6) & (hours_of_day <= 18)
    # Sine wave for active daylight hours
    solar_base[daylight_mask] = 400.0 * np.sin(np.pi * (hours_of_day[daylight_mask] - 6) / 12)
    # Weather factors (cloudy days simulated via noise correlation)
    weather_factor = np.clip(np.random.normal(0.9, 0.15, num_hours), 0.0, 1.0)
    solar_pv_output = solar_base * weather_factor
    
    # 5. Grid Load Demand (Power)
    # Double peak load profile: Morning peak (07:00-09:00) and Evening peak (18:00-21:00)
    load_base = 150.0 # Base standby consumption
    load_morning = 120.0 * np.exp(-((hours_of_day - 8) ** 2) / 3.0)
    load_evening = 200.0 * np.exp(-((hours_of_day - 19.5) ** 2) / 4.0)
    load_noise = np.random.normal(0, 20.0, num_hours)
    grid_load_demand = np.clip(load_base + load_morning + load_evening + load_noise, 50.0, 500.0)
    
    # 6. Battery State of Charge (SOC) Cycle
    # Charges during solar surplus, discharges during evening peak loads
    battery_soc = np.zeros(num_hours)
    soc = 75.0 # Initial battery SOC
    
    for i in range(num_hours):
        net_energy = solar_pv_output[i] - grid_load_demand[i]
        # Charge/discharge rates scaling
        if net_energy > 0:
            soc += net_energy * 0.025 # Charge
        else:
            soc += net_energy * 0.05  # Discharge
        soc = max(10.0, min(100.0, soc))
        battery_soc[i] = soc

    # 7. Grid Voltage (Volt)
    # Fluctuates slightly around 230V, droops under high load, spikes slightly during solar peaks
    voltage_base = 230.0
    voltage_droop = -0.015 * grid_load_demand
    voltage_boost = 0.005 * solar_pv_output
    voltage_noise = np.random.normal(0, 1.2, num_hours)
    voltage = np.clip(voltage_base + voltage_droop + voltage_boost + voltage_noise, 185.0, 255.0)

    # 8. Create DataFrame matching original dataset column names structure
    data = {
        "timestamp": pd.date_range(start="2026-01-01", periods=num_hours, freq="h").strftime("%Y-%m-%d %H:%M:%S"),
        "solar": np.round(solar_pv_output, 2),
        "temperature": np.round(temperature, 2),
        "humidity": np.round(humidity, 2),
        "power": np.round(grid_load_demand, 2),
        "voltage": np.round(voltage, 2),
        "battery": np.round(battery_soc, 2),
        "hour_sin": np.round(np.sin(2 * np.pi * hours_of_day / 24.0), 4),
        "hour_cos": np.round(np.cos(2 * np.pi * hours_of_day / 24.0), 4),
        "day_sin": np.round(np.sin(2 * np.pi * days_of_week / 7.0), 4),
        "day_cos": np.round(np.cos(2 * np.pi * days_of_week / 7.0), 4)
    }
    
    df = pd.DataFrame(data)
    
    # Save file to the AI directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(script_dir, output_filename)
    df.to_csv(output_path, index=False)
    print(f"SUCCESS: Large-scale high-fidelity energy dataset generated at {output_path}")
    print(df.head(10))

if __name__ == "__main__":
    generate_large_dataset()
