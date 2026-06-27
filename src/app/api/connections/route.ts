import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { activeSessions } from "./verify/route";

const filePath = path.join(process.cwd(), "src/data/connections.json");

// Helper to read connections from JSON file
async function readConnections() {
  try {
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading connections database:", err);
    return [];
  }
}

// Helper to write connections to JSON file
async function writeConnections(connections: any[]) {
  try {
    await fs.writeFile(filePath, JSON.stringify(connections, null, 2), "utf-8");
    return true;
  } catch (err) {
    console.error("Error writing connections database:", err);
    return false;
  }
}

// Helper to validate active session token
function validateSession(req: Request) {
  const authHeader = req.headers.get("Authorization");
  
  if (!authHeader) {
    return { isValid: false, error: "Authentication credentials are required." };
  }

  const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;
  const session = activeSessions.get(token);

  if (!session) {
    return { isValid: false, error: "Access Denied: Administrative session token is invalid or inactive." };
  }

  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return { isValid: false, error: "Access Denied: Administrative session has expired. Please verify again." };
  }

  return { isValid: true, email: session.email };
}

// GET: Fetch all connections (Public query for grid display)
export async function GET() {
  const connections = await readConnections();
  return NextResponse.json({
    success: true,
    data: connections,
  });
}

// POST: Add a new connection (Restricted to Valid Session Token)
export async function POST(req: Request) {
  try {
    const sessionCheck = validateSession(req);

    if (!sessionCheck.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: sessionCheck.error,
        },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { name, type, host, port, topic, description, device } = body;

    if (!name || !type || !host || !port) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation Failed: Connection name, type, host, and port are required.",
        },
        { status: 400 }
      );
    }

    const connections = await readConnections();

    const newConnection = {
      id: `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      type,
      host,
      port,
      topic: topic || "N/A",
      device: device || "",
      description: description || "No description provided.",
      status: "Connected",
      creator: sessionCheck.email!,
      createdAt: new Date().toISOString(),
    };

    connections.push(newConnection);
    const writeSuccess = await writeConnections(connections);

    if (!writeSuccess) {
      return NextResponse.json(
        {
          success: false,
          error: "Database Error: Failed to persist the connection in store.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: newConnection,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || "An unexpected server-side error occurred.",
      },
      { status: 500 }
    );
  }
}

// DELETE: Delete an existing connection (Restricted to Valid Session Token)
export async function DELETE(req: Request) {
  try {
    const sessionCheck = validateSession(req);

    if (!sessionCheck.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: sessionCheck.error,
        },
        { status: 401 }
      );
    }

    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation Failed: Connection ID is required for deletion.",
        },
        { status: 400 }
      );
    }

    const connections = await readConnections();
    const targetConnection = connections.find((c: any) => c.id === id);

    if (!targetConnection) {
      return NextResponse.json(
        {
          success: false,
          error: "Not Found: The specified connection ID does not exist.",
        },
        { status: 404 }
      );
    }

    const updatedConnections = connections.filter((c: any) => c.id !== id);
    const writeSuccess = await writeConnections(updatedConnections);

    if (!writeSuccess) {
      return NextResponse.json(
        {
          success: false,
          error: "Database Error: Failed to persist deletion in store.",
        },
        { status: 500 }
      );
    }

    // Purge alerts associated with the deleted device grid name
    try {
      const { alertsStore } = require("@/lib/store");
      if (Array.isArray(alertsStore)) {
        const remainingAlerts = alertsStore.filter((a: any) => a.source !== targetConnection.name);
        alertsStore.splice(0, alertsStore.length, ...remainingAlerts);
      }
    } catch (err) {
      console.error("Failed to dynamically purge deleted grid alerts:", err);
    }

    return NextResponse.json({
      success: true,
      message: "Connection successfully decommissioned.",
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || "An unexpected server-side error occurred.",
      },
      { status: 500 }
    );
  }
}
