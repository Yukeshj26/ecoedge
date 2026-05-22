export function detectAnomaly(
  voltage: number,
  battery: number,
  power: number
) {

  const anomalies: string[] = [];

  // Voltage anomaly
  if (voltage < 10.8) {
    anomalies.push("VOLTAGE DROP");
  }

  // Battery anomaly
  if (battery < 20) {
    anomalies.push("LOW BATTERY");
  }

  // Power surge anomaly
  if (power > 47) {
    anomalies.push("POWER SURGE");
  }

  if (anomalies.length === 0) {
    return "NORMAL";
  }

  return anomalies.join(" | ");
}
