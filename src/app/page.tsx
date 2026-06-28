"use client";

import Sidebar from "@/components/dashboard/Sidebar";
import Header from "@/components/dashboard/Header";
import StatCard from "@/components/cards/StatCard";
import PowerChart from "@/components/charts/PowerChart";
import DigitalTwin from "@/components/digitaltwin/DigitalTwin";
import useTelemetry from "@/services/useTelemetry";
import usePrediction from "@/services/usePrediction";
export default function Home() {

  const {
    latest,
    history,
    isSimulating,
    toggleSimulation
  } = useTelemetry();

  const prediction =
  usePrediction(latest);

  const anomaly = latest?.anomaly || "NORMAL";

  return (
    <main className="flex bg-gradient-light text-slate-900 min-h-screen">

      <Sidebar />

      <section className="flex-1 p-8">

        <Header isSimulating={isSimulating} toggleSimulation={toggleSimulation} />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">

  <StatCard
    title="Voltage (AC)"
    value={
      latest
        ? `${latest.voltage}V`
        : "..."
    }
    color="text-cyan-600"
  />

  <StatCard
    title="DC Voltage"
    value={
      latest
        ? `${latest.dc_voltage !== undefined ? Number(latest.dc_voltage).toFixed(1) : "0.0"}V`
        : "..."
    }
    color="text-indigo-600"
  />

  <StatCard
    title="Battery"
    value={
      latest
        ? `${latest.battery}%`
        : "..."
    }
    color="text-green-600"
  />

  <StatCard
    title="CSI Score"
    value={
      latest
        ? `${latest.csi}`
        : "..."
    }
    color="text-amber-600"
  />

  <StatCard
    title="Power"
    value={
      latest
        ? `${latest.power}W`
        : "..."
    }
    color="text-pink-600"
  />

<StatCard title="System Status"
 value={ latest ? latest.status : "WAITING" }
 color={ latest ? latest.status === "OPTIMAL" ? "text-green-600" : latest.status === "WARNING" ? "text-amber-600" : "text-red-600" : "text-slate-500" } />
  <StatCard
  title="Predicted Backup"
  value={
    prediction
      ? `${prediction.toFixed(1)} hrs`
      : "Predicting..."
  }
  color="text-orange-600"
  />
  <StatCard
  title="AI Anomaly"
  value={anomaly}
  color={
    anomaly === "NORMAL"
      ? "text-green-600"
      : "text-red-600"
  }
  />
  <StatCard
    title="Maintenance Risk"
    value={
      latest?.maintenance?.status || "LOW"
    }
    color={
      latest?.maintenance?.status === "CRITICAL"
        ? "text-red-600"
        : latest?.maintenance?.status === "MEDIUM"
        ? "text-amber-600"
        : "text-green-600"
    }
  />


</div>

        <PowerChart data={history} />
        <DigitalTwin telemetry={latest} />
      </section>

    </main>
  );
}