"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/dashboard/Sidebar";

import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

// Maximum points rendered in the chart regardless of API response size
const MAX_POINTS = 50;

type TimeWindow = "5m" | "15m" | "30m" | "1h";

const WINDOW_LABELS: Record<TimeWindow, string> = {
  "5m": "Last 5 min",
  "15m": "Last 15 min",
  "30m": "Last 30 min",
  "1h": "Last 1 hr",
};

// CSI status classification helper
function csiStatus(val: number): { label: string; color: string } {
  if (val >= 80) return { label: "Excellent", color: "text-emerald-500" };
  if (val >= 60) return { label: "Good", color: "text-cyan-500" };
  if (val >= 40) return { label: "Moderate", color: "text-amber-500" };
  return { label: "Poor", color: "text-red-500" };
}

export default function AnalyticsPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [csiHistory, setCsiHistory] = useState<any[]>([]);
  const [window, setWindow] = useState<TimeWindow>("15m");

  const [stats, setStats] = useState({
    avgPower: 0,
    avgVoltage: 0,
    avgBattery: 0,
    peakPower: 0,
  });

  const [csiStats, setCsiStats] = useState({
    current: 0,
    average: 0,
    min: 0,
    max: 0,
  });

  useEffect(() => {
    const isSimulating = typeof window !== "undefined" && localStorage.getItem("ecoedge_demo_simulation") === "true";
    if (isSimulating) {
      const runSim = () => {
        const now = Date.now();
        const finalData = [];
        const csiData = [];
        
        // Generate MAX_POINTS historical data points
        for (let i = MAX_POINTS - 1; i >= 0; i--) {
          const timeOffset = now - i * 15000; // 15s interval
          const power_val = Math.max(50, Math.round(180.0 + Math.sin(timeOffset / 120000) * 60 + (Math.sin(timeOffset / 15000) * 15)));
          const volt_val = Number((225.0 + Math.sin(timeOffset / 60000) * 5 + Math.sin(timeOffset / 10000) * 1).toFixed(1));
          const battery_val = Math.max(20, Math.min(100, Math.round(75.0 + Math.sin(timeOffset / 600000) * 15)));
          const csi_val = Math.round(75 + (battery_val / 100 * 15) + (power_val < 150 ? 5 : 0));
          const risk_val = Math.round(15 + Math.sin(timeOffset / 300000) * 5);
          
          finalData.push({
            time: timeOffset,
            power: power_val,
            voltage: volt_val,
            battery: battery_val
          });
          
          csiData.push({
            time: timeOffset,
            csi: csi_val,
            maintenance_risk: risk_val
          });
        }
        
        setHistory(finalData);
        setCsiHistory(csiData);
        
        // Compute stats
        const avgPower = finalData.reduce((a, b) => a + b.power, 0) / finalData.length;
        const avgVoltage = finalData.reduce((a, b) => a + b.voltage, 0) / finalData.length;
        const avgBattery = finalData.reduce((a, b) => a + b.battery, 0) / finalData.length;
        const peakPower = Math.max(...finalData.map((d) => d.power));
        setStats({ avgPower, avgVoltage, avgBattery, peakPower });
        
        const csiValues = csiData.map((d: any) => d.csi);
        const current = csiValues[csiValues.length - 1];
        const average = csiValues.reduce((a: number, b: number) => a + b, 0) / csiValues.length;
        const min = Math.min(...csiValues);
        const max = Math.max(...csiValues);
        setCsiStats({ current, average, min, max });
      };
      
      runSim();
      const interval = setInterval(runSim, 5000);
      return () => clearInterval(interval);
    }

    const fetchAnalytics = async () => {
      try {
        // Fetch telemetry history and CSI history in parallel
        const [telRes, csiRes] = await Promise.all([
          fetch(`/api/telemetry/history?window=${window}`),
          fetch(`/api/analytics/history?window=${window}`),
        ]);
        const [telJson, csiJson] = await Promise.all([
          telRes.json(),
          csiRes.json(),
        ]);

        // ── Telemetry Processing ──
        if (telJson.success && telJson.data) {
          const normalized = telJson.data.map((d: any) => ({
            time: new Date(d._time).getTime(),
            field: d._field,
            value: Number(d._value),
          }));

          const grouped = new Map<number, any>();
          normalized.forEach((d: any) => {
            if (!grouped.has(d.time)) {
              grouped.set(d.time, { time: d.time, power: 0, voltage: 0, battery: 0 });
            }
            const existing = grouped.get(d.time);
            if (d.field === "power") existing.power = d.value;
            if (d.field === "voltage") existing.voltage = d.value;
            if (d.field === "battery") existing.battery = d.value;
          });

          const finalData = Array.from(grouped.values())
            .sort((a, b) => a.time - b.time)
            .slice(-MAX_POINTS);

          setHistory(finalData);

          if (finalData.length > 0) {
            const avgPower = finalData.reduce((a, b) => a + b.power, 0) / finalData.length;
            const avgVoltage = finalData.reduce((a, b) => a + b.voltage, 0) / finalData.length;
            const avgBattery = finalData.reduce((a, b) => a + b.battery, 0) / finalData.length;
            const peakPower = Math.max(...finalData.map((d) => d.power));
            setStats({ avgPower, avgVoltage, avgBattery, peakPower });
          }
        }

        // ── CSI History Processing ──
        if (csiJson.success && csiJson.data) {
          const csiData = csiJson.data
            .sort((a: any, b: any) => a.time - b.time)
            .slice(-MAX_POINTS);

          setCsiHistory(csiData);

          if (csiData.length > 0) {
            const csiValues = csiData.map((d: any) => d.csi);
            const current = csiValues[csiValues.length - 1];
            const average = csiValues.reduce((a: number, b: number) => a + b, 0) / csiValues.length;
            const min = Math.min(...csiValues);
            const max = Math.max(...csiValues);
            setCsiStats({ current, average, min, max });
          }
        }
      } catch (err) {
        console.error("Analytics fetch error:", err);
      }
    };

    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 10000);
    return () => clearInterval(interval);
  }, [window]);

  const tickFormatter = (t: any) =>
    new Date(Number(t)).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  const csiStatusInfo = csiStatus(csiStats.current);

  return (
    <main className="flex min-h-screen bg-gradient-light text-slate-900">
      <Sidebar />

      <section className="flex-1 p-8">
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black mb-2 text-slate-800">Analytics</h1>
            <p className="text-slate-500 font-medium">
              Rural microgrid telemetry intelligence and historical performance monitoring
            </p>
          </div>

          {/* Time-window selector */}
          <div className="flex gap-2">
            {(Object.keys(WINDOW_LABELS) as TimeWindow[]).map((w) => (
              <button
                key={w}
                onClick={() => setWindow(w)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
                  window === w
                    ? "bg-pink-600 text-white shadow-sm font-black"
                    : "bg-slate-200 text-slate-600 border border-slate-300/40 hover:bg-slate-300 hover:text-slate-900"
                }`}
              >
                {WINDOW_LABELS[w]}
              </button>
            ))}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════
            CSI SECTION — Actual Values with Chart
            ═══════════════════════════════════════════════ */}
        <div className="mb-10">
          <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-3">
            <span className="inline-block w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
            Consumer Sustainability Index (CSI)
          </h2>

          {/* CSI Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-gradient-to-br from-white/90 to-emerald-100/60 backdrop-blur-md border-2 border-slate-200/50 rounded-2xl p-6 shadow-md hover:shadow-lg hover:border-emerald-200 transition-all duration-300">
              <p className="text-slate-500 font-extrabold uppercase tracking-wider text-xs mb-2">Current CSI</p>
              <h2 className={`text-4xl font-black ${csiStatusInfo.color}`}>
                {csiStats.current > 0 ? csiStats.current.toFixed(0) : "—"}
              </h2>
              <p className={`text-sm font-bold mt-1 ${csiStatusInfo.color}`}>
                {csiStats.current > 0 ? csiStatusInfo.label : "Waiting…"}
              </p>
            </div>

            <div className="bg-gradient-to-br from-white/90 to-cyan-100/60 backdrop-blur-md border-2 border-slate-200/50 rounded-2xl p-6 shadow-md hover:shadow-lg hover:border-cyan-200 transition-all duration-300">
              <p className="text-slate-500 font-extrabold uppercase tracking-wider text-xs mb-2">Avg CSI</p>
              <h2 className="text-4xl font-black text-cyan-600">
                {csiStats.average > 0 ? csiStats.average.toFixed(1) : "—"}
              </h2>
              <p className="text-sm font-bold mt-1 text-slate-400">
                over {WINDOW_LABELS[window].toLowerCase()}
              </p>
            </div>

            <div className="bg-gradient-to-br from-white/90 to-amber-100/60 backdrop-blur-md border-2 border-slate-200/50 rounded-2xl p-6 shadow-md hover:shadow-lg hover:border-amber-200 transition-all duration-300">
              <p className="text-slate-500 font-extrabold uppercase tracking-wider text-xs mb-2">Min CSI</p>
              <h2 className="text-4xl font-black text-amber-600">
                {csiStats.min > 0 ? csiStats.min.toFixed(0) : "—"}
              </h2>
              <p className="text-sm font-bold mt-1 text-slate-400">lowest recorded</p>
            </div>

            <div className="bg-gradient-to-br from-white/90 to-pink-100/60 backdrop-blur-md border-2 border-slate-200/50 rounded-2xl p-6 shadow-md hover:shadow-lg hover:border-pink-200 transition-all duration-300">
              <p className="text-slate-500 font-extrabold uppercase tracking-wider text-xs mb-2">Max CSI</p>
              <h2 className="text-4xl font-black text-pink-600">
                {csiStats.max > 0 ? csiStats.max.toFixed(0) : "—"}
              </h2>
              <p className="text-sm font-bold mt-1 text-slate-400">peak recorded</p>
            </div>
          </div>

          {/* CSI Area Chart — Full Width */}
          <div className="bg-gradient-to-br from-white/90 to-emerald-100/25 backdrop-blur-md border-2 border-slate-200/50 rounded-2xl p-6 shadow-md hover:border-emerald-200 transition-all duration-300 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-black text-slate-800">CSI Trend — Actual Values</h3>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                Live from InfluxDB
              </span>
            </div>

            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={csiHistory}>
                  <defs>
                    <linearGradient id="csiGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                      <stop offset="50%" stopColor="#06B6D4" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis
                    dataKey="time"
                    stroke="#475569"
                    tickFormatter={tickFormatter}
                    minTickGap={40}
                    tick={{ fill: "#475569", fontSize: 11, fontWeight: "bold" }}
                  />
                  <YAxis
                    stroke="#475569"
                    domain={[0, 100]}
                    tick={{ fill: "#475569", fontSize: 11, fontWeight: "bold" }}
                    tickFormatter={(v: number) => `${v}`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#FFFFFF",
                      border: "2px solid #10B981",
                      borderRadius: 12,
                      color: "#0F172A",
                      fontWeight: "bold",
                      boxShadow: "0 4px 12px rgba(16,185,129,0.15)",
                    }}
                    labelFormatter={tickFormatter}
                    formatter={(value: any) => [`${Number(value).toFixed(1)}`, "CSI Score"]}
                  />
                  {/* Reference lines for CSI classification zones */}
                  <ReferenceLine y={80} stroke="#10B981" strokeDasharray="6 4" strokeWidth={1.5} label={{ value: "Excellent", position: "right", fill: "#10B981", fontSize: 10, fontWeight: "bold" }} />
                  <ReferenceLine y={60} stroke="#06B6D4" strokeDasharray="6 4" strokeWidth={1.5} label={{ value: "Good", position: "right", fill: "#06B6D4", fontSize: 10, fontWeight: "bold" }} />
                  <ReferenceLine y={40} stroke="#F59E0B" strokeDasharray="6 4" strokeWidth={1.5} label={{ value: "Moderate", position: "right", fill: "#F59E0B", fontSize: 10, fontWeight: "bold" }} />
                  <Area
                    type="monotone"
                    dataKey="csi"
                    stroke="#10B981"
                    strokeWidth={3}
                    fill="url(#csiGradient)"
                    dot={{ r: 3, fill: "#10B981", stroke: "#fff", strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: "#10B981", stroke: "#fff", strokeWidth: 3 }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* CSI Breakdown Panel */}
          <div className="bg-gradient-to-br from-white/90 to-slate-100/60 backdrop-blur-md border-2 border-slate-200/50 rounded-2xl p-8 shadow-md">
            <h3 className="text-xl font-black text-slate-800 mb-5">CSI Formula Breakdown</h3>
            <p className="text-sm text-slate-500 font-medium mb-6">
              The Consumer Sustainability Index is a weighted composite of four metrics computed in real-time by the EcoEdge AI pipeline.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="bg-white/60 backdrop-blur-sm border border-emerald-200/50 p-5 rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-block w-3 h-3 rounded-full bg-emerald-500" />
                  <p className="text-slate-600 font-extrabold uppercase tracking-wider text-xs">Renewable Usage</p>
                </div>
                <h4 className="text-3xl font-black text-emerald-600">30%</h4>
                <p className="text-xs text-slate-400 mt-1 font-medium">Solar/Total load ratio</p>
              </div>

              <div className="bg-white/60 backdrop-blur-sm border border-cyan-200/50 p-5 rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-block w-3 h-3 rounded-full bg-cyan-500" />
                  <p className="text-slate-600 font-extrabold uppercase tracking-wider text-xs">Battery SOC</p>
                </div>
                <h4 className="text-3xl font-black text-cyan-600">25%</h4>
                <p className="text-xs text-slate-400 mt-1 font-medium">State of charge (0–100%)</p>
              </div>

              <div className="bg-white/60 backdrop-blur-sm border border-amber-200/50 p-5 rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-block w-3 h-3 rounded-full bg-amber-500" />
                  <p className="text-slate-600 font-extrabold uppercase tracking-wider text-xs">Load Stability</p>
                </div>
                <h4 className="text-3xl font-black text-amber-600">25%</h4>
                <p className="text-xs text-slate-400 mt-1 font-medium">Inverse coefficient of variation</p>
              </div>

              <div className="bg-white/60 backdrop-blur-sm border border-pink-200/50 p-5 rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-block w-3 h-3 rounded-full bg-pink-500" />
                  <p className="text-slate-600 font-extrabold uppercase tracking-wider text-xs">Grid Independence</p>
                </div>
                <h4 className="text-3xl font-black text-pink-600">20%</h4>
                <p className="text-xs text-slate-400 mt-1 font-medium">Off-grid = 100%, else solar ratio</p>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════
            EXISTING: Telemetry Stats Cards
            ═══════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <div className="bg-gradient-to-br from-white/90 to-pink-100/60 backdrop-blur-md border-2 border-slate-200/50 rounded-2xl p-6 shadow-md">
            <p className="text-slate-500 font-extrabold uppercase tracking-wider text-xs mb-2">Avg Power</p>
            <h2 className="text-3xl font-black text-pink-600">
              {stats.avgPower.toFixed(1)}W
            </h2>
          </div>

          <div className="bg-gradient-to-br from-white/90 to-cyan-100/60 backdrop-blur-md border-2 border-slate-200/50 rounded-2xl p-6 shadow-md">
            <p className="text-slate-500 font-extrabold uppercase tracking-wider text-xs mb-2">Avg Voltage</p>
            <h2 className="text-3xl font-black text-cyan-600">
              {stats.avgVoltage.toFixed(2)}V
            </h2>
          </div>

          <div className="bg-gradient-to-br from-white/90 to-green-100/60 backdrop-blur-md border-2 border-slate-200/50 rounded-2xl p-6 shadow-md">
            <p className="text-slate-500 font-extrabold uppercase tracking-wider text-xs mb-2">Avg Battery</p>
            <h2 className="text-3xl font-black text-green-600">
              {stats.avgBattery.toFixed(0)}%
            </h2>
          </div>

          <div className="bg-gradient-to-br from-white/90 to-amber-100/60 backdrop-blur-md border-2 border-slate-200/50 rounded-2xl p-6 shadow-md">
            <p className="text-slate-500 font-extrabold uppercase tracking-wider text-xs mb-2">Peak Power</p>
            <h2 className="text-3xl font-black text-amber-600">
              {stats.peakPower.toFixed(1)}W
            </h2>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════
            EXISTING: Power & Voltage Charts
            ═══════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Power Trend */}
          <div className="bg-gradient-to-br from-white/90 to-pink-100/35 backdrop-blur-md border-2 border-slate-200/50 rounded-2xl p-6 shadow-md text-slate-900">
            <h2 className="text-2xl font-black text-slate-800 mb-6">Power Consumption Trend</h2>

            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis
                    dataKey="time"
                    stroke="#475569"
                    tickFormatter={tickFormatter}
                    minTickGap={40}
                    tick={{ fill: "#475569", fontSize: 11, fontWeight: "bold" }}
                  />
                  <YAxis 
                    stroke="#475569" 
                    tick={{ fill: "#475569", fontSize: 11, fontWeight: "bold" }}
                  />
                  <Tooltip
                    contentStyle={{ 
                      background: "#FFFFFF", 
                      border: "2px solid #CBD5E1", 
                      borderRadius: 8, 
                      color: "#0F172A",
                      fontWeight: "bold"
                    }}
                    labelFormatter={tickFormatter}
                  />
                  <Line
                    type="monotone"
                    dataKey="power"
                    stroke="#DB2777"
                    strokeWidth={4}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Voltage Trend */}
          <div className="bg-gradient-to-br from-white/90 to-cyan-100/35 backdrop-blur-md border-2 border-slate-200/50 rounded-2xl p-6 shadow-md text-slate-900">
            <h2 className="text-2xl font-black text-slate-800 mb-6">Voltage Stability</h2>

            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis
                    dataKey="time"
                    stroke="#475569"
                    tickFormatter={tickFormatter}
                    minTickGap={40}
                    tick={{ fill: "#475569", fontSize: 11, fontWeight: "bold" }}
                  />
                  <YAxis 
                    stroke="#475569" 
                    tick={{ fill: "#475569", fontSize: 11, fontWeight: "bold" }}
                  />
                  <Tooltip
                    contentStyle={{ 
                      background: "#FFFFFF", 
                      border: "2px solid #CBD5E1", 
                      borderRadius: 8, 
                      color: "#0F172A",
                      fontWeight: "bold"
                    }}
                    labelFormatter={tickFormatter}
                  />
                  <Line
                    type="monotone"
                    dataKey="voltage"
                    stroke="#0891B2"
                    strokeWidth={4}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Sustainability Panel */}
        <div className="bg-gradient-to-br from-white/90 to-slate-200/60 backdrop-blur-md border-2 border-slate-200/50 rounded-2xl p-8 mt-10 text-slate-900 shadow-md">
          <h2 className="text-2xl font-black text-slate-800 mb-6">Sustainability Intelligence</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white/50 backdrop-blur-sm border border-slate-200/50 p-6 rounded-xl shadow-sm">
              <p className="text-slate-500 font-extrabold uppercase tracking-wider text-xs">Grid Stability</p>
              <h3 className="text-4xl font-black text-green-600 mt-3">
                {stats.avgVoltage >= 210 && stats.avgVoltage <= 245 ? "92%" : stats.avgVoltage > 0 ? `${Math.max(0, Math.min(100, 100 - Math.abs(stats.avgVoltage - 230) * 2)).toFixed(0)}%` : "—"}
              </h3>
            </div>

            <div className="bg-white/50 backdrop-blur-sm border border-slate-200/50 p-6 rounded-xl shadow-sm">
              <p className="text-slate-500 font-extrabold uppercase tracking-wider text-xs">Rural Reliability</p>
              <h3 className="text-4xl font-black text-cyan-600 mt-3">
                {csiStats.average >= 70 ? "HIGH" : csiStats.average >= 50 ? "MEDIUM" : csiStats.average > 0 ? "LOW" : "—"}
              </h3>
            </div>

            <div className="bg-white/50 backdrop-blur-sm border border-slate-200/50 p-6 rounded-xl shadow-sm">
              <p className="text-slate-500 font-extrabold uppercase tracking-wider text-xs">Sustainability Score</p>
              <h3 className={`text-4xl font-black mt-3 ${csiStatusInfo.color}`}>
                {csiStats.average > 0 ? csiStats.average.toFixed(0) : "—"}
              </h3>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}