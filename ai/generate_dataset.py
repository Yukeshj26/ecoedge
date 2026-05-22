import pandas as pd
import random

rows = []

battery = 90

for i in range(1000):

    solar = random.randint(10, 100)
    load = random.randint(5, 60)

    battery += (solar - load) * 0.02
    battery = max(0, min(100, battery))

    voltage = 10.5 + (battery / 100) * 2.1

    power = voltage * (load / voltage)

    csi = (
        battery * 0.4 +
        solar * 0.3 +
        (100 - load) * 0.2 +
        10
    )

    backup_time = (
        battery / max(load, 1)
    ) * 10

    rows.append({
        "battery": battery,
        "solar": solar,
        "load": load,
        "voltage": voltage,
        "power": power,
        "csi": csi,
        "backup_time": backup_time
    })

df = pd.DataFrame(rows)

df.to_csv(
    "energy_dataset.csv",
    index=False
)

print(df.head())