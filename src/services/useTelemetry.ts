"use client";

import { useEffect, useState } from "react";

export default function useTelemetry() {

  const [latest, setLatest] =
    useState<any>(null);

  const [history, setHistory] =
    useState<any[]>([]);

  useEffect(() => {

    const fetchTelemetry = async () => {

      try {

        // =========================
        // FETCH LATEST
        // =========================

        const latestRes = await fetch(
          "/api/telemetry/latest"
        );

        const latestJson =
          await latestRes.json();

        console.log("LATEST:", latestJson);

        if (latestJson.success) {

          const data = latestJson.data;

          // Add computed status
          data.status =
            data.csi >= 85
              ? "OPTIMAL"
              : data.csi >= 60
              ? "WARNING"
              : "CRITICAL";

          setLatest(data);
        }

        // =========================
        // FETCH HISTORY
        // =========================

        const historyRes = await fetch(
          "/api/telemetry/history"
        );

        const historyJson =
          await historyRes.json();

        console.log("HISTORY:", historyJson);

        if (historyJson.success) {

          const powerData =
            historyJson.data
              .filter((item: any) => item._field === "voltage")
.map((item: any) => ({
  time: new Date(item._time).toLocaleTimeString(),
  power: Number(item._value),
}));

          console.log(
            "POWER DATA:",
            powerData
          );

          setHistory(powerData);
        }

      } catch (err) {

        console.error(
          "Telemetry Error:",
          err
        );

      }
    };

    fetchTelemetry();

    const interval =
      setInterval(fetchTelemetry, 3000);

    return () =>
      clearInterval(interval);

  }, []);

  return {
    latest,
    history,
  };
}