interface StatCardProps {
  title: string;
  value: string;
  color?: string;
}

export default function StatCard({
  title,
  value,
  color = "text-slate-900",
}: StatCardProps) {
  // Determine premium light gradient based on active color grouping
  const getGradientClasses = (textColor: string) => {
    if (textColor.includes("cyan")) return "from-white/90 to-cyan-100/60 border-cyan-200/50 hover:border-cyan-400/60";
    if (textColor.includes("green")) return "from-white/90 to-green-100/60 border-green-200/50 hover:border-green-400/60";
    if (textColor.includes("amber")) return "from-white/90 to-amber-100/60 border-amber-200/50 hover:border-amber-400/60";
    if (textColor.includes("pink")) return "from-white/90 to-pink-100/60 border-pink-200/50 hover:border-pink-400/60";
    if (textColor.includes("orange")) return "from-white/90 to-orange-100/60 border-orange-200/50 hover:border-orange-400/60";
    if (textColor.includes("red")) return "from-white/90 to-red-100/60 border-red-200/50 hover:border-red-400/60";
    return "from-white/90 to-slate-200/50 border-slate-200/50 hover:border-cyan-200/60";
  };

  const gradientClasses = getGradientClasses(color);

  return (
    <div className={`bg-gradient-to-br ${gradientClasses} backdrop-blur-md rounded-2xl p-4 sm:p-5 lg:p-6 shadow-md hover:shadow-lg transition-all duration-300 relative group overflow-hidden min-w-0`}>
      <p className="text-[10px] sm:text-xs font-extrabold uppercase tracking-widest text-slate-500 truncate" title={title}>
        {title}
      </p>

      <h2 
        className={`text-xl sm:text-2xl lg:text-3xl font-black mt-2.5 tracking-tight truncate leading-none ${color}`}
        title={value}
      >
        {value}
      </h2>
    </div>
  );
}