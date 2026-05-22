export function calculateCSI(
  voltage: number,
  battery: number,
  power: number
) {

  // Voltage stability score
  const voltageScore =
    voltage >= 12
      ? 100
      : voltage >= 11
      ? 75
      : 40;

  // Battery health score
  const batteryScore = battery;

  // Power efficiency score
  const powerScore =
    power <= 20
      ? 100
      : power <= 35
      ? 80
      : 60;

  // Weighted CSI calculation
  const csi =
    voltageScore * 0.3 +
    batteryScore * 0.4 +
    powerScore * 0.3;

  return Math.round(csi);
}
