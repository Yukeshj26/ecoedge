import { alertsStore, Alert } from "./store";

// Map of device ID to human readable grid names
export const GRID_MAP: Record<string, string> = {
  "device01": "School Grid",
  "device02": "Village Grid",
  "device03": "Clinic Grid"
};

export function getGridName(deviceId?: string): string {
  if (!deviceId) return "School Grid";
  return GRID_MAP[deviceId] || deviceId;
}

/**
 * Checks incoming telemetry, generates warnings/critical alerts for abnormal thresholds,
 * and automatically resolves existing active alerts if the telemetry returns to normal.
 */
export function processTelemetryAlerts(telemetry: any) {
  if (!telemetry) return;

  const deviceId = telemetry.device || "device01";
  const sourceName = getGridName(deviceId);

  const voltage = Number(telemetry.voltage) || 0;
  const battery = Number(telemetry.battery) || 0;
  const power = Number(telemetry.power) || 0;

  // Fetch computed CSI and statuses if available
  const csi = Number(telemetry.csi) || 100;
  const aiAnomaly = telemetry.anomaly; // can be "ANOMALY" or "NORMAL"
  const maintenanceStatus = telemetry.maintenance?.status; // "CRITICAL", "MEDIUM", "LOW"

  // Define dynamic thresholds matching simulator properties
  const checks: {
    type: Alert["type"];
    severity: Alert["severity"];
    condition: boolean;
    message: string;
    value: number;
  }[] = [
    {
      type: "VOLTAGE_INSTABILITY",
      severity: "CRITICAL",
      condition: voltage > 0 && (voltage < 180 || voltage > 260),
      message: `Critical voltage disruption: grid voltage spiked to a highly dangerous level at ${voltage.toFixed(1)}V.`,
      value: voltage
    },
    {
      type: "VOLTAGE_INSTABILITY",
      severity: "WARNING",
      condition: voltage > 0 && ((voltage >= 180 && voltage < 210) || (voltage > 250 && voltage <= 260)),
      message: `Grid voltage drop: voltage levels fluctuated to ${voltage.toFixed(1)}V.`,
      value: voltage
    },
    {
      type: "LOW_BATTERY",
      severity: "CRITICAL",
      condition: battery > 0 && battery < 15,
      message: `Critical battery state: reserve depleted to ${battery.toFixed(0)}%. System shutdown is imminent.`,
      value: battery
    },
    {
      type: "LOW_BATTERY",
      severity: "WARNING",
      condition: battery > 0 && battery >= 15 && battery < 30,
      message: `Low battery level: remaining grid reserve dipped to ${battery.toFixed(0)}%.`,
      value: battery
    },
    {
      type: "POWER_SURGE",
      severity: "CRITICAL",
      condition: power > 900,
      message: `Critical overload: severe power surge reached ${power.toFixed(0)}W. Safe limit is 900W.`,
      value: power
    },
    {
      type: "POWER_SURGE",
      severity: "WARNING",
      condition: power > 450 && power <= 900,
      message: `High load alert: total microgrid power draw spiked to ${power.toFixed(0)}W.`,
      value: power
    },
    {
      type: "AI_ANOMALY",
      severity: "CRITICAL",
      condition: aiAnomaly === "ANOMALY" || aiAnomaly === "VOLTAGE DROP | LOW BATTERY" || aiAnomaly === "VOLTAGE DROP" || aiAnomaly === "LOW BATTERY" || aiAnomaly === "POWER SURGE",
      message: `AI Anomaly: neural engine detected unexpected system telemetry pattern (${aiAnomaly}).`,
      value: power
    },
    {
      type: "MAINTENANCE_CRITICAL",
      severity: "CRITICAL",
      condition: maintenanceStatus === "CRITICAL",
      message: `Critical maintenance risk: composite equipment health index dropped significantly.`,
      value: csi
    },
    {
      type: "MAINTENANCE_CRITICAL",
      severity: "WARNING",
      condition: maintenanceStatus === "MEDIUM",
      message: `Predictive maintenance flag: moderate microgrid hardware stress detected.`,
      value: csi
    }
  ];

  checks.forEach((check) => {
    // Search for active or acknowledged alert of the same type on the same grid source
    const existingIndex = alertsStore.findIndex(
      (a) => a.source === sourceName && a.type === check.type && (a.status === "ACTIVE" || a.status === "ACKNOWLEDGED")
    );

    if (check.condition) {
      if (existingIndex === -1) {
        // If alert is not already active/acknowledged, trigger a new alert
        const newAlert: Alert = {
          id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date().toISOString(),
          source: sourceName,
          type: check.type,
          severity: check.severity,
          message: check.message,
          status: "ACTIVE",
          value: check.value
        };
        // Insert at the top of the array
        alertsStore.unshift(newAlert);
      } else {
        // Keep the value and description of the current issue updated
        alertsStore[existingIndex].value = check.value;
        alertsStore[existingIndex].message = check.message;
        // Keep it aligned to its worst severity
        if (check.severity === "CRITICAL" && alertsStore[existingIndex].severity !== "CRITICAL") {
          alertsStore[existingIndex].severity = "CRITICAL";
        }
      }
    } else {
      // Auto-resolution: if the threshold condition went back to normal, automatically resolve active/acknowledged issues
      if (existingIndex !== -1) {
        const existing = alertsStore[existingIndex];
        // Ensure that we only auto-resolve if no higher critical/warning conditions of this type remain
        // In our case, we can just resolve it
        existing.status = "RESOLVED";
        existing.resolvedAt = new Date().toISOString();
      }
    }
  });
}
