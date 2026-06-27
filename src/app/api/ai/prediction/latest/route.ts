import { NextResponse } from "next/server";
import { queryApi, bucket } from "@/lib/influx";
import { calculateCSI } from "@/lib/csi";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const model = searchParams.get("model") || "lstm"; // default to lstm

  if (model === "rf") {
    // 1. Fetch latest telemetry for Random Forest model features
    const telemetryQuery = `
      from(bucket: "${bucket}")
        |> range(start: -5m)
        |> filter(fn: (r) => r._measurement == "ecoedge")
        |> last()
    `;

    const rows: any[] = [];
    try {
      await new Promise<void>((resolve, reject) => {
        queryApi.queryRows(telemetryQuery, {
          next(row, tableMeta) {
            rows.push(tableMeta.toObject(row));
          },
          error(err) {
            reject(err);
          },
          complete() {
            resolve();
          }
        });
      });
    } catch (error: any) {
      return NextResponse.json({ success: false, error: error.message });
    }

    const telemetry: any = { voltage: 230, battery: 80, power: 150 };
    rows.forEach((r) => {
      telemetry[r._field] = r._value;
    });

    const csi = calculateCSI(telemetry.voltage, telemetry.battery, telemetry.power);
    const solar = telemetry.power > 250 ? Math.round(telemetry.power * 0.8) : 120;
    const load = Math.round(telemetry.power * 1.1);

    // 2. Query stateless Flask AI server for Random Forest prediction
    try {
      const aiServerUrl = process.env.AI_SERVER_URL || process.env.NEXT_PUBLIC_AI_SERVER_URL || "http://127.0.0.1:5000";
      const aiResponse = await fetch(`${aiServerUrl}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voltage: Number(telemetry.voltage),
          battery: Number(telemetry.battery),
          power: Number(telemetry.power),
          csi: Number(csi),
          solar: Number(solar),
          load: Number(load),
          model: "rf",
          mode: "live"
        }),
        signal: AbortSignal.timeout(1000)
      });

      if (aiResponse.ok) {
        const aiJson = await aiResponse.json();
        return NextResponse.json({
          success: true,
          data: {
            backup_time: aiJson.backup_time,
            predicted_power: telemetry.power,
            model_version: "RF_v1.0.0"
          }
        });
      }
    } catch (err) {
      console.error("AI Server fetch error for RF model:", err);
    }

    // Fallback if Flask server is unreachable
    return NextResponse.json({
      success: true,
      data: {
        backup_time: Number(((telemetry.battery / 100) * 12).toFixed(2)),
        predicted_power: telemetry.power,
        model_version: "RF_Fallback"
      }
    });
  }

  // Else, query pre-computed predictions (LSTM model) from InfluxDB predictions measurement
  const predQuery = `
    from(bucket: "${bucket}")
      |> range(start: -5m)
      |> filter(fn: (r) => r._measurement == "predictions")
      |> last()
  `;

  const rows: any[] = [];

  return new Promise<NextResponse>((resolve) => {
    queryApi.queryRows(predQuery, {
      next(row, tableMeta) {
        rows.push(tableMeta.toObject(row));
      },

      error(error) {
        resolve(
          NextResponse.json({
            success: false,
            error: error.message,
          })
        );
      },

      complete() {
        if (rows.length === 0) {
          return resolve(
            NextResponse.json({
              success: true,
              data: {
                backup_time: 12.0,
                predicted_power: 150.0,
                model_version: "LSTM_v1.0.0"
              }
            })
          );
        }

        const result: any = {
          backup_time: 12.0,
          predicted_power: 150.0,
          model_version: "LSTM_v1.0.0"
        };

        rows.forEach((r) => {
          result[r._field] = r._value;
        });

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
