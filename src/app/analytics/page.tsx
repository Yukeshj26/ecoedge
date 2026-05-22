"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/dashboard/Sidebar";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

// Maximum points rendered in the chart regardless of API response size
const MAX_POINTS = 50;

type TimeWindow = "5m" | "15m" | "30m";

const WINDOW_LABELS: Record<TimeWindow, string> = {
  "5m": "Last 5 min",
  "15m": "Last 15 min",
  "30m": "Last 30 min",
};

export default function AnalyticsPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [window, setWindow] = useState<TimeWindow>("15m");

  const [stats, setStats] = useState({
    avgPower: 0,
    avgVoltage: 0,
    avgBattery: 0,
    peakPower: 0,
  });

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await fetch(`/api/telemetry/history?window=${window}`);
        const json = await res.json();

        if (!json.success || !json.data) return;

        // Normalize raw telemetry rows
        const normalized = json.data.map((d: any) => ({
          time: new Date(d._time).getTime(),
          field: d._field,
          value: Number(d._value),
        }));

        // Merge rows that share the same timestamp into one data point
        const grouped = new Map<number, any>();

        normalized.forEach((d: any) => {
          if (!grouped.has(d.time)) {
            grouped.set(d.time, { time: d.time, power: 0, voltage: 0, battery: 0 });
          }
          const existing = grouped.get(d.time);
          if (d.field === "power")   existing.power   = d.value;
          if (d.field === "voltage") existing.voltage = d.value;
          if (d.field === "battery") existing.battery = d.value;
        });

        // Sort chronologically and cap to MAX_POINTS to prevent chart overload
        const finalData = Array.from(grouped.values())
          .sort((a, b) => a.time - b.time)
          .slice(-MAX_POINTS);

        setHistory(finalData);

        if (finalData.length === 0) return;

        const avgPower   = finalData.reduce((a, b) => a + b.power,   0) / finalData.length;
        const avgVoltage = finalData.reduce((a, b) => a + b.voltage, 0) / finalData.length;
        const avgBattery = finalData.reduce((a, b) => a + b.battery, 0) / finalData.length;
        const peakPower  = Math.max(...finalData.map((d) => d.power));

        setStats({ avgPower, avgVoltage, avgBattery, peakPower });
      } catch (err) {
        console.error("Analytics fetch error:", err);
      }
    };

    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, [window]); // re-run whenever the selected time window changes

  const tickFormatter = (t: any) =>
    new Date(Number(t)).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

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

        {/* Stats Cards */}
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

        {/* Charts */}
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
              <h3 className="text-4xl font-black text-green-600 mt-3">92%</h3>
            </div>

            <div className="bg-white/50 backdrop-blur-sm border border-slate-200/50 p-6 rounded-xl shadow-sm">
              <p className="text-slate-500 font-extrabold uppercase tracking-wider text-xs">Rural Reliability</p>
              <h3 className="text-4xl font-black text-cyan-600 mt-3">HIGH</h3>
            </div>

            <div className="bg-white/50 backdrop-blur-sm border border-slate-200/50 p-6 rounded-xl shadow-sm">
              <p className="text-slate-500 font-extrabold uppercase tracking-wider text-xs">Sustainability Score</p>
              <h3 className="text-4xl font-black text-amber-600 mt-3">88</h3>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}