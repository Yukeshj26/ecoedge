"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import { 
  Bell, 
  AlertTriangle, 
  Check, 
  Eye, 
  Trash2, 
  Search, 
  Filter, 
  Battery, 
  Zap, 
  Settings, 
  Activity, 
  ShieldAlert, 
  RefreshCw,
  Cpu,
  Clock
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";

type Alert = {
  id: string;
  timestamp: string;
  resolvedAt?: string;
  source: string;
  type: "VOLTAGE_INSTABILITY" | "LOW_BATTERY" | "POWER_SURGE" | "MAINTENANCE_CRITICAL" | "AI_ANOMALY";
  severity: "CRITICAL" | "WARNING" | "INFO";
  message: string;
  status: "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED";
  value?: number;
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED">("ALL");
  const [severityFilter, setSeverityFilter] = useState<"ALL" | "CRITICAL" | "WARNING" | "INFO">("ALL");
  const [selectedDevice, setSelectedDevice] = useState<string>("ALL");
  const [devices, setDevices] = useState<any[]>([]);

  // Fetch registered devices (connections) to dynamically build Operations Hub selectors
  const fetchDevices = async () => {
    try {
      const res = await fetch("/api/connections");
      const json = await res.json();
      if (json.success) {
        // Filter connections representing grid devices
        const registered = json.data.filter((c: any) => c.device || c.type === "MQTT Broker");
        setDevices(registered);
      }
    } catch (err) {
      console.error("Failed to fetch registered devices for Alerts selector:", err);
    }
  };

  // Fetch alerts from the API
  const fetchAlerts = async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch("/api/alerts");
      const json = await res.json();
      if (json.success) {
        setAlerts(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch alerts:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    fetchDevices();
    
    // Set up polling interval to fetch live alerts and devices every 3 seconds
    const interval = setInterval(() => {
      fetchAlerts(true);
      fetchDevices();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Handlers for alert actions
  const handleAcknowledge = async (id: string) => {
    try {
      const res = await fetch("/api/alerts/acknowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Alert marked as acknowledged", {
          style: { background: "#1F2937", color: "#F9FAFB", border: "1px solid #374151" }
        });
        // Optimistically update status
        setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: "ACKNOWLEDGED" } : a));
      }
    } catch (err) {
      toast.error("Failed to acknowledge alert");
    }
  };

  const handleResolve = async (id: string) => {
    try {
      const res = await fetch("/api/alerts/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Alert resolved successfully", {
          style: { background: "#1F2937", color: "#10B981", border: "1px solid #047857" }
        });
        // Optimistically update status
        setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: "RESOLVED", resolvedAt: new Date().toISOString() } : a));
      }
    } catch (err) {
      toast.error("Failed to resolve alert");
    }
  };

  const handleClearArchive = async () => {
    const confirmClear = window.confirm("Are you sure you want to clear all resolved and acknowledged alerts from the archive?");
    if (!confirmClear) return;

    try {
      const res = await fetch("/api/alerts", {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message || "Archive cleared", {
          style: { background: "#1F2937", color: "#06B6D4", border: "1px solid #1F2937" }
        });
        fetchAlerts();
      }
    } catch (err) {
      toast.error("Failed to clear archive");
    }
  };

  // Helper date formatters
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }) + " - " + date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });
  };

  const timeAgo = (isoString: string) => {
    const now = new Date();
    const past = new Date(isoString);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return past.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  // Dynamic statistics calculations
  const totalActive = alerts.filter(a => a.status === "ACTIVE" || a.status === "ACKNOWLEDGED").length;
  const criticalCount = alerts.filter(a => a.severity === "CRITICAL" && (a.status === "ACTIVE" || a.status === "ACKNOWLEDGED")).length;
  const warningCount = alerts.filter(a => a.severity === "WARNING" && (a.status === "ACTIVE" || a.status === "ACKNOWLEDGED")).length;
  const resolvedCount = alerts.filter(a => a.status === "RESOLVED").length;

  // Composite grid health score based on count of warning and critical active issues
  const calculateGridHealth = () => {
    let score = 100;
    score -= (criticalCount * 15);
    score -= (warningCount * 5);
    return Math.max(0, Math.min(100, score));
  };

  const healthScore = calculateGridHealth();

  // Custom visual components for different alert types
  const getAlertTypeConfig = (type: Alert["type"]) => {
    switch (type) {
      case "VOLTAGE_INSTABILITY":
        return { icon: Zap, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" };
      case "LOW_BATTERY":
        return { icon: Battery, color: "text-red-600", bg: "bg-red-50", border: "border-red-200" };
      case "POWER_SURGE":
        return { icon: AlertTriangle, color: "text-pink-600", bg: "bg-pink-50", border: "border-pink-200" };
      case "AI_ANOMALY":
        return { icon: Cpu, color: "text-cyan-600", bg: "bg-cyan-50", border: "border-cyan-200" };
      case "MAINTENANCE_CRITICAL":
        return { icon: Settings, color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200" };
      default:
        return { icon: Bell, color: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200" };
    }
  };

  // Severity color classes
  const getSeverityStyles = (severity: Alert["severity"]) => {
    switch (severity) {
      case "CRITICAL":
        return { text: "text-red-700", bg: "bg-red-50", border: "border-red-300", glow: "shadow-red-500/5", side: "border-l-4 border-l-red-500" };
      case "WARNING":
        return { text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-300", glow: "shadow-yellow-500/5", side: "border-l-4 border-l-amber-500" };
      case "INFO":
        return { text: "text-blue-700", bg: "bg-blue-50", border: "border-blue-300", glow: "shadow-blue-500/5", side: "border-l-4 border-l-blue-500" };
    }
  };

  // Filter alerts based on user selections
  const filteredAlerts = alerts.filter(alert => {
    // Search query matching message or source
    const matchesSearch = alert.message.toLowerCase().includes(search.toLowerCase()) || 
                          alert.source.toLowerCase().includes(search.toLowerCase());
    
    // Status Filter
    let matchesStatus = true;
    if (statusFilter === "ACTIVE") {
      matchesStatus = alert.status === "ACTIVE";
    } else if (statusFilter === "ACKNOWLEDGED") {
      matchesStatus = alert.status === "ACKNOWLEDGED";
    } else if (statusFilter === "RESOLVED") {
      matchesStatus = alert.status === "RESOLVED";
    }

    // Severity Filter
    let matchesSeverity = true;
    if (severityFilter !== "ALL") {
      matchesSeverity = alert.severity === severityFilter;
    }

    // Device Filter
    let matchesDevice = true;
    if (selectedDevice !== "ALL") {
      matchesDevice = alert.source === selectedDevice;
    }

    return matchesSearch && matchesStatus && matchesSeverity && matchesDevice;
  });

  return (
    <main className="flex min-h-screen bg-gradient-light text-slate-900">
      <Toaster position="top-right" />
      <Sidebar />

      <section className="flex-1 p-8 overflow-y-auto">
        
        {/* Header Section */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-extrabold mb-2 tracking-tight text-slate-900">Grid Diagnostic Alerts</h1>
            <p className="text-slate-600 font-medium">
              Live automated system anomaly logging, sensor status warning flags, and active grid optimization tools.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchAlerts()}
              disabled={refreshing}
              className={`bg-white border-2 border-slate-200 p-3 rounded-xl hover:bg-slate-100 transition cursor-pointer flex items-center justify-center shadow-sm ${
                refreshing ? "animate-spin text-cyan-600" : "text-slate-700"
              }`}
              title="Sync alerts"
            >
              <RefreshCw className="w-5 h-5" />
            </button>

            <button
              onClick={handleClearArchive}
              className="bg-red-50 border-2 border-red-300 text-red-700 px-5 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-red-100 hover:border-red-400 active:scale-95 transition cursor-pointer shadow-sm"
            >
              <Trash2 className="w-4 h-4" />
              Clear Archive
            </button>
          </div>
        </div>

        {/* Dynamic Overview Diagnostics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          
          {/* Health Index Card */}
          <div className="bg-gradient-to-br from-white/90 to-cyan-100/60 backdrop-blur-md rounded-2xl p-6 border-2 border-slate-200/50 relative overflow-hidden flex flex-col justify-between shadow-md hover:shadow-lg transition-all duration-300">
            <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl ${
              healthScore > 85 ? "bg-green-500/5" : healthScore > 65 ? "bg-amber-500/5" : "bg-red-500/5"
            }`} />
            <div>
              <span className="text-xs uppercase font-extrabold tracking-widest text-cyan-700">Grid Operations</span>
              <h3 className="text-lg font-bold text-slate-800 mt-1">System Health Index</h3>
            </div>
            <div className="my-5 flex items-baseline gap-2">
              <span className={`text-5xl font-black tracking-tight ${
                healthScore > 85 ? "text-green-600" : healthScore > 65 ? "text-amber-600" : "text-red-600"
              }`}>
                {healthScore}%
              </span>
              <span className="text-xs text-slate-400 font-bold">Stability</span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/50">
              <div 
                className={`h-full transition-all duration-700 ${
                  healthScore > 85 ? "bg-green-600" : healthScore > 65 ? "bg-amber-500" : "bg-red-600"
                }`}
                style={{ width: `${healthScore}%` }}
              />
            </div>
          </div>

          {/* Active Alerts Count */}
          <div className="bg-gradient-to-br from-white/90 to-red-100/60 backdrop-blur-md rounded-2xl p-6 border-2 border-slate-200/50 relative overflow-hidden flex flex-col justify-between shadow-md hover:shadow-lg transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-3xl" />
            <div>
              <span className="text-xs uppercase font-extrabold tracking-widest text-red-600">Active Faults</span>
              <h3 className="text-lg font-bold text-slate-800 mt-1">Active Alerts</h3>
            </div>
            <div className="my-5 flex items-baseline gap-3">
              <span className="text-5xl font-black tracking-tight text-red-600">
                {totalActive}
              </span>
              {criticalCount > 0 && (
                <span className="bg-red-100 text-red-800 text-xs px-2.5 py-1 rounded-full font-extrabold border-2 border-red-200 animate-pulse">
                  {criticalCount} Critical
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 font-medium">
              Requires immediate technician dispatch or load-shedding
            </div>
          </div>

          {/* Warning Flag Count */}
          <div className="bg-gradient-to-br from-white/90 to-amber-100/60 backdrop-blur-md rounded-2xl p-6 border-2 border-slate-200/50 relative overflow-hidden flex flex-col justify-between shadow-md hover:shadow-lg transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl" />
            <div>
              <span className="text-xs uppercase font-extrabold tracking-widest text-amber-600">Warnings Raised</span>
              <h3 className="text-lg font-bold text-slate-800 mt-1">Pending Warnings</h3>
            </div>
            <div className="my-5">
              <span className="text-5xl font-black tracking-tight text-amber-600">
                {warningCount}
              </span>
            </div>
            <div className="text-xs text-slate-500 font-medium">
              Moderate issues monitored by automatic AI predictors
            </div>
          </div>

          {/* Resolved Count */}
          <div className="bg-gradient-to-br from-white/90 to-green-100/60 backdrop-blur-md rounded-2xl p-6 border-2 border-slate-200/50 relative overflow-hidden flex flex-col justify-between shadow-md hover:shadow-lg transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full blur-3xl" />
            <div>
              <span className="text-xs uppercase font-extrabold tracking-widest text-green-600">Closed Failures</span>
              <h3 className="text-lg font-bold text-slate-800 mt-1">Resolved Archive</h3>
            </div>
            <div className="my-5">
              <span className="text-5xl font-black tracking-tight text-green-600">
                {resolvedCount}
              </span>
            </div>
            <div className="text-xs text-slate-500 font-medium">
              Autonomously or manually resolved system issues
            </div>
          </div>

        </div>

        {/* Device Operations Hub */}
        <div className="mb-8 animate-in fade-in slide-in-from-bottom-3 duration-500">
          <h2 className="text-xl font-extrabold text-slate-800 mb-4 flex items-center gap-2 tracking-tight">
            <Cpu className="w-5 h-5 text-cyan-600 animate-pulse" />
            Device Operations Hub
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* All Devices Selector Card */}
            <div 
              onClick={() => setSelectedDevice("ALL")}
              className={`cursor-pointer rounded-2xl p-5 border-2 transition-all duration-300 flex flex-col justify-between shadow-sm relative overflow-hidden group ${
                selectedDevice === "ALL" 
                  ? "bg-gradient-to-br from-cyan-50/90 to-cyan-100/50 border-cyan-500 shadow-md shadow-cyan-500/5 scale-[1.01] ring-2 ring-cyan-500/10"
                  : "bg-white/80 border-slate-200 hover:border-slate-350 hover:bg-slate-50 hover:scale-[1.01] hover:shadow-md"
              }`}
            >
              <div className="absolute top-0 right-0 w-16 h-16 bg-cyan-500/5 rounded-full blur-xl pointer-events-none group-hover:scale-125 transition-transform" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">All Microgrids</span>
                <span className="bg-slate-100 border border-slate-200 text-slate-700 text-[10px] px-2.5 py-0.5 rounded-full font-bold">
                  {alerts.filter(a => a.status === "ACTIVE" || a.status === "ACKNOWLEDGED").length} Active
                </span>
              </div>
              <div>
                <h3 className="font-extrabold text-slate-800 text-lg leading-tight">System-wide Feed</h3>
                <p className="text-[11px] text-slate-400 font-semibold mt-1">Aggregated alert and warning stream</p>
              </div>
            </div>

            {/* Microgrid Device Cards */}
            {devices.map((dev) => {
              const name = dev.name;
              const deviceId = dev.device || dev.id;
              const deviceActiveAlerts = alerts.filter(a => a.source === name && (a.status === "ACTIVE" || a.status === "ACKNOWLEDGED"));
              const devActiveCount = deviceActiveAlerts.length;
              const devCriticalCount = deviceActiveAlerts.filter(a => a.severity === "CRITICAL").length;
              const devWarningCount = deviceActiveAlerts.filter(a => a.severity === "WARNING").length;

              let status: "OPTIMAL" | "WARNING" | "CRITICAL" = "OPTIMAL";
              if (devCriticalCount > 0) {
                status = "CRITICAL";
              } else if (devWarningCount > 0) {
                status = "WARNING";
              }

              const isSelected = selectedDevice === name;

              // Setup dynamic styles based on operational status
              let theme = {
                cardBg: "from-green-50/80 to-emerald-50/30",
                border: "border-green-300/60",
                badgeBg: "bg-green-100 text-green-800 border-green-200",
                badgeText: "OPTIMAL",
                indicator: "bg-green-500",
                glow: "shadow-green-500/5",
                hoverBorder: "hover:border-green-400"
              };

              if (status === "CRITICAL") {
                theme = {
                  cardBg: "from-red-50/80 to-rose-50/30",
                  border: "border-red-300/60",
                  badgeBg: "bg-red-100 text-red-800 border-red-200 animate-pulse",
                  badgeText: "CRITICAL FAULT",
                  indicator: "bg-red-500",
                  glow: "shadow-red-500/10",
                  hoverBorder: "hover:border-red-400"
                };
              } else if (status === "WARNING") {
                theme = {
                  cardBg: "from-amber-50/80 to-orange-50/30",
                  border: "border-amber-300/60",
                  badgeBg: "bg-amber-100 text-amber-800 border-amber-200",
                  badgeText: "WARNINGS ACTIVE",
                  indicator: "bg-amber-500",
                  glow: "shadow-yellow-500/10",
                  hoverBorder: "hover:border-amber-400"
                };
              }

              return (
                <div 
                  key={name}
                  onClick={() => setSelectedDevice(isSelected ? "ALL" : name)}
                  className={`cursor-pointer rounded-2xl p-5 border-2 transition-all duration-300 flex flex-col justify-between shadow-sm relative overflow-hidden group ${theme.glow} ${
                    isSelected 
                      ? "bg-gradient-to-br from-cyan-50/90 to-cyan-100/50 border-cyan-500 shadow-md ring-2 ring-cyan-500/10 scale-[1.01]"
                      : `bg-gradient-to-br ${theme.cardBg} ${theme.border} ${theme.hoverBorder} hover:scale-[1.01] hover:shadow-md`
                  }`}
                >
                  <div className={`absolute top-0 right-0 w-20 h-20 rounded-full blur-xl pointer-events-none transition-transform group-hover:scale-125 ${
                    status === "CRITICAL" ? "bg-red-500/5" : status === "WARNING" ? "bg-amber-500/5" : "bg-green-500/5"
                  }`} />
                  
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] uppercase font-black tracking-widest text-slate-500 font-mono">{deviceId}</span>
                    <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${theme.badgeBg}`}>
                      {theme.badgeText}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-extrabold text-slate-800 text-lg leading-tight flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        {status === "CRITICAL" && (
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        )}
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${theme.indicator}`}></span>
                      </span>
                      {name}
                    </h3>
                    
                    <div className="flex items-center justify-between mt-3 text-xs border-t border-slate-100/60 pt-3">
                      <span className="text-slate-500 font-bold">Active Alerts</span>
                      <span className={`font-black font-mono text-sm px-2 py-0.5 rounded-md ${
                        devActiveCount > 0 
                          ? status === "CRITICAL" 
                            ? "bg-red-100 text-red-800" 
                            : "bg-amber-100 text-amber-800"
                          : "bg-green-100 text-green-800"
                      }`}>
                        {devActiveCount}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

          </div>
        </div>

        {/* Filters and Control Board */}
        <div className="bg-gradient-to-br from-white/90 to-slate-200/60 backdrop-blur-md border-2 border-slate-200/50 rounded-2xl p-6 mb-8 flex flex-col lg:flex-row gap-6 items-center justify-between shadow-md">
          
          {/* Search box */}
          <div className="relative w-full lg:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by message or grid name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-cyan-500 transition text-slate-800 font-semibold"
            />
          </div>

          {/* Filters Group */}
          <div className="flex flex-col sm:flex-row gap-6 w-full lg:w-auto items-center">
            
            {/* Status Filter Tabs */}
            <div className="flex flex-col w-full sm:w-auto gap-2">
              <span className="text-xs text-slate-500 font-extrabold uppercase tracking-wider">Status Filter</span>
              <div className="bg-slate-100 p-1 rounded-xl border border-slate-200 flex gap-1 w-full sm:w-auto">
                {(["ALL", "ACTIVE", "ACKNOWLEDGED", "RESOLVED"] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                      statusFilter === status
                        ? "bg-cyan-600 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/40"
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {/* Severity Filter buttons */}
            <div className="flex flex-col w-full sm:w-auto gap-2">
              <span className="text-xs text-slate-500 font-extrabold uppercase tracking-wider">Severity Filter</span>
              <div className="bg-slate-100 p-1 rounded-xl border border-slate-200 flex gap-1 w-full sm:w-auto">
                {(["ALL", "CRITICAL", "WARNING", "INFO"] as const).map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setSeverityFilter(sev)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                      severityFilter === sev
                        ? sev === "CRITICAL"
                          ? "bg-red-700 text-white"
                          : sev === "WARNING"
                          ? "bg-amber-600 text-white"
                          : sev === "INFO"
                          ? "bg-blue-700 text-white"
                          : "bg-slate-700 text-white"
                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/40"
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>

          </div>

        </div>

        {/* Live Alerts Stream Feed */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <RefreshCw className="w-8 h-8 text-cyan-600 animate-spin" />
            <p className="text-slate-500 text-sm font-bold">Loading systems log feed...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {filteredAlerts.length === 0 ? (
                
                // Stunning Empty State Panel
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3 }}
                  className="bg-gradient-to-br from-white/90 to-slate-200/50 backdrop-blur-md border-2 border-dashed border-slate-200/50 rounded-2xl p-16 flex flex-col items-center justify-center text-center shadow-md"
                >
                  <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-6 border-2 border-green-200 text-green-700 shadow-sm">
                    <Check className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-2">Systems Operational</h3>
                  <p className="text-slate-500 max-w-md text-sm font-medium leading-relaxed mb-4">
                    All microgrids are currently reporting stable telemetry parameters. No active sensor failures, surge risks, or warnings exist for the current filter setup.
                  </p>
                  <span className="text-[10px] uppercase font-extrabold tracking-widest text-green-700 bg-green-50 border-2 border-green-200 px-3 py-1 rounded-full animate-pulse">
                    Grid Stable
                  </span>
                </motion.div>

              ) : (
                
                filteredAlerts.map((alert) => {
                  const typeConfig = getAlertTypeConfig(alert.type);
                  const TypeIcon = typeConfig.icon;
                  const severityStyles = getSeverityStyles(alert.severity);

                  return (
                    <motion.div
                      layoutId={alert.id}
                      key={alert.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.3 }}
                      className={`bg-gradient-to-br from-white/90 to-slate-200/60 backdrop-blur-md rounded-xl border-2 border-slate-200/50 overflow-hidden flex flex-col sm:flex-row items-stretch shadow-md ${severityStyles.side} hover:border-slate-300 hover:shadow-lg transition-all duration-300 relative group`}
                    >
                      {/* Left icon portion */}
                      <div className={`p-6 flex items-center justify-center ${typeConfig.bg} sm:w-20 border-r border-slate-100`}>
                        <TypeIcon className={`w-8 h-8 ${typeConfig.color}`} />
                      </div>

                      {/* Main details portion */}
                      <div className="p-6 flex-1 flex flex-col justify-between gap-4">
                        
                        <div>
                          
                          {/* Alert Top line status badges */}
                          <div className="flex flex-wrap items-center gap-3 mb-2">
                            
                            {/* Grid Source Name Badge */}
                            <span className="text-xs uppercase font-extrabold tracking-wider bg-slate-50 border border-slate-200 text-slate-800 px-3 py-1 rounded-full shadow-inner">
                              {alert.source}
                            </span>

                            {/* Severity Badge */}
                            <span className={`text-[10px] uppercase font-black tracking-widest px-2.5 py-0.5 rounded-full border-2 ${severityStyles.text} ${severityStyles.bg} ${severityStyles.border}`}>
                              {alert.severity}
                            </span>

                            {/* Status Badge */}
                            <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full flex items-center gap-1.5 ${
                              alert.status === "ACTIVE" 
                                ? "bg-red-50 text-red-700 border-2 border-red-200"
                                : alert.status === "ACKNOWLEDGED"
                                ? "bg-amber-50 text-amber-700 border-2 border-amber-200"
                                : "bg-green-50 text-green-700 border-2 border-green-200"
                            }`}>
                              {alert.status === "ACTIVE" && <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping" />}
                              {alert.status}
                            </span>

                          </div>

                          {/* Diagnostic Message */}
                          <p className="text-slate-900 font-bold text-sm sm:text-base leading-relaxed">
                            {alert.message}
                          </p>

                        </div>

                        {/* Diagnostic bottom timestamp indicator */}
                        <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 font-semibold mt-2 border-t border-slate-100 pt-4">
                          
                          <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1">
                              <Activity className="w-3.5 h-3.5" />
                              ID: {alert.id.split("-").pop()}
                            </span>
                            <span className="flex items-center gap-1" title={formatTime(alert.timestamp)}>
                              <Clock className="w-3.5 h-3.5" />
                              Logged {timeAgo(alert.timestamp)}
                            </span>
                            {alert.resolvedAt && (
                              <span className="flex items-center gap-1 text-green-600" title={formatTime(alert.resolvedAt)}>
                                <Check className="w-3.5 h-3.5" />
                                Resolved {timeAgo(alert.resolvedAt)}
                              </span>
                            )}
                          </div>

                          {/* Action Controls for unresolved alerts */}
                          {(alert.status === "ACTIVE" || alert.status === "ACKNOWLEDGED") && (
                            <div className="flex items-center gap-2">
                              {alert.status === "ACTIVE" && (
                                <button
                                  onClick={() => handleAcknowledge(alert.id)}
                                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-950 border-2 border-slate-200/80 px-4 py-2 rounded-lg font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer text-xs"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  Acknowledge
                                </button>
                              )}
                              
                              <button
                                onClick={() => handleResolve(alert.id)}
                                className="bg-green-50 hover:bg-green-600 text-green-700 hover:text-white border-2 border-green-300 hover:border-transparent px-4 py-2 rounded-lg font-extrabold flex items-center gap-1.5 transition active:scale-95 cursor-pointer text-xs shadow-sm hover:shadow-md"
                              >
                                <Check className="w-3.5 h-3.5" />
                                Resolve Alert
                              </button>
                            </div>
                          )}

                        </div>

                      </div>

                    </motion.div>
                  );
                })

              )}
            </AnimatePresence>
          </div>
        )}

      </section>
    </main>
  );
}