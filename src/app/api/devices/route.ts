import { NextResponse } from "next/server";

import { queryApi } from "@/lib/influx";

export async function GET() {
  const query = `
    from(bucket: "telemetry")
      |> range(start: -5m)
      |> last()
  `;

  const rows: any[] = [];

  try {
    await new Promise((resolve, reject) => {
      queryApi.queryRows(query, {
        next(row, tableMeta) {
          rows.push(tableMeta.toObject(row));
        },
        error(error) {
          reject(error);
        },
        complete() {
          resolve(true);
        }
      });
    });

    const grouped: any = {};
    rows.forEach((r) => {
      const device = r.device || "unknown";
      if (!grouped[device]) {
        grouped[device] = { device };
      }
      grouped[device][r._field] = r._value;
    });

    return NextResponse.json({
      success: true,
      data: Object.values(grouped)
    });
  } catch (error: any) {
    console.error("InfluxDB query failed in api/devices, returning fallback offline state:", error.message || error);
    return NextResponse.json({
      success: true,
      data: [],
      error: error.message || "Database offline"
    });
  }
}

