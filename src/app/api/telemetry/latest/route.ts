import { NextResponse } from "next/server";
import { queryApi, bucket } from "@/lib/influx";
import { calculateCSI } from "@/lib/csi";
import { predictMaintenance } from "@/lib/predictive";
import { detectAnomaly } from "@/lib/anomaly";
import { processTelemetryAlerts } from "@/lib/alerts";
export async function GET() {
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -5m)
      |> filter(fn: (r) => r._measurement == "ecoedge")
      |> last()
  `;

  const rows: any[] = [];

  return new Promise<NextResponse>((resolve) => {
    queryApi.queryRows(query, {
      next(row, tableMeta) {
        const data = tableMeta.toObject(row);
        rows.push(data);
      },

      error(error) {
        resolve(
          NextResponse.json({
            success: false,
            error: error.message,
          })
        );
      },

      async complete() {
        const result: any = {};

        rows.forEach((r) => {
          result[r._field] = r._value;
        });
        result.csi = calculateCSI( result.voltage, result.battery, result.power );
        result.anomaly = detectAnomaly( result.voltage, result.battery, result.power );
            
        result.maintenance =
        predictMaintenance(
            result.battery,
            result.voltage,
            result.power
        );

        // Standardize Solar and Load calculations across pages
        result.solar = result.power > 250 ? Math.round(result.power * 0.8) : 120;
        result.load = Math.round(result.power * 1.1);

        // Fetch prediction from local AI Server
        let backup_time = 0;
        try {
          const aiServerUrl = process.env.AI_SERVER_URL || process.env.NEXT_PUBLIC_AI_SERVER_URL || "http://127.0.0.1:5000";
          const aiResponse = await fetch(`${aiServerUrl}/predict`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              voltage: Number(result.voltage),
              battery: Number(result.battery),
              power: Number(result.power),
              csi: Number(result.csi),
              solar: Number(result.solar),
              load: Number(result.load),
            }),
            signal: AbortSignal.timeout(1000)
          });

          if (aiResponse.ok) {
            const aiJson = await aiResponse.json();
            backup_time = aiJson.backup_time;
          } else {
            backup_time = (result.battery / 100) * 12;
          }
        } catch (err) {
          console.error("AI Predict server-side fetch error:", err);
          backup_time = (result.battery / 100) * 12;
        }

        result.prediction = backup_time;

        // Run the real-time alert evaluation rules on the telemetry data
        processTelemetryAlerts(result);

        resolve(
          NextResponse.json({
            success: true,
            data: result,
          })
        );
      },
    });
  });
}
