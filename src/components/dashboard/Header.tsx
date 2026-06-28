import { Play } from "lucide-react";

interface HeaderProps {
  isSimulating?: boolean;
  toggleSimulation?: (val: boolean) => void;
}

export default function Header({ isSimulating = false, toggleSimulation }: HeaderProps) {
  return (
    <header className="flex items-center justify-between mb-8">
      <div>
        <h2 className="text-3xl font-black text-slate-900">
          Central Sustainability Dashboard
        </h2>

        <p className="text-slate-500 font-medium mt-1">
          Real-time AI-powered energy intelligence
        </p>
      </div>

      <div className="flex gap-4 items-center">
        {toggleSimulation && (
          <button
            onClick={() => toggleSimulation(!isSimulating)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black border-2 transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-sm ${
              isSimulating
                ? "bg-amber-50 border-amber-300 text-amber-800"
                : "bg-white/70 hover:bg-white border-slate-200 text-slate-700"
            }`}
          >
            {isSimulating ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" />
                Stop Software Simulator
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                Run Software Simulator
              </>
            )}
          </button>
        )}

        <div className="bg-green-50/80 backdrop-blur-sm border-2 border-green-200/50 text-green-800 px-4 py-2 rounded-xl font-extrabold shadow-sm text-xs flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
          {isSimulating ? "MQTT Mocked" : "MQTT Connected"}
        </div>
      </div>
    </header>
  );
}