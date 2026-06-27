import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { queryApi, bucket } from "@/lib/influx";

// Map allowed time windows to their aggregate bucket sizes
// so the chart never renders more than ~50 data points
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
      |> filter(fn: (r) => r._measurement == "ecoedge")
      |> filter(fn: (r) => r._field == "power" or r._field == "voltage" or r._field == "battery")
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
        console.error(error);
        resolve(
          NextResponse.json({
            success: false,
            error: error.message,
          })
        );
      },

      complete() {
        console.log("HISTORY ROWS (downsampled):", rows.length);
        resolve(
          NextResponse.json({
            success: true,
            data: rows,
          })
        );
      },
    });
  });
}