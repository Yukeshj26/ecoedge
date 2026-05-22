import { NextResponse } from "next/server";
import { latestTelemetry } from "@/lib/store";
import { processTelemetryAlerts } from "@/lib/alerts";

export async function POST(req: Request) {

  const body = await req.json();

  Object.assign(latestTelemetry, body);

  console.log("Telemetry Updated:", latestTelemetry);

  // Process live alert checks against incoming telemetry values
  processTelemetryAlerts(latestTelemetry);

  return NextResponse.json({
    success: true,
  });
}


export async function GET() {

  return NextResponse.json(latestTelemetry);
}