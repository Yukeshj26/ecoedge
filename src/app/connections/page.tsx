"use client";

import { useEffect, useState, useRef } from "react";
import Sidebar from "@/components/dashboard/Sidebar";

interface Connection {
  id: string;
  name: string;
  type: string;
  host: string;
  port: string;
  topic: string;
  description: string;
  status: string;
  creator: string;
  createdAt: string;
}

type AuthStep = "email" | "otp" | "dashboard";

export default function ConnectionsPage() {
  const [step, setStep] = useState<AuthStep>("email");
  const [emailInput, setEmailInput] = useState<string>("");
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(6).fill(""));
  const [errorMsg, setErrorMsg] = useState<string>("");
  
  // Simulated OTP state for Developer Mode
  const [simulatedOtp, setSimulatedOtp] = useState<string>("");
  const [isSimulated, setIsSimulated] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>("");

  // Connections Data State
  const [connections, setConnections] = useState<Connection[]>([]);
  const [sessionToken, setSessionToken] = useState<string>("");
  const [activeEmail, setActiveEmail] = useState<string>("");
  
  // Timer countdown state (5 minutes = 300s)
  const [timer, setTimer] = useState<number>(300);
  const [timerActive, setTimerActive] = useState<boolean>(false);

  // Modal State
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>("");
  const [newType, setNewType] = useState<string>("MQTT Broker");
  const [newHost, setNewHost] = useState<string>("");
  const [newPort, setNewPort] = useState<string>("");
  const [newTopic, setNewTopic] = useState<string>("");
  const [newDesc, setNewDesc] = useState<string>("");
  const [formError, setFormError] = useState<string>("");

  // Action states
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  // Input refs for dynamic OTP cursor jumping
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const AUTHORIZED_EMAILS = ["admin@ecoedge.com", "admin1inventory@gmail.com"];

  // Check local session storage on mount and validate with backend
  useEffect(() => {
    const savedToken = localStorage.getItem("ecoedge_session_token");
    const savedEmail = localStorage.getItem("ecoedge_admin_email");
    
    if (savedToken && savedEmail && AUTHORIZED_EMAILS.map(e => e.toLowerCase()).includes(savedEmail.toLowerCase())) {
      setSessionToken(savedToken);
      setActiveEmail(savedEmail);
      validateSavedSession(savedToken);
    }
  }, []);

  // Timer countdown side effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (timerActive && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else if (timer === 0) {
      setTimerActive(false);
      setErrorMsg("Passcode has expired. Please request a new verification code.");
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerActive, timer]);

  const validateSavedSession = async (token: string) => {
    try {
      const res = await fetch("/api/connections", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const json = await res.json();
      if (json.success) {
        setConnections(json.data);
        setStep("dashboard");
      } else {
        // Token is invalid/expired - reset storage
        localStorage.removeItem("ecoedge_session_token");
        localStorage.removeItem("ecoedge_admin_email");
      }
    } catch (err) {
      console.error("Saved session validation failed:", err);
    }
  };

  const fetchConnections = async (token: string) => {
    try {
      const res = await fetch("/api/connections", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const json = await res.json();
      if (json.success) {
        setConnections(json.data);
      }
    } catch (err) {
      console.error("Error fetching connections:", err);
    }
  };

  // Phase 1: Request OTP Code
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setStatusMsg("");
    setSimulatedOtp("");
    
    if (!emailInput) {
      setErrorMsg("Please enter your email address.");
      return;
    }

    if (!AUTHORIZED_EMAILS.map(e => e.toLowerCase()).includes(emailInput.trim().toLowerCase())) {
      setErrorMsg("Access Denied: This email address is not in the system's authorized administrator directory.");
      return;
    }

    setAuthLoading(true);
    try {
      const response = await fetch("/api/connections/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "request",
          email: emailInput.trim(),
        }),
      });

      const data = await response.json();
      if (data.success) {
        setStep("otp");
        setTimer(300); // 5 minutes
        setTimerActive(true);
        setOtpDigits(Array(6).fill(""));
        
        if (data.simulated) {
          setIsSimulated(true);
          setSimulatedOtp(data.otp);
          setStatusMsg("Developer Mode: E-mail dispatch simulated. A copy of the OTP is provided below.");
        } else {
          setIsSimulated(false);
          setStatusMsg("Secure Passcode Dispatched. Please check your whitelisted email inbox.");
        }
      } else {
        setErrorMsg(data.error || "Failed to issue verification passcode.");
      }
    } catch (err) {
      setErrorMsg("Server error: Could not complete authentication request.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Phase 2: Verify OTP and Unlock Session
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg("");
    setStatusMsg("");

    const fullOtp = otpDigits.join("");
    if (fullOtp.length !== 6) {
      setErrorMsg("Please enter the complete 6-digit passcode.");
      return;
    }

    setAuthLoading(true);
    try {
      const response = await fetch("/api/connections/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "verify",
          email: emailInput.trim(),
          otp: fullOtp,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSessionToken(data.token);
        setActiveEmail(data.email);
        localStorage.setItem("ecoedge_session_token", data.token);
        localStorage.setItem("ecoedge_admin_email", data.email);
        
        // Fetch secure data and unlock dashboard
        await fetchConnections(data.token);
        setStep("dashboard");
        setTimerActive(false);
      } else {
        setErrorMsg(data.error || "Verification failed. Incorrect code.");
      }
    } catch (err) {
      setErrorMsg("Server error: Could not complete passcode validation.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Resend OTP code utility
  const handleResendOtp = async () => {
    setErrorMsg("");
    setStatusMsg("");
    setSimulatedOtp("");
    setOtpDigits(Array(6).fill(""));

    setAuthLoading(true);
    try {
      const response = await fetch("/api/connections/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "request",
          email: emailInput.trim(),
        }),
      });

      const data = await response.json();
      if (data.success) {
        setTimer(300);
        setTimerActive(true);
        if (data.simulated) {
          setIsSimulated(true);
          setSimulatedOtp(data.otp);
          setStatusMsg("Code Resent (Developer Mode): Copy the updated passcode below.");
        } else {
          setIsSimulated(false);
          setStatusMsg("A fresh passcode has been sent. Check your administrator inbox.");
        }
      } else {
        setErrorMsg(data.error || "Failed to resend code.");
      }
    } catch (err) {
      setErrorMsg("Server error: Could not resend authentication code.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setStep("email");
    setEmailInput("");
    setOtpDigits(Array(6).fill(""));
    setSessionToken("");
    setActiveEmail("");
    setErrorMsg("");
    setStatusMsg("");
    setSimulatedOtp("");
    localStorage.removeItem("ecoedge_session_token");
    localStorage.removeItem("ecoedge_admin_email");
  };

  // Keyboard navigation listeners for OTP blocks
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // Allow numbers only
    
    const newDigits = [...otpDigits];
    // Keep only the last character entered
    newDigits[index] = value.slice(-1);
    setOtpDigits(newDigits);

    // Auto-focus next input if a number is typed
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Automatically trigger verification when the final digit is entered
    const isCompleted = newDigits.every(d => d !== "") && index === 5;
    if (isCompleted) {
      // Small timeout to let state update fully
      setTimeout(() => {
        const fullOtp = newDigits.join("");
        triggerAutoVerify(fullOtp);
      }, 50);
    }
  };

  const triggerAutoVerify = async (fullOtp: string) => {
    setErrorMsg("");
    setStatusMsg("");
    setAuthLoading(true);
    try {
      const response = await fetch("/api/connections/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "verify",
          email: emailInput.trim(),
          otp: fullOtp,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSessionToken(data.token);
        setActiveEmail(data.email);
        localStorage.setItem("ecoedge_session_token", data.token);
        localStorage.setItem("ecoedge_admin_email", data.email);
        await fetchConnections(data.token);
        setStep("dashboard");
        setTimerActive(false);
      } else {
        setErrorMsg(data.error || "Verification failed. Incorrect code.");
      }
    } catch (err) {
      setErrorMsg("Server error: Could not complete passcode validation.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Focus previous input on backspace if empty
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Diagnostic Test Connection Action
  const handleTestConnection = (id: string) => {
    setTestingId(id);
    setTestResult(null);

    setTimeout(() => {
      setTestingId(null);
      setTestResult({ id, success: true });

      setTimeout(() => {
        setTestResult(null);
      }, 3000);
    }, 1200);
  };

  // API Write: Register Connection
  const handleCreateConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!newName || !newHost || !newPort) {
      setFormError("Please fill out the connection Name, Host/URL, and Port fields.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/connections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          name: newName,
          type: newType,
          host: newHost,
          port: newPort,
          topic: newTopic,
          description: newDesc,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setConnections((prev) => [...prev, data.data]);
        setShowAddModal(false);
        setNewName("");
        setNewType("MQTT Broker");
        setNewHost("");
        setNewPort("");
        setNewTopic("");
        setNewDesc("");
      } else {
        setFormError(data.error || "Failed to create connection.");
      }
    } catch (err) {
      setFormError("Server error: Could not complete connection registration.");
    } finally {
      setSubmitting(false);
    }
  };

  // API Write: Delete Connection
  const handleDeleteConnection = async (id: string) => {
    try {
      const response = await fetch(`/api/connections?id=${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${sessionToken}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setConnections((prev) => prev.filter((c) => c.id !== id));
        setDeleteConfirmId(null);
      } else {
        alert(data.error || "Failed to delete connection.");
      }
    } catch (err) {
      alert("Server error: Could not complete connection decommissioning.");
    }
  };

  // Format seconds to MM:SS string
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <main className="flex min-h-screen bg-gradient-light text-slate-900 overflow-x-hidden font-sans">
      <Sidebar />

      <section className="flex-1 p-8 min-h-screen flex flex-col justify-start relative">
        {/* Glow ambient effects */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-20 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />

        {step === "email" && (
          /* ACCESS GATE - EMAIL LAYER */
          <div className="flex-1 flex flex-col items-center justify-center py-12 relative z-10">
            <div className="bg-white/80 backdrop-blur-md border-2 border-slate-200/50 shadow-2xl rounded-3xl p-10 max-w-lg w-full text-center relative overflow-hidden transition-all duration-300">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-cyan-600/30 rounded-tl-3xl pointer-events-none" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-cyan-600/30 rounded-tr-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-cyan-600/30 rounded-bl-3xl pointer-events-none" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-cyan-600/30 rounded-br-3xl pointer-events-none" />

              <div className="w-20 h-20 bg-cyan-50 border-2 border-cyan-200 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                <svg className="w-10 h-10 text-cyan-655" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>

              <h2 className="text-3xl font-black tracking-tight text-slate-900 mb-2">
                Secure Ingest Gateway
              </h2>
              <p className="text-slate-655 text-sm mb-8 leading-relaxed font-semibold">
                Unlock connection administration. A secure verification passcode will be sent to the whitelisted inbox to authenticate your session.
              </p>

              <form onSubmit={handleRequestOtp} className="space-y-5 text-left">
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-slate-450" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </span>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="Enter whitelisted admin email"
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-600 text-slate-955 placeholder-slate-400 transition-all text-sm font-bold shadow-sm"
                    required
                  />
                </div>

                {errorMsg && (
                  <div className="bg-red-50 border-2 border-red-200 text-red-850 text-xs px-4 py-3 rounded-xl flex items-start gap-2 shadow-sm font-bold">
                    <svg className="w-4 h-4 mt-0.5 shrink-0 text-red-650" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>{errorMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-extrabold py-3.5 px-4 rounded-2xl shadow-md transition-all duration-200 transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {authLoading ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Issuing Passcode...
                    </>
                  ) : (
                    <>
                      Send Verification Code
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </>
                  )}
                </button>
              </form>

              {/* Simulation Help Banner */}
              <div className="mt-8 pt-6 border-t-2 border-slate-100">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-cyan-50 text-cyan-800 border-2 border-cyan-200/60 text-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-655 animate-pulse shrink-0" />
                  Whitelisted Directory: <strong className="text-cyan-900 font-extrabold ml-1">admin@ecoedge.com</strong> or <strong className="text-cyan-900 font-extrabold">admin1inventory@gmail.com</strong>
                </span>
              </div>
            </div>
          </div>
        )}

        {step === "otp" && (
          /* ACCESS GATE - OTP LAYER */
          <div className="flex-1 flex flex-col items-center justify-center py-12 relative z-10">
            <div className="bg-white/80 backdrop-blur-md border-2 border-slate-200/50 shadow-2xl rounded-3xl p-10 max-w-lg w-full text-center relative overflow-hidden transition-all duration-300">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-cyan-600/30 rounded-tl-3xl pointer-events-none" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-cyan-600/30 rounded-tr-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-cyan-600/30 rounded-bl-3xl pointer-events-none" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-cyan-600/30 rounded-br-3xl pointer-events-none" />

              <button
                onClick={() => setStep("email")}
                className="absolute top-6 left-6 text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1.5 transition cursor-pointer font-bold"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back
              </button>

              {/* Countdown stopwatch badge */}
              <div className="absolute top-6 right-6 px-3 py-1 bg-cyan-50 border-2 border-cyan-200 text-cyan-700 text-xs font-black rounded-lg font-mono flex items-center gap-1.5 shadow-sm">
                <svg className={`w-3.5 h-3.5 ${timerActive ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatTime(timer)}
              </div>

              <div className="w-16 h-16 bg-cyan-50 border-2 border-cyan-200 rounded-full flex items-center justify-center mx-auto mb-6 mt-4 text-cyan-600">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>

              <h2 className="text-2xl font-black tracking-tight text-slate-900 mb-2">
                Enter Verification Passcode
              </h2>
              <p className="text-slate-655 text-xs mb-8 leading-relaxed max-w-sm mx-auto font-semibold">
                A 6-digit verification code has been dispatched. Enter the passcode below to verify your identity.
              </p>

              {statusMsg && (
                <div className="bg-emerald-50 border-2 border-green-200 text-green-800 text-xs px-4 py-3 rounded-xl mb-6 text-left shadow-sm font-semibold">
                  <strong>Status:</strong> {statusMsg}
                </div>
              )}

              <form onSubmit={handleVerifyOtp} className="space-y-6">
                {/* 6-Digit dynamic inputs */}
                <div className="flex justify-between gap-2.5 max-w-sm mx-auto">
                  {otpDigits.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { inputRefs.current[i] = el; }}
                      type="text"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className="w-12 h-14 bg-slate-50 border-2 border-slate-200 rounded-xl text-center text-xl font-black font-mono focus:outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/10 text-slate-955 transition-all shadow-sm"
                      disabled={timer === 0 || authLoading}
                    />
                  ))}
                </div>

                {errorMsg && (
                  <div className="bg-red-50 border-2 border-red-200 text-red-850 text-xs px-4 py-3 rounded-xl flex items-start gap-2 shadow-sm font-bold">
                    <svg className="w-4 h-4 mt-0.5 shrink-0 text-red-650" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>{errorMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={timer === 0 || authLoading}
                  className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-extrabold py-3.5 px-4 rounded-2xl shadow-md transition-all duration-200 transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {authLoading ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Validating Passcode...
                    </>
                  ) : (
                    <>
                      Verify & Unlock Gateway
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
                      </svg>
                    </>
                  )}
                </button>
              </form>

              {/* Resend passcode trigger */}
              <div className="mt-6 text-center text-xs">
                <span className="text-slate-500 font-bold">Didn't receive code?</span>{" "}
                <button
                  onClick={handleResendOtp}
                  disabled={authLoading}
                  className="text-cyan-700 hover:text-cyan-850 font-black transition underline cursor-pointer disabled:opacity-50"
                >
                  Resend Code
                </button>
              </div>

              {/* Developer OTP simulated output panel */}
              {isSimulated && simulatedOtp && (
                <div className="mt-8 pt-6 border-t-2 border-slate-100">
                  <div className="bg-cyan-50 border-2 border-cyan-200 rounded-2xl p-4 relative overflow-hidden shadow-inner text-left">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-cyan-500/5 rounded-full blur-xl" />
                    
                    <span className="block text-[10px] font-black uppercase tracking-wider text-cyan-850 leading-none mb-1">Developer Sandbox Info</span>
                    <span className="block text-xs text-slate-600 leading-relaxed mb-3 font-semibold">SMTP variables not found in .env.local. Copy passcode below:</span>
                    
                    <div className="flex items-center justify-between bg-white border-2 border-cyan-200 px-4 py-2.5 rounded-xl shadow-sm">
                      <span className="font-mono text-lg font-black text-slate-900 tracking-widest">{simulatedOtp}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(simulatedOtp);
                          setStatusMsg("Passcode copied to clipboard!");
                        }}
                        className="bg-cyan-600 hover:bg-cyan-700 text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {step === "dashboard" && (
          /* CONNECTIONS DASHBOARD PANEL */
          <div className="flex-1 flex flex-col relative z-10 animate-in fade-in slide-in-from-bottom-5 duration-300">
            {/* Header Dashboard Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <h1 className="text-4xl font-black tracking-tight text-slate-900">
                  Grid Connections
                </h1>
                <p className="text-slate-600 text-sm mt-1 font-semibold">
                  Manage active time-series database syncs and telemetry message queues.
                </p>
              </div>

              {/* Session Lock Profile Badge */}
              <div className="flex items-center gap-3">
                <div className="bg-white/80 backdrop-blur-md border-2 border-green-200/50 rounded-2xl px-4 py-2 flex items-center gap-2.5 shadow-md">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-600 animate-pulse" />
                  <div className="text-left">
                    <span className="block text-[9px] text-green-700 font-extrabold uppercase tracking-wider leading-none mb-0.5">Session Crypt-Active</span>
                    <span className="text-xs text-slate-900 font-bold font-mono">{activeEmail || "Administrator"}</span>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  className="bg-red-50 hover:bg-red-100 text-red-750 border-2 border-red-200 p-2.5 rounded-2xl transition-all duration-200 cursor-pointer flex items-center justify-center group shadow-sm"
                  title="Lock Administrative Access"
                >
                  <svg className="w-5 h-5 group-hover:scale-105 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <div className="bg-gradient-to-br from-white/90 to-cyan-100/60 backdrop-blur-md border-2 border-slate-200/50 rounded-2xl p-5 flex items-center gap-4 shadow-md">
                <div className="w-12 h-12 rounded-xl bg-cyan-50 text-cyan-700 border-2 border-cyan-200 shadow-sm flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                <div>
                  <span className="block text-xs text-slate-500 font-extrabold uppercase tracking-wider">Total Connectors</span>
                  <span className="text-2xl font-black text-slate-900">{connections.length}</span>
                </div>
              </div>

              <div className="bg-gradient-to-br from-white/90 to-green-100/60 backdrop-blur-md border-2 border-slate-200/50 rounded-2xl p-5 flex items-center gap-4 shadow-md">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 border-2 border-emerald-200 shadow-sm flex items-center justify-center">
                  <svg className="w-6 h-6 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <span className="block text-xs text-slate-500 font-extrabold uppercase tracking-wider">Active Ingestors</span>
                  <span className="text-2xl font-black text-emerald-700">
                    {connections.filter((c) => c.status === "Connected").length}
                  </span>
                </div>
              </div>

              <div className="bg-gradient-to-br from-white/90 to-purple-100/60 backdrop-blur-md border-2 border-slate-200/50 rounded-2xl p-5 flex items-center gap-4 shadow-md">
                <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-700 border-2 border-purple-200 shadow-sm flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <span className="block text-xs text-slate-500 font-extrabold uppercase tracking-wider">Encryption Protocol</span>
                  <span className="text-sm font-black text-slate-800 flex items-center gap-1.5 mt-0.5 flex-wrap">
                    TLS 1.3 Active
                    <span className="inline-block px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-250 text-[9px] font-black uppercase font-sans">Secure</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Ingestion Connector Grid */}
            {connections.length === 0 ? (
              <div className="flex-1 min-h-[300px] border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center p-8 bg-slate-100/50">
                <svg className="w-12 h-12 text-slate-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <h3 className="text-lg font-black text-slate-900 mb-1">No Active Integrations</h3>
                <p className="text-sm text-slate-600 text-center max-w-sm mb-6 font-semibold">
                  There are no telemetry ingestion connections registered in the system database. Register one to start sync.
                </p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white font-extrabold px-5 py-2.5 rounded-xl transition cursor-pointer shadow-md"
                >
                  + Add New Connection
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {connections.map((conn) => {
                  const isMqtt = conn.type.includes("MQTT");
                  const isInflux = conn.type.includes("Influx");

                  return (
                    <div
                      key={conn.id}
                      className="bg-gradient-to-br from-white/90 to-slate-200/60 backdrop-blur-md border-2 border-slate-200/50 rounded-2xl p-6 shadow-md hover:shadow-lg hover:border-cyan-200 transition-all duration-200 flex flex-col h-full relative min-w-0"
                    >
                      {/* Title and Badging */}
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 shrink-0 ${
                              isMqtt
                                ? "bg-cyan-50 text-cyan-700 border-cyan-200"
                                : isInflux
                                ? "bg-purple-50 text-purple-700 border-purple-200"
                                : "bg-blue-50 text-blue-700 border-blue-200"
                            }`}
                          >
                            {isMqtt ? (
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
                              </svg>
                            ) : isInflux ? (
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                              </svg>
                            )}
                          </div>

                          <div className="min-w-0">
                            <h3 className="font-extrabold text-slate-900 text-base leading-tight truncate" title={conn.name}>{conn.name}</h3>
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase mt-1 border ${
                                isMqtt
                                  ? "bg-cyan-50 text-cyan-800 border-cyan-200"
                                  : isInflux
                                  ? "bg-purple-50 text-purple-800 border-purple-200"
                                  : "bg-blue-50 text-blue-800 border-blue-200"
                              }`}
                            >
                              {conn.type}
                            </span>
                          </div>
                        </div>

                        {/* Live Ingest Status */}
                        <div className="flex items-center gap-1.5 shrink-0 bg-green-50/80 backdrop-blur-sm text-green-700 border-2 border-green-200/50 rounded-full px-2 py-0.5">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-600 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-700"></span>
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-wide">Connected</span>
                        </div>
                      </div>

                      {/* Technical Spec List */}
                      <div className="bg-white/50 backdrop-blur-sm rounded-xl p-3.5 space-y-2 mb-4 border-2 border-slate-200/50 font-sans">
                        <div className="flex items-center justify-between text-xs gap-3 min-w-0">
                          <span className="text-slate-500 font-extrabold uppercase tracking-wider text-[10px] shrink-0">Host URL</span>
                          <span className="font-mono text-slate-900 font-bold truncate text-right max-w-[65%]" title={conn.host}>{conn.host}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs gap-3 min-w-0">
                          <span className="text-slate-500 font-extrabold uppercase tracking-wider text-[10px] shrink-0">Port</span>
                          <span className="font-mono text-slate-900 font-bold truncate text-right max-w-[65%]">{conn.port}</span>
                        </div>
                        {conn.topic && conn.topic !== "N/A" && (
                          <div className="flex items-center justify-between text-xs gap-3 min-w-0">
                            <span className="text-slate-500 font-extrabold uppercase tracking-wider text-[10px] shrink-0">
                              {isInflux ? "Bucket" : "Topic"}
                            </span>
                            <span className="font-mono text-cyan-750 font-bold truncate text-right max-w-[65%]" title={conn.topic}>{conn.topic}</span>
                          </div>
                        )}
                      </div>

                      {/* Description */}
                      <p className="text-slate-600 text-xs mb-6 flex-1 leading-relaxed font-semibold">{conn.description}</p>

                      {/* Diagnostics and Action Options */}
                      <div className="pt-4 border-t-2 border-slate-100 flex items-center justify-between gap-3 font-sans">
                        <button
                          onClick={() => handleTestConnection(conn.id)}
                          disabled={testingId !== null}
                          className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border-2 border-slate-200/80 rounded-xl py-2 px-3 text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
                        >
                          {testingId === conn.id ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-1.5 h-3.5 w-3.5 text-cyan-650" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              Checking...
                            </>
                          ) : testResult?.id === conn.id && testResult.success ? (
                            <span className="text-green-700 font-extrabold flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                              Online
                            </span>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                              </svg>
                              Test Ingestion
                            </>
                          )}
                        </button>

                        {deleteConfirmId === conn.id ? (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleDeleteConnection(conn.id)}
                              className="bg-red-600 hover:bg-red-500 text-white px-2.5 py-1.5 rounded-lg text-xs font-black transition cursor-pointer animate-pulse"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-650 hover:text-slate-800 border border-slate-200 px-2 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(conn.id)}
                            className="bg-red-55 hover:bg-red-100 text-red-600 border-2 border-red-200 p-2.5 rounded-xl transition cursor-pointer flex items-center justify-center shadow-sm"
                            title="Decommission Connector"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Dotted Provision Card */}
                <div
                  onClick={() => setShowAddModal(true)}
                  className="bg-slate-100/50 border-2 border-dashed border-slate-300 hover:border-cyan-600 hover:bg-slate-200/30 text-slate-800 rounded-2xl p-6 transition-all duration-200 cursor-pointer flex flex-col items-center justify-center text-center group min-h-[300px]"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-200 group-hover:bg-cyan-55 text-slate-400 group-hover:text-cyan-655 border border-slate-300 group-hover:border-cyan-200 shadow-inner flex items-center justify-center mb-4 transition duration-200">
                    <svg className="w-6 h-6 transform group-hover:scale-110 transition duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <h3 className="font-extrabold text-slate-850 group-hover:text-cyan-750 transition duration-200">Register Connection</h3>
                  <p className="text-slate-500 text-xs mt-1.5 max-w-[200px] leading-relaxed font-semibold">
                    Provision another telemetry stream ingestion broker or API target.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PROVISION NEW CONNECTION OVERLAY MODAL */}
        {showAddModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all duration-200">
            <div className="bg-white/90 backdrop-blur-lg border-2 border-slate-200/50 shadow-2xl rounded-3xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 font-sans">
              <div className="px-6 py-5 border-b-2 border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-black tracking-tight text-slate-900">
                  Register Integration Broker
                </h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-slate-400 hover:text-slate-705 transition text-lg cursor-pointer font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateConnection} className="p-6 space-y-4">
                {formError && (
                  <div className="bg-red-50 border-2 border-red-200 text-red-800 text-xs px-4 py-3 rounded-xl font-bold">
                    {formError}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-black uppercase text-slate-505 mb-1.5 tracking-wider">Connection Name</label>
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g. Primary Ingestion Queue"
                      className="w-full bg-slate-50 border-2 border-slate-200 text-slate-900 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/10 transition font-bold"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase text-slate-505 mb-1.5 tracking-wider">Integration Type</label>
                    <select
                      value={newType}
                      onChange={(e) => setNewType(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-slate-200 text-slate-900 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/10 transition font-bold"
                    >
                      <option className="bg-white text-slate-900" value="MQTT Broker">MQTT Broker</option>
                      <option className="bg-white text-slate-900" value="InfluxDB Instance">InfluxDB Instance</option>
                      <option className="bg-white text-slate-900" value="HTTP Telemetry Webhook">HTTP Webhook</option>
                      <option className="bg-white text-slate-900" value="Node-RED Webhook">Node-RED</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase text-slate-550 mb-1.5 tracking-wider">Port</label>
                    <input
                      value={newPort}
                      onChange={(e) => setNewPort(e.target.value)}
                      placeholder="e.g. 1883 or 8086"
                      className="w-full bg-slate-50 border-2 border-slate-200 text-slate-900 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/10 transition font-mono font-bold"
                      required
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-black uppercase text-slate-550 mb-1.5 tracking-wider">Server Host / URL</label>
                    <input
                      value={newHost}
                      onChange={(e) => setNewHost(e.target.value)}
                      placeholder="e.g. broker.hivemq.com or http://localhost"
                      className="w-full bg-slate-50 border-2 border-slate-200 text-slate-900 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/10 transition font-mono font-bold"
                      required
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-black uppercase text-slate-550 mb-1.5 tracking-wider">
                      {newType.includes("Influx") ? "Bucket Name" : "MQTT Topic / Webhook Endpoint"}
                    </label>
                    <input
                      value={newTopic}
                      onChange={(e) => setNewTopic(e.target.value)}
                      placeholder={newType.includes("Influx") ? "e.g. telemetry" : "e.g. ecoedge/device01/telemetry"}
                      className="w-full bg-slate-50 border-2 border-slate-200 text-slate-900 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/10 transition font-mono font-bold"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-black uppercase text-slate-550 mb-1.5 tracking-wider">Description</label>
                    <textarea
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      placeholder="Brief note outlining this integration's role in grid operations..."
                      rows={3}
                      className="w-full bg-slate-50 border-2 border-slate-200 text-slate-900 rounded-xl p-4 text-sm focus:outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/10 transition resize-none font-bold"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t-2 border-slate-100 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-705 border-2 border-slate-200 py-3 rounded-xl font-extrabold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white font-extrabold py-3 rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer flex items-center justify-center"
                  >
                    {submitting ? "Registering..." : "Provision Ingestor"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
