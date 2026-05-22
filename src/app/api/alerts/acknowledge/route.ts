import { NextResponse } from "next/server";
import { alertsStore } from "@/lib/store";

export async function POST(req: Request) {
  try {
    const { id } = await req.json();
    const alert = alertsStore.find((a) => a.id === id);

    if (!alert) {
      return NextResponse.json(
        { success: false, error: "Alert not found" },
        { status: 404 }
      );
    }

    // Update status to ACKNOWLEDGED
    alert.status = "ACKNOWLEDGED";

    return NextResponse.json({
      success: true,
      data: alert,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 400 }
    );
  }
}
