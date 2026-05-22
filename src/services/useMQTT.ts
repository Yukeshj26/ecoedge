"use client";

import { useEffect, useState } from "react";

export default function useMQTT() {

  const [data, setData] = useState<any>(null);

  useEffect(() => {

    const interval = setInterval(async () => {

      const res = await fetch(
        "/api/telemetry"
      );

      const json = await res.json();

      setData(json);

    }, 2000);

    return () => clearInterval(interval);

  }, []);

  return data;
}