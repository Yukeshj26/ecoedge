import time
import requests
from ai.config import INFLUX_URL, INFLUX_TOKEN, INFLUX_ORG, INFLUX_BUCKET

def write_prediction(device_id: str, predicted_power: float, backup_time: float, model_version: str):
    """
    Writes LSTM predictions to InfluxDB predictions measurement.
    """
    url = f"{INFLUX_URL}/api/v2/write?org={INFLUX_ORG}&bucket={INFLUX_BUCKET}&precision=ms"
    headers = {
        "Authorization": f"Token {INFLUX_TOKEN}",
        "Content-Type": "text/plain; charset=utf-8"
    }
    
    timestamp = int(time.time() * 1000)
    
    # Predictions schema: predicted_power, backup_time, model_version
    line = (
        f"predictions,device={device_id} "
        f"predicted_power={predicted_power:.2f},"
        f"backup_time={backup_time:.2f},"
        f'model_version="{model_version}" '
        f"{timestamp}"
    )
    
    try:
        response = requests.post(url, data=line, headers=headers, timeout=5)
        if response.status_code not in (204, 200):
            print(f"[DB Writer] Error writing prediction (status code {response.status_code}): {response.text}")
        else:
            print(f"[DB Writer] Successfully wrote prediction: power={predicted_power:.2f}W, backup={backup_time:.2f}h")
    except Exception as e:
        print(f"[DB Writer] Network error writing prediction to InfluxDB: {e}")


def write_analytics(device_id: str, csi: int, anomaly: str, maintenance_risk: int, status: str):
    """
    Writes calculated system analytics to InfluxDB analytics measurement.
    """
    url = f"{INFLUX_URL}/api/v2/write?org={INFLUX_ORG}&bucket={INFLUX_BUCKET}&precision=ms"
    headers = {
        "Authorization": f"Token {INFLUX_TOKEN}",
        "Content-Type": "text/plain; charset=utf-8"
    }
    
    timestamp = int(time.time() * 1000)
    
    # Analytics schema: csi, anomaly, maintenance_risk, status
    line = (
        f"analytics,device={device_id} "
        f"csi={csi},"
        f'anomaly="{anomaly}",'
        f"maintenance_risk={maintenance_risk},"
        f'status="{status}" '
        f"{timestamp}"
    )
    
    try:
        response = requests.post(url, data=line, headers=headers, timeout=5)
        if response.status_code not in (204, 200):
            print(f"[DB Writer] Error writing analytics (status code {response.status_code}): {response.text}")
        else:
            print(f"[DB Writer] Successfully wrote analytics: csi={csi}, anomaly={anomaly}, risk={maintenance_risk}% ({status})")
    except Exception as e:
        print(f"[DB Writer] Network error writing analytics to InfluxDB: {e}")
