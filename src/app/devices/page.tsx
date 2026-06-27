"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import { useRouter } from "next/navigation";
import { Cpu, Activity, Battery, Zap, AlertTriangle, CheckCircle, HelpCircle } from "lucide-react";

export default function DevicesPage() {
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Fetch registered devices (from Connections API) & their live telemetry
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        // Fetch connections (secure registry database)
        const connRes = await fetch("/api/connections");
        const connJson = await connRes.json();
        
        // Fetch live InfluxDB telemetry parameters
        const telRes = await fetch("/api/devices");
        const telJson = await telRes.json();

        if (connJson.success && telJson.success) {
          // Filter connections that represent microgrid devices (type is MQTT Broker or explicitly has device mapped)
          const registeredDevices = connJson.data.filter((c: any) => c.device || c.type === "MQTT Broker");
          const liveTelemetry = telJson.data;

          // Merge connection registrations with live telemetry values
          const merged = registeredDevices.map((conn: any) => {
            const deviceId = conn.device || (conn.topic && conn.topic.includes("/") ? conn.topic.split("/").find((p: string) => p.includes("device")) : "");
            const telemetry = liveTelemetry.find((t: any) => t.device === deviceId);

            return {
              device: deviceId || conn.id,
              name: conn.name,
              voltage: telemetry && telemetry.voltage !== undefined ? `${Number(telemetry.voltage).toFixed(1)}V` : "--",
              battery: telemetry && telemetry.battery !== undefined ? `${Number(telemetry.battery).toFixed(0)}%` : "--",
              power: telemetry && telemetry.power !== undefined ? `${Number(telemetry.power).toFixed(0)}W` : "--",
              isOnline: !!telemetry,
              batteryNum: telemetry && telemetry.battery !== undefined ? Number(telemetry.battery) : null,
            };
          });

          // Sort by device ID or name to keep order stable
          merged.sort((a: any, b: any) => a.device.localeCompare(b.device));

          setDevices(merged);
        }
      } catch (err) {
        console.error("Failed to sync registered devices with live telemetry:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
    const interval = setInterval(fetchAllData, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="flex min-h-screen bg-gradient-light text-slate-900 overflow-hidden font-sans">
      <Sidebar />

      <section className="flex-1 p-8 overflow-y-auto relative min-h-screen">
        {/* Ambient lighting */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-cyan-500/5 rounded-full blur-[100px] pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
              Live Microgrids
            </h1>
            <p className="text-slate-600 text-sm mt-1 font-semibold">
              Registry and live parameters of whitelisted microgrid installations.
            </p>
          </div>

          <button
            onClick={() => router.push("/connections")}
            className="bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-3 rounded-xl font-extrabold hover:scale-105 active:scale-95 transition shadow-sm cursor-pointer flex items-center gap-2"
          >
            <Cpu className="w-4 h-4" />
            + Register Device
          </button>
        </div>

        {/* Loading feed */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="animate-spin w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full" />
            <span className="text-slate-500 font-bold text-sm">Syncing device registry...</span>
          </div>
        ) : devices.length === 0 ? (
          /* Empty state */
          <div className="border-2 border-dashed border-slate-200 rounded-3xl p-16 flex flex-col items-center justify-center text-center max-w-2xl mx-auto bg-white/50 backdrop-blur-md mt-10 shadow-sm">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center border-2 border-slate-200 text-slate-400 mb-6">
              <HelpCircle className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-bold text-slate-950 mb-2">No Registered Devices</h3>
            <p className="text-slate-600 font-semibold text-sm max-w-sm mb-6 leading-relaxed">
              No microgrids are currently registered in your admin database. Unlock the secure Connections page to provision a new device.
            </p>
            <button
              onClick={() => router.push("/connections")}
              className="bg-cyan-600 text-white font-extrabold px-6 py-3 rounded-xl transition hover:bg-cyan-700 cursor-pointer shadow-md"
            >
              Secure Registry Gate
            </button>
          </div>
        ) : (
          /* Microgrid Cards Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {devices.map((device) => {
              const battery = device.batteryNum;
              const isOnline = device.isOnline;

              let theme = {
                bg: "bg-gradient-to-br from-slate-50/90 to-slate-100/50 border-slate-300 text-slate-950 shadow-md",
                badgeBg: "bg-slate-200 text-slate-800",
                badgeText: "OFFLINE",
                textContrast: "text-slate-700",
                boldContrast: "text-slate-900"
              };

              if (isOnline) {
                if (battery > 70) {
                  theme = {
                    bg: "bg-gradient-to-br from-green-50/85 to-emerald-200/50 border-green-300/50 text-green-950 shadow-md",
                    badgeBg: "bg-green-600 text-white",
                    badgeText: "OPTIMAL",
                    textContrast: "text-green-800",
                    boldContrast: "text-green-950"
                  };
                } else if (battery > 40) {
                  theme = {
                    bg: "bg-gradient-to-br from-amber-50/85 to-orange-200/50 border-amber-300/50 text-amber-950 shadow-md",
                    badgeBg: "bg-amber-500 text-white",
                    badgeText: "WARNING",
                    textContrast: "text-amber-800",
                    boldContrast: "text-amber-950"
                  };
                } else {
                  theme = {
                    bg: "bg-gradient-to-br from-red-50/85 to-rose-200/50 border-red-300/50 text-red-950 shadow-md",
                    badgeBg: "bg-red-600 text-white",
                    badgeText: "CRITICAL",
                    textContrast: "text-red-800",
                    boldContrast: "text-red-950"
                  };
                }
              }

              return (
                <div
                  key={device.device}
                  className={`rounded-2xl p-6 border-2 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] backdrop-blur-sm relative overflow-hidden group flex flex-col justify-between ${theme.bg}`}
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-xl pointer-events-none group-hover:scale-125 transition" />
                  
                  <div>
                    <h2 className="text-2xl font-black text-slate-800 mb-2 leading-tight tracking-tight">
                      {device.name}
                    </h2>
                    
                    <span className="block font-mono text-[10px] font-black uppercase text-slate-450 tracking-wider mb-4">
                      ID: {device.device}
                    </span>

                    {/* Status Badge */}
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black mb-6 ${theme.badgeBg}`}>
                      {isOnline && <span className="relative flex h-1.5 w-1.5 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white"></span>
                      </span>}
                      {theme.badgeText}
                    </div>
                  </div>

                  {/* Operational parameters */}
                  <div className="space-y-3 bg-white/40 border border-white/40 p-4 rounded-xl font-sans mt-2 shadow-inner">
                    <div className="flex items-center justify-between text-sm">
                      <span className={`${theme.textContrast} font-bold flex items-center gap-1.5`}>
                        <Zap className="w-3.5 h-3.5 shrink-0" />
                        Voltage
                      </span>
                      <span className={`font-black ${theme.boldContrast}`}>{device.voltage}</span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className={`${theme.textContrast} font-bold flex items-center gap-1.5`}>
                        <Battery className="w-3.5 h-3.5 shrink-0" />
                        Battery Charge
                      </span>
                      <span className={`font-black ${theme.boldContrast}`}>{device.battery}</span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className={`${theme.textContrast} font-bold flex items-center gap-1.5`}>
                        <Activity className="w-3.5 h-3.5 shrink-0" />
                        Power Usage
                      </span>
                      <span className={`font-black ${theme.boldContrast}`}>{device.power}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}