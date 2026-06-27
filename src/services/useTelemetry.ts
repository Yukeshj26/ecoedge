"use client";

import { useEffect, useState } from "react";

export default function useTelemetry() {
  const [latest, setLatest] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        // ====================================================
        // FETCH LATEST TELEMETRY, ANALYTICS, & PREDICTIONS
        // ====================================================
        const [telemetryRes, analyticsRes, predictionRes] = await Promise.all([
          fetch("/api/telemetry/latest"),
          fetch("/api/analytics/status"),
          fetch("/api/ai/prediction/latest?model=lstm"),
        ]);

        const [telemetryJson, analyticsJson, predictionJson] = await Promise.all([
          telemetryRes.json(),
          analyticsRes.json(),
          predictionRes.json(),
        ]);

        let mergedData: any = {};
        
        if (telemetryJson.success && telemetryJson.data) {
          mergedData = { ...mergedData, ...telemetryJson.data };
        }
        
        if (analyticsJson.success && analyticsJson.data) {
          mergedData = { ...mergedData, ...analyticsJson.data };
        }
        
        if (predictionJson.success && predictionJson.data) {
          mergedData.prediction = predictionJson.data.backup_time;
          mergedData.predicted_power = predictionJson.data.predicted_power;
          mergedData.model_version = predictionJson.data.model_version;
        }

        // Add computed status
        if (typeof mergedData.csi !== "undefined") {
          mergedData.status =
            mergedData.csi >= 85
              ? "OPTIMAL"
              : mergedData.csi >= 60
              ? "WARNING"
              : "CRITICAL";
        } else {
          mergedData.status = "WAITING";
        }

        setLatest(mergedData);

        // ====================================================
        // FETCH HISTORY
        // ====================================================
        const historyRes = await fetch("/api/telemetry/history");
        const historyJson = await historyRes.json();

        if (historyJson.success && historyJson.data) {
          const powerData = historyJson.data
            .filter((item: any) => item._field === "voltage")
            .map((item: any) => ({
              time: new Date(item._time).toLocaleTimeString(),
              power: Number(item._value),
            }));

          setHistory(powerData);
        }
      } catch (err) {
        console.error("Telemetry fetch error in hook:", err);
      }
    };

    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 3000);
    return () => clearInterval(interval);
  }, []);

  return {
    latest,
    history,
  };
}