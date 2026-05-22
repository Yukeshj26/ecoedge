import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

// Bind active stores to global object to prevent Next.js dev hot-reload resets
const globalForOtp = global as unknown as {
  activeOtps: Map<string, { otp: string; expiresAt: number; attempts: number }>;
  activeSessions: Map<string, { email: string; token: string; expiresAt: number }>;
};

if (!globalForOtp.activeOtps) {
  globalForOtp.activeOtps = new Map();
}
if (!globalForOtp.activeSessions) {
  globalForOtp.activeSessions = new Map();
}

const activeOtps = globalForOtp.activeOtps;
export const activeSessions = globalForOtp.activeSessions;

const AUTHORIZED_EMAILS = ["admin@ecoedge.com", "admin1inventory@gmail.com"];

// Helper to send a real email using SMTP details if configured
async function sendOtplEmail(email: string, otp: string): Promise<boolean> {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || `"EcoEdge Secure Gateway" <${user}>`;

  if (!host || !port || !user || !pass) {
    // Missing credentials - fallback to Dev Simulation Mode
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: Number(port) === 465, // true for 465, false for 587 or other ports
      auth: {
        user,
        pass,
      },
      connectionTimeout: 10000, // 10s connection timeout
      greetingTimeout: 10000,   // 10s greeting timeout
      socketTimeout: 15000,     // 15s socket timeout
    });

    const mailOptions = {
      from,
      to: email,
      cc: user && user.toLowerCase() !== email.toLowerCase() ? user : undefined, // Carbon Copy to your real inbox
      subject: "🔒 [EcoEdge] Secure Grid Verification Passcode",
      text: `Your EcoEdge administrative verification passcode is: ${otp}. This code is valid for 5 minutes.`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b1120; color: #ffffff; padding: 40px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.08); max-width: 500px; margin: 40px auto; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);">
          <div style="text-align: center; margin-bottom: 24px;">
            <span style="font-size: 28px; font-weight: 900; letter-spacing: -0.05em; color: #06b6d4;">EcoEdge</span>
          </div>
          <h2 style="color: #ffffff; font-size: 20px; font-weight: 700; text-align: center; margin-bottom: 8px;">Security Gateway Clearance</h2>
          <p style="color: #94a3b8; font-size: 14px; text-align: center; line-height: 1.5; margin-bottom: 32px;">
            A verification passcode was requested to unlock the telemetric connections manager for: <br/>
            <strong style="color: #e2e8f0; font-family: monospace;">${email}</strong>
          </p>
          <div style="background-color: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 28px; text-align: center; margin-bottom: 32px; box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.06);">
            <span style="font-family: Courier, monospace; font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #06b6d4; padding-left: 8px;">${otp}</span>
          </div>
          <p style="color: #64748b; font-size: 12px; text-align: center; line-height: 1.6; margin-bottom: 20px;">
            This security code is active for <strong>5 minutes</strong> and is restricted to a single authentication request. If you did not initiate this authorization, please secure your credentials.
          </p>
          <div style="border-t: 1px solid rgba(255,255,255,0.05); pt-20; text-align: center;">
            <span style="font-size: 10px; color: #475569; font-weight: 700; uppercase; letter-spacing: 1px;">Grid Integrity Network Integration</span>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (err) {
    console.error("Failed to send verification email via SMTP:", err);
    return false;
  }
}

// POST endpoint to handle Request OTP and Verify OTP
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, email, otp } = body;

    if (!action) {
      return NextResponse.json(
        { success: false, error: "Missing required parameter 'action'." },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Missing required parameter 'email'." },
        { status: 400 }
      );
    }

    const normEmail = email.trim().toLowerCase();

    // 1. ACTION: REQUEST OTP
    if (action === "request") {
      if (!AUTHORIZED_EMAILS.map(e => e.toLowerCase()).includes(normEmail)) {
        return NextResponse.json(
          {
            success: false,
            error: "Access Denied: The specified email address is not in the system whitelisted administrator directory.",
          },
          { status: 403 }
        );
      }

      // Generate a secure 6-digit OTP passcode
      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minute lifespan

      // Save to memory mapping
      activeOtps.set(normEmail, {
        otp: generatedOtp,
        expiresAt,
        attempts: 0,
      });

      // Attempt to send email
      const isSent = await sendOtplEmail(normEmail, generatedOtp);

      if (isSent) {
        console.log(`[EcoEdge Auth] Verification email successfully sent to ${normEmail}.`);
        return NextResponse.json({
          success: true,
          simulated: false,
          message: "Secure passcode successfully dispatched. Please inspect your inbox.",
        });
      } else {
        // Fallback to Developer Simulation Mode
        console.log("\n========================================================");
        console.log("🔒 [EcoEdge Secure Gateway] SMTP Credentials Not Set.");
        console.log(`🔒 [EcoEdge Secure Gateway] OTP Passcode for admin@ecoedge.com is: ${generatedOtp}`);
        console.log("========================================================\n");

        return NextResponse.json({
          success: true,
          simulated: true,
          otp: generatedOtp,
          message: "Development Mode: SMTP not configured. OTP generated and sent to console logs.",
        });
      }
    }

    // 2. ACTION: VERIFY OTP
    if (action === "verify") {
      if (!otp) {
        return NextResponse.json(
          { success: false, error: "Missing required parameter 'otp'." },
          { status: 400 }
        );
      }

      const activeOtpRecord = activeOtps.get(normEmail);

      if (!activeOtpRecord) {
        return NextResponse.json(
          {
            success: false,
            error: "No pending verification found. Please request a new passcode.",
          },
          { status: 400 }
        );
      }

      if (Date.now() > activeOtpRecord.expiresAt) {
        activeOtps.delete(normEmail);
        return NextResponse.json(
          {
            success: false,
            error: "The verification passcode has expired. Please request a new one.",
          },
          { status: 400 }
        );
      }

      // Increment attempt counter to prevent brute-force
      activeOtpRecord.attempts += 1;
      if (activeOtpRecord.attempts > 3) {
        activeOtps.delete(normEmail);
        return NextResponse.json(
          {
            success: false,
            error: "Too many failed attempts. Passcode invalidated. Please request a new one.",
          },
          { status: 403 }
        );
      }

      if (activeOtpRecord.otp !== otp.trim()) {
        return NextResponse.json(
          {
            success: false,
            error: `Incorrect verification passcode. You have ${4 - activeOtpRecord.attempts} attempts remaining.`,
          },
          { status: 400 }
        );
      }

      // Passcode is verified! Authenticate the session
      activeOtps.delete(normEmail); // Clear code so it can't be re-used

      // Create a unique session token
      const sessionToken = `ecoedge_tok_${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`;
      const sessionExpires = Date.now() + 60 * 60 * 1000; // 1 Hour lifespan

      activeSessions.set(sessionToken, {
        email: normEmail,
        token: sessionToken,
        expiresAt: sessionExpires,
      });

      return NextResponse.json({
        success: true,
        token: sessionToken,
        email: normEmail,
        message: "Passcode verified successfully. Administrative session unlocked.",
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action request parameter." },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error." },
      { status: 500 }
    );
  }
}
