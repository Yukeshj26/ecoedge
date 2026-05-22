"use client";

import { useEffect, useState } from "react";

export default function useAnomaly(telemetry: any) {
  const [anomaly, setAnomaly] = useState("NORMAL");

  useEffect(() => {
    if (!telemetry) return;

    const detect = async () => {
      try {
        const anomalyServerUrl = process.env.NEXT_PUBLIC_ANOMALY_SERVER_URL || "http://localhost:5001";
        const res = await fetch(`${anomalyServerUrl}/detect`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            power: telemetry.power,
          }),
        });

        const data = await res.json();

        setAnomaly(data.anomaly ? "ANOMALY" : "NORMAL");
      } catch (err) {
        console.error("Anomaly fetch failed:", err);
      }
    };

    detect();
  }, [telemetry]);

  return anomaly;
}