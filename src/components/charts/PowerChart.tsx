"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export default function PowerChart({
  data,
}: {
  data: any[];
}) {

  console.log("CHART DATA:", data);

  return (

    <div className="bg-gradient-to-br from-white/90 to-cyan-100/35 backdrop-blur-md border-2 border-slate-200/50 rounded-2xl p-6 w-full h-[400px] text-slate-900 shadow-md hover:border-cyan-200 transition-all duration-300">

      <h2 className="text-xl font-bold text-slate-800 mb-4">
        Voltage History
      </h2>

      <ResponsiveContainer
        width="100%"
        height="100%"
      >

        <LineChart data={data}>

          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />

          <XAxis 
            dataKey="time" 
            stroke="#475569" 
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
          />

          <Line
            type="monotone"
            dataKey="power"
            stroke="#0891B2"
            strokeWidth={4}
            dot={false}
          />

        </LineChart>

      </ResponsiveContainer>

    </div>
  );
}