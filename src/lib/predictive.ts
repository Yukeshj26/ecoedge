export function predictMaintenance(
  battery: number,
  voltage: number,
  power: number
) {

  let risk = 0;

  // Battery degradation
  if (battery < 50) {
    risk += 30;
  }

  if (battery < 30) {
    risk += 30;
  }

  // Voltage instability
  if (voltage < 11.5) {
    risk += 20;
  }

  // High power stress
  if (power > 40) {
    risk += 20;
  }

  // Risk classification
  let status = "LOW";

  if (risk >= 70) {
    status = "CRITICAL";
  }
  else if (risk >= 40) {
    status = "MEDIUM";
  }

  return {
    risk,
    status
  };
}
