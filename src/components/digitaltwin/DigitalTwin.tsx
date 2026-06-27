"use client";

type Props = {
  telemetry: any;
};

export default function DigitalTwin({
  telemetry,
}: Props) {

  const healthy =
    telemetry?.anomaly === "NORMAL";

  return (
    <div className="bg-gradient-to-br from-white/90 to-slate-200/60 backdrop-blur-md border-2 border-slate-200/50 rounded-2xl p-8 mt-8 text-slate-900 shadow-md">

      <h2 className="text-2xl font-black mb-8 text-slate-800">
        Digital Twin
      </h2>

      <div className="flex items-center justify-between">

        {/* Solar */}
        <div className="flex flex-col items-center">
          <div className="w-24 h-24 rounded-full bg-yellow-400 animate-pulse border-4 border-yellow-200" />
          <p className="mt-3 text-lg font-bold text-slate-700">
            Solar Source
          </p>
        </div>

        {/* Power Flow */}
        <div className="flex-1 h-2.5 mx-6 rounded bg-cyan-600 animate-pulse" />

        {/* Battery */}
        <div className="flex flex-col items-center">
          <div
            className={`
              w-32 h-20 rounded-xl border-4
              flex items-center justify-center
              text-xl font-black
              ${
                healthy
                  ? "border-green-500 text-green-700 bg-green-50/50"
                  : "border-red-500 text-red-600 bg-red-50/50"
              }
            `}
          >
            {telemetry?.battery}%
          </div>

          <p className="mt-3 text-lg font-bold text-slate-700">
            Battery Bank
          </p>
        </div>

        {/* Grid Flow */}
        <div className="flex-1 h-2.5 mx-6 rounded bg-pink-600 animate-pulse" />

        {/* Grid */}
        <div className="flex flex-col items-center">
          <div
            className={`
              w-24 h-24 rounded-full border-4
              ${
                healthy
                  ? "bg-green-600 border-green-200"
                  : "bg-red-600 border-red-200 animate-pulse"
              }
            `}
          />

          <p className="mt-3 text-lg font-bold text-slate-700">
            Microgrid
          </p>
        </div>

      </div>

      {/* Physical Hardware Telemetry Ingest */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 mt-10">

        <div className="bg-white/50 backdrop-blur-sm border border-slate-200/50 p-5 rounded-2xl shadow-sm relative overflow-hidden group hover:shadow-md hover:border-slate-300 transition duration-300">
          <span className="text-xs text-slate-500 font-extrabold uppercase tracking-wider">Mains AC Voltage</span>
          <div className="text-3xl mt-2.5 font-black text-slate-800 flex items-baseline gap-1">
            {telemetry?.voltage !== undefined ? telemetry.voltage : "--"}<span className="text-sm text-slate-400 font-bold">V</span>
          </div>
          <span className="block text-[10px] text-indigo-650 font-bold mt-1 font-mono">ZMPT101B Sensor</span>
        </div>

        <div className="bg-white/50 backdrop-blur-sm border border-slate-200/50 p-5 rounded-2xl shadow-sm relative overflow-hidden group hover:shadow-md hover:border-slate-300 transition duration-300">
          <span className="text-xs text-slate-500 font-extrabold uppercase tracking-wider">Load Consumption</span>
          <div className="text-3xl mt-2.5 font-black text-slate-800 flex items-baseline gap-1">
            {telemetry?.power !== undefined ? telemetry.power : "--"}<span className="text-sm text-slate-400 font-bold">W</span>
          </div>
          <span className="block text-[10px] text-pink-650 font-bold mt-1 font-mono">Active Power Draw</span>
        </div>

        <div className="bg-white/50 backdrop-blur-sm border border-slate-200/50 p-5 rounded-2xl shadow-sm relative overflow-hidden group hover:shadow-md hover:border-slate-300 transition duration-300">
          <span className="text-xs text-slate-500 font-extrabold uppercase tracking-wider">Mains Grid Connection</span>
          <div className="mt-2.5 flex items-center gap-2">
            <span className={`w-3.5 h-3.5 rounded-full ${
              telemetry?.gridPresent !== false 
                ? "bg-green-500 shadow-[0_0_8px_#10B981]" 
                : "bg-red-500 animate-pulse shadow-[0_0_8px_#EF4444]"
            }`} />
            <div className="text-xl font-black text-slate-800 uppercase tracking-tight">
              {telemetry?.gridPresent !== false ? "GRID ONLINE" : "GRID POWER CUT"}
            </div>
          </div>
          <span className="block text-[10px] text-slate-400 font-bold mt-1 font-mono">PC817 Optosensor</span>
        </div>

        <div className="bg-white/50 backdrop-blur-sm border border-slate-200/50 p-5 rounded-2xl shadow-sm relative overflow-hidden group hover:shadow-md hover:border-slate-300 transition duration-300">
          <span className="text-xs text-slate-500 font-extrabold uppercase tracking-wider">Thermal Relay State</span>
          <div className="mt-2.5 flex items-center gap-2">
            <span className={`w-3.5 h-3.5 rounded-full ${
              telemetry?.relay 
                ? "bg-cyan-500 shadow-[0_0_8px_#06B6D4] animate-pulse" 
                : "bg-slate-400 shadow-inner"
            }`} />
            <div className="text-xl font-black text-slate-800 uppercase tracking-tight">
              {telemetry?.relay ? "ACTIVE (ON)" : "INACTIVE (OFF)"}
            </div>
          </div>
          <span className="block text-[10px] text-slate-400 font-bold mt-1 font-mono">GPIO23 Trigger</span>
        </div>

        <div className="bg-white/50 backdrop-blur-sm border border-slate-200/50 p-5 rounded-2xl shadow-sm relative overflow-hidden group hover:shadow-md hover:border-slate-300 transition duration-300">
          <span className="text-xs text-slate-500 font-extrabold uppercase tracking-wider">Mains Temp</span>
          <div className="text-3xl mt-2.5 font-black text-slate-800 flex items-baseline gap-1">
            {telemetry?.temperature !== undefined ? telemetry.temperature : "--"}<span className="text-sm text-slate-400 font-bold">°C</span>
          </div>
          <span className="block text-[10px] text-cyan-650 font-bold mt-1 font-mono">DHT22 Thermal sensor</span>
        </div>

        <div className="bg-white/50 backdrop-blur-sm border border-slate-200/50 p-5 rounded-2xl shadow-sm relative overflow-hidden group hover:shadow-md hover:border-slate-300 transition duration-300">
          <span className="text-xs text-slate-500 font-extrabold uppercase tracking-wider">Air Humidity</span>
          <div className="text-3xl mt-2.5 font-black text-slate-800 flex items-baseline gap-1">
            {telemetry?.humidity !== undefined ? telemetry.humidity : "--"}<span className="text-sm text-slate-400 font-bold">%</span>
          </div>
          <span className="block text-[10px] text-blue-650 font-bold mt-1 font-mono">DHT22 Humidity sensor</span>
        </div>

        <div className="bg-white/50 backdrop-blur-sm border border-slate-200/50 p-5 rounded-2xl shadow-sm relative overflow-hidden group hover:shadow-md hover:border-slate-300 transition duration-300">
          <span className="text-xs text-slate-500 font-extrabold uppercase tracking-wider">Operational Health</span>
          <div className="text-3xl mt-2.5 font-black text-slate-800">
            {telemetry?.csi !== undefined ? telemetry.csi : "100"}<span className="text-sm text-slate-400 font-bold">%</span>
          </div>
          <span className="block text-[10px] text-amber-650 font-bold mt-1 font-mono">Dynamic CSI Score</span>
        </div>

        <div className="bg-white/50 backdrop-blur-sm border border-slate-200/50 p-5 rounded-2xl shadow-sm relative overflow-hidden group hover:shadow-md hover:border-slate-300 transition duration-300">
          <span className="text-xs text-slate-500 font-extrabold uppercase tracking-wider">AI Operations Status</span>
          <div className={`text-xl mt-2.5 font-black uppercase tracking-tight ${
            telemetry?.status === "OPTIMAL" ? "text-green-600" : telemetry?.status === "WARNING" ? "text-amber-600" : "text-red-600"
          }`}>
            {telemetry?.status || "OPTIMAL"}
          </div>
          <span className="block text-[10px] text-slate-400 font-bold mt-1 font-mono">System Integrity</span>
        </div>

      </div>

    </div>
  );
}

