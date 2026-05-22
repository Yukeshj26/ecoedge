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

      {/* Telemetry */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-10">

        <div className="bg-white/50 backdrop-blur-sm border border-slate-200/50 p-4 rounded-xl shadow-sm">
          <span className="text-sm text-slate-500 font-bold uppercase tracking-wider">Voltage:</span>
          <div className="text-2xl mt-2 font-black text-slate-800">
            {telemetry?.voltage}V
          </div>
        </div>

        <div className="bg-white/50 backdrop-blur-sm border border-slate-200/50 p-4 rounded-xl shadow-sm">
          <span className="text-sm text-slate-500 font-bold uppercase tracking-wider">Power:</span>
          <div className="text-2xl mt-2 font-black text-slate-800">
            {telemetry?.power}W
          </div>
        </div>

        <div className="bg-white/50 backdrop-blur-sm border border-slate-200/50 p-4 rounded-xl shadow-sm">
          <span className="text-sm text-slate-500 font-bold uppercase tracking-wider">CSI Score:</span>
          <div className="text-2xl mt-2 font-black text-slate-800">
            {telemetry?.csi}
          </div>
        </div>

        <div className="bg-white/50 backdrop-blur-sm border border-slate-200/50 p-4 rounded-xl shadow-sm">
          <span className="text-sm text-slate-500 font-bold uppercase tracking-wider">Status:</span>
          <div className="text-2xl mt-2 font-black text-slate-800">
            {telemetry?.anomaly}
          </div>
        </div>

      </div>

    </div>
  );
}

