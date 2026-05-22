"use client";

import { useEffect, useState } from "react";

export default function usePrediction(latest: any) {
  const [prediction, setPrediction] = useState<number | null>(null);

  useEffect(() => {
    if (!latest) return;
    if (latest.prediction !== undefined) {
      setPrediction(Number(latest.prediction));
    }
  }, [latest]);

  return prediction;
}