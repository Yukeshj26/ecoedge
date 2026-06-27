export interface Alert {
  id: string;
  timestamp: string;
  resolvedAt?: string;
  source: string; // e.g., "School Grid", "Village Grid", "Clinic Grid"
  type: "VOLTAGE_INSTABILITY" | "LOW_BATTERY" | "POWER_SURGE" | "MAINTENANCE_CRITICAL" | "AI_ANOMALY";
  severity: "CRITICAL" | "WARNING" | "INFO";
  message: string;
  status: "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED";
  value?: number;
}

export let latestTelemetry = {
  voltage: 0,
  current: 0,
  power: 0,
  battery: 0,
  solarInput: 0,
  load: 0,
  relay: false,
  csi: 0,
  status: "WAITING",
  temperature: 25.0,
  humidity: 50.0,
  gridPresent: true,
};

// In-memory store for tracking real-time and historical microgrid alerts
export let alertsStore: Alert[] = [
  {
    id: "alert-1",
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(), // 2 hours ago
    source: "School Grid",
    type: "POWER_SURGE",
    severity: "CRITICAL",
    message: "Critical power surge: 940W demand exceeded safe threshold of 900W.",
    status: "ACKNOWLEDGED",
    value: 940,
  },
  {
    id: "alert-2",
    timestamp: new Date(Date.now() - 3600000 * 4).toISOString(), // 4 hours ago
    resolvedAt: new Date(Date.now() - 3600000 * 3.5).toISOString(),
    source: "Village Grid",
    type: "LOW_BATTERY",
    severity: "WARNING",
    message: "Low battery backup: battery charge dipped to 28%.",
    status: "RESOLVED",
    value: 28,
  },
  {
    id: "alert-3",
    timestamp: new Date(Date.now() - 3600000 * 6).toISOString(), // 6 hours ago
    source: "Clinic Grid",
    type: "VOLTAGE_INSTABILITY",
    severity: "CRITICAL",
    message: "Critical voltage drop detected: grid voltage hit 172V.",
    status: "ACTIVE",
    value: 172,
  },
];