import { NextResponse } from "next/server";
import { alertsStore } from "@/lib/store";

export async function GET() {
  return NextResponse.json({
    success: true,
    data: alertsStore,
  });
}

export async function DELETE() {
  const beforeCount = alertsStore.length;
  
  // Clear acknowledged and resolved alerts, keeping only live ACTIVE ones
  const activeAlerts = alertsStore.filter((a) => a.status === "ACTIVE");
  alertsStore.splice(0, alertsStore.length, ...activeAlerts);
  
  const clearedCount = beforeCount - alertsStore.length;

  return NextResponse.json({
    success: true,
    message: `Cleared ${clearedCount} resolved/acknowledged alerts from archive.`,
    clearedCount,
  });
}
