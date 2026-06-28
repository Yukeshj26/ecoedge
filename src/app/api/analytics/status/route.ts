import { NextResponse } from "next/server";
import { queryApi, bucket } from "@/lib/influx";
import { calculateCSI } from "@/lib/csi";
import { detectAnomaly } from "@/lib/anomaly";
import { predictMaintenance } from "@/lib/predictive";

export async function GET() {
  const query = `
    from(bucket: "${bucket}")
      |> range(start: -5m)
      |> filter(fn: (r) => r._measurement == "analytics")
      |> last()
  `;

  const rows: any[] = [];

  return new Promise<NextResponse>((resolve) => {
    queryApi.queryRows(query, {
      next(row, tableMeta) {
        rows.push(tableMeta.toObject(row));
      },

      error(error) {
        console.warn("InfluxDB analytics status query failed, using fallback:", error.message);
        resolve(
          NextResponse.json({
            success: true,
            data: {
              csi: 80,
              anomaly: "NORMAL",
              maintenance: { risk: 20, status: "LOW" }
            }
          })
        );
      },

      async complete() {
        if (rows.length === 0) {
          // If no pre-computed analytics exist in the database, query latest telemetry and compute them on the fly (fallback)
          const telemetryQuery = `
            from(bucket: "${bucket}")
              |> range(start: -5m)
              |> filter(fn: (r) => r._measurement == "ecoedge")
              |> last()
          `;
          
          const telRows: any[] = [];
          
          queryApi.queryRows(telemetryQuery, {
            next(row, tableMeta) {
              telRows.push(tableMeta.toObject(row));
            },
            error(err) {
              resolve(
                NextResponse.json({
                  success: true,
                  data: {
                    csi: 80,
                    anomaly: "NORMAL",
                    maintenance: { risk: 20, status: "LOW" }
                  }
                })
              );
            },
            complete() {
              if (telRows.length === 0) {
                return resolve(
                  NextResponse.json({
                    success: true,
                    data: {
                      csi: 80,
                      anomaly: "NORMAL",
                      maintenance: { risk: 20, status: "LOW" }
                    }
                  })
                );
              }
              
              const telData: any = { voltage: 230, battery: 80, power: 150 };
              telRows.forEach((r) => {
                telData[r._field] = r._value;
              });
              
              const csi = calculateCSI(telData.voltage, telData.battery, telData.power);
              const anomaly = detectAnomaly(telData.voltage, telData.battery, telData.power);
              const maint = predictMaintenance(telData.battery, telData.voltage, telData.power);
              
              resolve(
                NextResponse.json({
                  success: true,
                  data: {
                    csi,
                    anomaly,
                    maintenance: maint
                  }
                })
              );
            }
          });
          return;
        }

        const data: any = {};
        rows.forEach((r) => {
          data[r._field] = r._value;
        });

        // Map database fields to the exact object schema the frontend expects
        const result = {
          csi: Number(data.csi ?? 80),
          anomaly: String(data.anomaly ?? "NORMAL"),
          maintenance: {
            risk: Number(data.maintenance_risk ?? 20),
            status: String(data.status ?? data.maintenance_status ?? "LOW")
          }
        };

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
