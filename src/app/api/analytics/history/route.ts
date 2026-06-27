import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { queryApi, bucket } from "@/lib/influx";

// Map allowed time windows to their aggregate bucket sizes
const WINDOW_CONFIG: Record<string, { range: string; every: string }> = {
  "5m":  { range: "-5m",  every: "6s"  },
  "15m": { range: "-15m", every: "18s" },
  "30m": { range: "-30m", every: "36s" },
  "1h":  { range: "-1h",  every: "72s" },
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const windowKey = searchParams.get("window") ?? "15m";
  const cfg = WINDOW_CONFIG[windowKey] ?? WINDOW_CONFIG["15m"];

  const query = `
    from(bucket: "${bucket}")
      |> range(start: ${cfg.range})
      |> filter(fn: (r) => r._measurement == "analytics")
      |> filter(fn: (r) => r._field == "csi" or r._field == "maintenance_risk")
      |> aggregateWindow(every: ${cfg.every}, fn: mean, createEmpty: false)
      |> sort(columns: ["_time"])
  `;

  const rows: any[] = [];

  return new Promise<NextResponse>((resolve) => {
    queryApi.queryRows(query, {
      next(row, tableMeta) {
        rows.push(tableMeta.toObject(row));
      },

      error(error) {
        console.error("[Analytics History]", error);
        resolve(
          NextResponse.json({
            success: false,
            error: error.message,
          })
        );
      },

      complete() {
        // Merge rows that share the same timestamp into one data point
        const grouped = new Map<number, any>();

        rows.forEach((r: any) => {
          const ts = new Date(r._time).getTime();
          if (!grouped.has(ts)) {
            grouped.set(ts, { time: ts, csi: 0, maintenance_risk: 0 });
          }
          const existing = grouped.get(ts);
          if (r._field === "csi") existing.csi = Number(r._value);
          if (r._field === "maintenance_risk") existing.maintenance_risk = Number(r._value);
        });

        const data = Array.from(grouped.values())
          .sort((a, b) => a.time - b.time)
          .slice(-60); // cap at 60 points

        resolve(
          NextResponse.json({
            success: true,
            data,
          })
        );
      },
    });
  });
}
