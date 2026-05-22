"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const menu = [
  {
    name: "Overview",
    path: "/",
  },
  {
    name: "Devices",
    path: "/devices",
  },

  {
    name: "Analytics",
    path: "/analytics",
  },
  {
    name: "AI Predictions",
    path: "/predictions",
  },
  {
    name: "Alerts",
    path: "/alerts",
  },
  {
    name: "Connections",
    path: "/connections",
  },
];
export default function Sidebar() {

  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white/70 backdrop-blur-md border-r border-slate-200/50 p-6">

      <h1 className="text-4xl font-black text-cyan-600 mb-10">
        EcoEdge
      </h1>

      <nav className="space-y-3">

        {menu.map((item) => (
          <Link
            key={item.path}
            href={item.path}
            className={`
              block px-4 py-3 rounded-xl transition font-bold
              ${
                pathname === item.path
                  ? "bg-cyan-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }
            `}
          >
            {item.name}
          </Link>
        ))}

      </nav>

    </aside>
  );
}