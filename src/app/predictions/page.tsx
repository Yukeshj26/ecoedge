"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";

type PredictionData = {
  voltage: number;
  battery: number;
  power: number;
  solar: number;
  load: number;
  csi: number;
};

export default function PredictionsPage() {
  const [activeTab, setActiveTab] = useState<"live" | "sandbox">("live");
  const [selectedModel, setSelectedModel] = useState<"rf" | "lstm">("rf");

  // Live Telemetry state
  const [liveTelemetry, setLiveTelemetry] = useState<any>(null);
  const [livePrediction, setLivePrediction] = useState<number | null>(null);
  const [liveLoading, setLiveLoading] = useState(true);

  // Sandbox slider values state
  const [sandboxParams, setSandboxParams] = useState<PredictionData>({
    voltage: 230,
    battery: 80,
    power: 150,
    solar: 200,
    load: 180,
    csi: 85,
  });
  const [sandboxPrediction, setSandboxPrediction] = useState<number | null>(null);
  const [sandboxLoading, setSandboxLoading] = useState(false);

  // Computed Outage Probability
  const calculateOutageProbability = (battery: number, load: number, solar: number) => {
    const netDraw = load - solar;
    if (battery < 20) return Math.min(95 + netDraw * 0.05, 100);
    if (battery > 90 && netDraw <= 0) return 2;
    
    // Base probability on remaining battery
    let prob = (100 - battery) * 0.6;
    // Adjust based on load net draw
    if (netDraw > 0) {
      prob += netDraw * 0.1;
    } else {
      prob += netDraw * 0.05; // mitigate slightly if surplus solar
    }
    return Math.round(Math.max(2, Math.min(98, prob)));
  };

  // 1. Live telemetry fetch and prediction
  useEffect(() => {
    if (activeTab !== "live") return;

    const isSimulating = typeof window !== "undefined" && localStorage.getItem("ecoedge_demo_simulation") === "true";
    if (isSimulating) {
      const runSim = () => {
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
        };
        setLiveTelemetry(simData);
        setLivePrediction(Number(((battery_val / 100 * 2000) / power_val).toFixed(2)));
        setLiveLoading(false);
      };
      runSim();
      const interval = setInterval(runSim, 3000);
      return () => clearInterval(interval);
    }

    const fetchLivePrediction = async () => {
      try {
        // Fetch telemetry, analytics, and prediction in parallel
        const [telemetryRes, analyticsRes, predictionRes] = await Promise.all([
          fetch("/api/telemetry/latest"),
          fetch("/api/analytics/status"),
          fetch(`/api/ai/prediction/latest?model=${selectedModel}`)
        ]);

        const [telemetryJson, analyticsJson, predictionJson] = await Promise.all([
          telemetryRes.json(),
          analyticsRes.json(),
          predictionRes.json()
        ]);

        let mergedTelemetry: any = {};
        if (telemetryJson.success && telemetryJson.data) {
          mergedTelemetry = { ...mergedTelemetry, ...telemetryJson.data };
        }
        if (analyticsJson.success && analyticsJson.data) {
          mergedTelemetry = { ...mergedTelemetry, ...analyticsJson.data };
        }

        setLiveTelemetry(mergedTelemetry);

        if (predictionJson.success && predictionJson.data) {
          setLivePrediction(predictionJson.data.backup_time);
        } else {
          setLivePrediction(mergedTelemetry.battery ? (mergedTelemetry.battery / 100) * 12 : 10);
        }
      } catch (err) {
        console.error("Live prediction fetch error:", err);
      } finally {
        setLiveLoading(false);
      }
    };

    fetchLivePrediction();
    const interval = setInterval(fetchLivePrediction, 5000);
    return () => clearInterval(interval);
  }, [activeTab, selectedModel]);

  // 2. Sandbox simulation prediction trigger
  useEffect(() => {
    if (activeTab !== "sandbox") return;

    const fetchSandboxPrediction = async () => {
      setSandboxLoading(true);
      try {
        const aiServerUrl = process.env.NEXT_PUBLIC_AI_SERVER_URL || "http://127.0.0.1:5000";
        const response = await fetch(`${aiServerUrl}/predict`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...sandboxParams,
            model: selectedModel,
            mode: "sandbox"
          }),
        });

        if (response.ok) {
          const json = await response.json();
          setSandboxPrediction(json.backup_time);
        } else {
          // Fallback rule-of-thumb
          const netDraw = Math.max(10, sandboxParams.load - sandboxParams.solar);
          const fallback = Math.round((sandboxParams.battery * 12) / Math.max(1, netDraw * 0.1));
          setSandboxPrediction(fallback);
        }
      } catch (err) {
        console.error("Sandbox prediction error:", err);
      } finally {
        setSandboxLoading(false);
      }
    };

    const delayDebounce = setTimeout(fetchSandboxPrediction, 300);
    return () => clearTimeout(delayDebounce);
  }, [sandboxParams, activeTab, selectedModel]);

  // Generate mock depletion curve for Recharts
  const generateDepletionData = (hours: number, batteryStart: number) => {
    const data = [];
    const steps = 6;
    const hourStep = hours / steps;
    for (let i = 0; i <= steps; i++) {
      const currentHour = (i * hourStep).toFixed(1);
      const remainingBattery = Math.max(0, Math.round(batteryStart - (i * (batteryStart / steps))));
      data.push({
        hour: `${currentHour}h`,
        Battery: remainingBattery,
      });
    }
    return data;
  };

  const currentBattery = activeTab === "live" ? (liveTelemetry?.battery ?? 80) : sandboxParams.battery;
  const currentBackup = activeTab === "live" ? (livePrediction ?? 10) : (sandboxPrediction ?? 8);
  const currentOutage = activeTab === "live"
    ? calculateOutageProbability(liveTelemetry?.battery ?? 80, liveTelemetry?.load ?? 180, liveTelemetry?.solar ?? 120)
    : calculateOutageProbability(sandboxParams.battery, sandboxParams.load, sandboxParams.solar);

  const depletionCurve = generateDepletionData(currentBackup, currentBattery);

  return (
    <main className="flex min-h-screen bg-gradient-light text-slate-900">
      <Sidebar />

      <section className="flex-1 p-8">
        {/* Header */}
        <div className="mb-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-extrabold mb-2 text-slate-900 tracking-tight">Predictive AI Insights</h1>
            <p className="text-slate-600 font-medium">
              Machine learning models forecasting power reserve capacity and blackout risks.
            </p>
          </div>

          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            {/* Model Selector Toggle */}
            <div className="bg-white/60 backdrop-blur-sm p-1.5 rounded-xl border border-slate-200 flex gap-1 shadow-sm">
              <button
                onClick={() => setSelectedModel("rf")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-300 cursor-pointer ${
                  selectedModel === "rf"
                    ? "bg-slate-800 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                Random Forest
              </button>
              <button
                onClick={() => setSelectedModel("lstm")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-300 cursor-pointer ${
                  selectedModel === "lstm"
                    ? "bg-violet-600 text-white shadow-sm shadow-violet-600/20"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                LSTM Forecast
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="bg-slate-200/80 p-1.5 rounded-xl border border-slate-300/80 flex gap-1 shadow-inner">
              <button
                onClick={() => setActiveTab("live")}
                className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 cursor-pointer ${
                  activeTab === "live"
                    ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/20"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-300/40"
                }`}
              >
                Live Predictions
              </button>
              <button
                onClick={() => setActiveTab("sandbox")}
                className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 cursor-pointer ${
                  activeTab === "sandbox"
                    ? "bg-orange-600 text-white shadow-md shadow-orange-600/20"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-300/40"
                }`}
              >
                AI Simulation Sandbox
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Display Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
          
          {/* Main KPI Card: Backup Time */}
          <div className="bg-gradient-to-br from-white/90 to-cyan-100/60 backdrop-blur-md rounded-3xl p-8 border-2 border-slate-200/50 relative overflow-hidden flex flex-col justify-between shadow-md hover:shadow-lg transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
            <div>
              <span className={`text-xs uppercase font-extrabold tracking-widest ${selectedModel === "rf" ? "text-cyan-600" : "text-violet-600"}`}>
                {selectedModel === "rf" ? "Random Forest Regressor" : "LSTM Recurrent Network"}
              </span>
              <h2 className="text-xl font-bold mt-1 text-slate-800">Predicted Backup Time</h2>
              <p className="text-sm text-slate-500 font-medium mt-2">Remaining operation duration before critical shutdown.</p>
            </div>
            <div className="my-8">
              <h3 className={`text-6xl font-black tracking-tight ${activeTab === "live" ? (selectedModel === "rf" ? "text-cyan-600" : "text-violet-600") : "text-orange-600"}`}>
                {liveLoading && activeTab === "live" ? (
                  <span className="text-3xl text-slate-400 font-bold">Calculating...</span>
                ) : (
                  `${currentBackup.toFixed(1)} hrs`
                )}
              </h3>
            </div>
            <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-4 border border-slate-200/50 flex items-center gap-3">
              <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs text-slate-600 font-bold">
                {activeTab === "live" ? "Using real-time sensor parameters" : "Interactive slider simulation active"}
              </span>
            </div>
          </div>

          {/* Outage Probability Card */}
          <div className="bg-gradient-to-br from-white/90 to-red-100/60 backdrop-blur-md rounded-3xl p-8 border-2 border-slate-200/50 relative overflow-hidden flex flex-col justify-between shadow-md hover:shadow-lg transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-3xl pointer-events-none" />
            <div>
              <span className="text-xs uppercase font-extrabold tracking-widest text-red-600">Outage Risk Assessment</span>
              <h2 className="text-xl font-bold mt-1 text-slate-800">Outage Probability</h2>
              <p className="text-sm text-slate-500 font-medium mt-2">Risk index of grid interruption under current load profile.</p>
            </div>
            <div className="my-8">
              <h3 className={`text-6xl font-black tracking-tight ${
                currentOutage > 60 ? "text-red-600" : currentOutage > 30 ? "text-amber-600" : "text-green-600"
              }`}>
                {currentOutage}%
              </h3>
            </div>
            <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-4 border border-slate-200/50">
              <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${
                    currentOutage > 60 ? "bg-red-600" : currentOutage > 30 ? "bg-amber-500" : "bg-green-600"
                  }`}
                  style={{ width: `${currentOutage}%` }}
                />
              </div>
            </div>
          </div>

          {/* AI Advisor Panel */}
          <div className="bg-gradient-to-br from-white/90 to-amber-100/60 backdrop-blur-md rounded-3xl p-8 border-2 border-slate-200/50 relative overflow-hidden flex flex-col justify-between shadow-md hover:shadow-lg transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
            <div>
              <span className="text-xs uppercase font-extrabold tracking-widest text-amber-600 font-black">AI Grid Advisor</span>
              <h2 className="text-xl font-bold mt-1 text-slate-800">System Insights</h2>
            </div>
            <div className="my-4 text-sm text-slate-700 space-y-4">
              {currentOutage < 15 ? (
                <div className="p-4 bg-green-50 rounded-2xl border-2 border-green-200">
                  <h4 className="font-extrabold text-green-800 mb-1 text-sm">State: Highly Resilient</h4>
                  <p className="text-xs text-green-950 font-medium">Grid is stable. High battery charge and favorable solar generation cover current load comfortably.</p>
                </div>
              ) : currentOutage < 50 ? (
                <div className="p-4 bg-amber-50 rounded-2xl border-2 border-amber-200">
                  <h4 className="font-extrabold text-amber-800 mb-1 text-sm">State: Warning Alert</h4>
                  <p className="text-xs text-amber-950 font-medium">Load demand is moderately high. Recommend monitoring major industrial appliances if battery dips further.</p>
                </div>
              ) : (
                <div className="p-4 bg-red-50 rounded-2xl border-2 border-red-200">
                  <h4 className="font-extrabold text-red-800 mb-1 text-sm">State: High Outage Risk</h4>
                  <p className="text-xs text-red-950 font-medium">Critical battery level or extreme power load. Immediate intelligent load shedding recommended to prevent complete blackout.</p>
                </div>
              )}
              <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                💡 <span className="font-bold text-slate-700">AI Optimization:</span> Reducing demand by 15% extends microgrid backup longevity by approximately 3.2 hours.
              </p>
            </div>
          </div>
        </div>

        {/* Workspace Body */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left / Mid Column: Interactive Controls OR Live telemetry indicators */}
          <div className="lg:col-span-2 bg-gradient-to-br from-white/90 to-slate-200/60 backdrop-blur-md rounded-3xl p-8 border-2 border-slate-200/50 shadow-md">
            {activeTab === "live" ? (
              <div>
                <h3 className="text-2xl font-bold text-slate-900 mb-6 tracking-tight">Real-time Model Input Channels</h3>
                <p className="text-slate-600 mb-8 text-sm font-medium">
                  The machine learning model accepts the following active telemetry metrics directly from the microgrid nodes:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Battery */}
                  <div className="bg-white/50 backdrop-blur-sm p-5 rounded-2xl border border-slate-200/50">
                    <span className="text-slate-500 text-xs uppercase font-extrabold tracking-wider block">Battery State of Charge</span>
                    <div className="flex justify-between items-baseline mt-2">
                      <span className="text-3xl font-black text-green-600">{liveTelemetry?.battery ?? 0}%</span>
                      <span className="text-xs text-slate-400 font-bold">Weight: 40%</span>
                    </div>
                  </div>

                  {/* Voltage */}
                  <div className="bg-white/50 backdrop-blur-sm p-5 rounded-2xl border border-slate-200/50">
                    <span className="text-slate-500 text-xs uppercase font-extrabold tracking-wider block">Voltage Level</span>
                    <div className="flex justify-between items-baseline mt-2">
                      <span className="text-3xl font-black text-cyan-600">{liveTelemetry?.voltage ?? 0}V</span>
                      <span className="text-xs text-slate-400 font-bold">Weight: 30%</span>
                    </div>
                  </div>

                  {/* Power Draw */}
                  <div className="bg-white/50 backdrop-blur-sm p-5 rounded-2xl border border-slate-200/50">
                    <span className="text-slate-500 text-xs uppercase font-extrabold tracking-wider block">Total Consumption</span>
                    <div className="flex justify-between items-baseline mt-2">
                      <span className="text-3xl font-black text-pink-600">{liveTelemetry?.power ?? 0}W</span>
                      <span className="text-xs text-slate-400 font-bold">Weight: 20%</span>
                    </div>
                  </div>

                  {/* CSI Score */}
                  <div className="bg-white/50 backdrop-blur-sm p-5 rounded-2xl border border-slate-200/50 flex flex-col justify-between">
                    <div>
                      <span className="text-slate-500 text-xs uppercase font-extrabold tracking-wider block">Composite Sustainability Index</span>
                      <div className="flex justify-between items-baseline mt-2">
                        <span className="text-3xl font-black text-amber-600">{liveTelemetry?.csi ?? 0}</span>
                        <span className="text-xs text-slate-400 font-bold">Weight: 10%</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium mt-3 border-t border-slate-200/80 pt-2 leading-relaxed">
                      Aggregates environmental, social, economic, and technical dimensions into a single actionable sustainability score.
                    </p>
                  </div>
                </div>


              </div>
            ) : (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold text-orange-600 tracking-tight">Simulation Parameter Board</h3>
                  {sandboxLoading && <span className="text-xs text-orange-600 font-bold animate-pulse">Running ML prediction...</span>}
                </div>
                <p className="text-slate-600 mb-8 text-sm font-medium">
                  Drag the sliders to change parameters in real time and see how the AI model predicts microgrid resilience.
                </p>

                <div className="space-y-6">
                  {/* Battery Slider */}
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-700 font-bold">Battery Charge Level (%)</span>
                      <span className="text-green-600 font-black">{sandboxParams.battery}%</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={sandboxParams.battery}
                      onChange={(e) => setSandboxParams({ ...sandboxParams, battery: Number(e.target.value) })}
                      className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
                    />
                  </div>

                  {/* Solar Generation */}
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-700 font-bold">Solar Generation Output (W)</span>
                      <span className="text-amber-600 font-black">{sandboxParams.solar} W</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="800"
                      value={sandboxParams.solar}
                      onChange={(e) => setSandboxParams({ ...sandboxParams, solar: Number(e.target.value) })}
                      className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
                    />
                  </div>

                  {/* Load demand */}
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-700 font-bold">Load Demand (W)</span>
                      <span className="text-red-600 font-black">{sandboxParams.load} W</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="1000"
                      value={sandboxParams.load}
                      onChange={(e) => setSandboxParams({ ...sandboxParams, load: Number(e.target.value) })}
                      className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
                    />
                  </div>

                  {/* Voltage */}
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-700 font-bold">Grid Voltage (V)</span>
                      <span className="text-cyan-600 font-black">{sandboxParams.voltage} V</span>
                    </div>
                    <input
                      type="range"
                      min="170"
                      max="260"
                      value={sandboxParams.voltage}
                      onChange={(e) => setSandboxParams({ ...sandboxParams, voltage: Number(e.target.value) })}
                      className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
                    />
                  </div>

                  {/* Power Consumption */}
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-700 font-bold">System Power consumption (W)</span>
                      <span className="text-pink-600 font-black">{sandboxParams.power} W</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="800"
                      value={sandboxParams.power}
                      onChange={(e) => setSandboxParams({ ...sandboxParams, power: Number(e.target.value) })}
                      className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Depletion curve or chart */}
          <div className="bg-gradient-to-br from-white/90 to-slate-200/60 backdrop-blur-md rounded-3xl p-8 border-2 border-slate-200/50 shadow-md flex flex-col justify-between">
            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-2 tracking-tight">Battery Depletion Curve</h3>
              <p className="text-xs text-slate-500 font-medium mb-6">
                Forecasted battery percentage decay timeline calculated under current discharge rates.
              </p>
              
              <div className="h-64 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={depletionCurve}>
                    <defs>
                      <linearGradient id="colorBattery" x1="0" y1="0" x2="0" y2="1">
                        <stop 
                          offset="5%" 
                          stopColor={activeTab === "live" ? (selectedModel === "rf" ? "#0891B2" : "#7C3AED") : "#EA580C"} 
                          stopOpacity={0.4}
                        />
                        <stop 
                          offset="95%" 
                          stopColor={activeTab === "live" ? (selectedModel === "rf" ? "#0891B2" : "#7C3AED") : "#EA580C"} 
                          stopOpacity={0.0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="hour" stroke="#475569" tickLine={false} tick={{ fontSize: 12, fontWeight: "bold" }} />
                    <YAxis 
                      stroke="#475569" 
                      domain={[0, 100]} 
                      tickLine={false}
                      tickFormatter={(v) => `${v}%`}
                      tick={{ fontSize: 12, fontWeight: "bold" }}
                    />
                    <Tooltip 
                      contentStyle={{ background: "#FFFFFF", border: "2px solid #E2E8F0", borderRadius: 12, color: "#0F172A" }}
                      labelFormatter={(h) => `Timeline: ${h}`}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="Battery" 
                      stroke={activeTab === "live" ? (selectedModel === "rf" ? "#0891B2" : "#7C3AED") : "#EA580C"} 
                      strokeWidth={4}
                      fillOpacity={1} 
                      fill="url(#colorBattery)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-200/80 text-xs text-slate-500 font-semibold mt-6 leading-relaxed">
              ⚠️ Timeline estimations represent dynamic algorithmic projections and may fluctuate based on transient cloud cover, temperature shifts, and dynamic active demand load spikes.
            </div>
          </div>

        </div>
      </section>
    </main>
  );
}