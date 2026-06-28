"use client";

import { useEffect, useState } from "react";

export default function useTelemetry() {
  const [latest, setLatest] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [isSimulating, setIsSimulating] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ecoedge_demo_simulation") === "true";
    }
    return false;
  });

  const toggleSimulation = (val: boolean) => {
    setIsSimulating(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("ecoedge_demo_simulation", String(val));
    }
  };

  useEffect(() => {
    if (isSimulating) {
      const runSimulation = () => {
        const timeStr = new Date().toLocaleTimeString();
        const power_val = Math.max(50, Math.round(180.0 + Math.sin(Date.now() / 8000) * 60 + (Math.random() - 0.5) * 10));
        const battery_val = Math.max(20, Math.min(100, Math.round(75.0 + Math.sin(Date.now() / 30000) * 15)));
        const volt_val = Number((225.0 + Math.sin(Date.now() / 5000) * 5 + (Math.random() - 0.5) * 1.5).toFixed(1));
        const solar_val = Math.round(power_val * 0.8);
        const load_val = Math.round(power_val * 1.1);
        const csi_val = Math.round(75 + (battery_val / 100 * 15) + (solar_val > 150 ? 10 : 0));
        
        const simData = {
          voltage: volt_val,
          dc_voltage: Number((12.2 + Math.sin(Date.now() / 15000) * 0.5).toFixed(1)),
          battery: battery_val,
          power: power_val,
          current: Number((power_val / volt_val).toFixed(2)),
          temperature: Number((24.5 + Math.sin(Date.now() / 20000) * 1.0).toFixed(1)),
          humidity: Number((52.0 + Math.cos(Date.now() / 20000) * 2.0).toFixed(1)),
          relay: Math.sin(Date.now() / 10000) > 0.5,
          gridPresent: true,
          solar: solar_val,
          load: load_val,
          csi: csi_val,
          anomaly: "NORMAL",
          maintenance: { risk: 15, status: "LOW" },
          prediction: Number(((battery_val / 100 * 2000) / power_val).toFixed(2)),
          predicted_power: power_val,
          model_version: "LSTM_Simulated",
          status: csi_val >= 85 ? "OPTIMAL" : csi_val >= 60 ? "WARNING" : "CRITICAL"
        };
        
        setLatest(simData);
        setHistory((prev) => {
          // Pre-populate if empty
          if (prev.length === 0) {
            const initialHistory = [];
            const now = Date.now();
            for (let i = 15; i >= 0; i--) {
              const timeOffset = now - i * 3000;
              const timeStrOffset = new Date(timeOffset).toLocaleTimeString();
              const volt_val_offset = Number((225.0 + Math.sin(timeOffset / 5000) * 5).toFixed(1));
              initialHistory.push({ time: timeStrOffset, power: volt_val_offset });
            }
            return initialHistory;
          }
          const next = [...prev, { time: timeStr, power: volt_val }];
          if (next.length > 20) {
            return next.slice(next.length - 20);
          }
          return next;
        });
      };
      
      runSimulation();
      const interval = setInterval(runSimulation, 3000);
      return () => clearInterval(interval);
    }

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
  }, [isSimulating]);

  return {
    latest,
    history,
    isSimulating,
    toggleSimulation,
  };
}