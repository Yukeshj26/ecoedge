export default function Header() {
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

      <div className="flex gap-4">
        <div className="bg-green-50/80 backdrop-blur-sm border-2 border-green-200/50 text-green-800 px-4 py-2 rounded-xl font-extrabold shadow-sm">
          MQTT Connected
        </div>
      </div>
    </header>
  );
}