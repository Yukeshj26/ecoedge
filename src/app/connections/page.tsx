"use client";

import { useEffect, useState, useRef } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import { Cpu, CheckCircle, Trash2, ShieldAlert, ArrowRight, Key, Mail, RefreshCw, Layers } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

interface Connection {
  id: string;
  name: string;
  type: string;
  host: string;
  port: string;
  topic: string;
  device?: string;
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
  const [newName, setNewName] = useState<string>(""); // Grid/Village Name
  const [newDevice, setNewDevice] = useState<string>(""); // Device Code ID
  const [formError, setFormError] = useState<string>("");

  // Action states
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  // Input refs for dynamic OTP cursor jumping
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const AUTHORIZED_EMAILS = ["admin@ecoedge.com", "admin1inventory@gmail.com"];

  // Check local session storage on mount
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
      setErrorMsg("Your security code has expired. Please request a new code.");
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
      console.error("Error fetching registered devices:", err);
    }
  };

  // Phase 1: Request OTP Code
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setStatusMsg("");
    setSimulatedOtp("");
    
    if (!emailInput) {
      setErrorMsg("Please enter your registered email address.");
      return;
    }

    if (!AUTHORIZED_EMAILS.map(e => e.toLowerCase()).includes(emailInput.trim().toLowerCase())) {
      setErrorMsg("Access Denied: This email address is not in our authorized operator directory.");
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
          setStatusMsg("Developer Mode: Access code generated below.");
        } else {
          setIsSimulated(false);
          setStatusMsg("Access code sent! Please check your email inbox.");
        }
      } else {
        setErrorMsg(data.error || "Failed to generate security code.");
      }
    } catch (err) {
      setErrorMsg("Unable to connect. Please check your network connection.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Phase 2: Verify OTP
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg("");
    setStatusMsg("");

    const fullOtp = otpDigits.join("");
    if (fullOtp.length !== 6) {
      setErrorMsg("Please enter the complete 6-digit access code.");
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
        
        await fetchConnections(data.token);
        setStep("dashboard");
        setTimerActive(false);
        toast.success("Manager Dashboard Unlocked!", {
          style: { background: "#1F2937", color: "#F9FAFB", border: "1px solid #374151" }
        });
      } else {
        setErrorMsg(data.error || "Incorrect access code. Please try again.");
      }
    } catch (err) {
      setErrorMsg("Connection error. Could not complete verification.");
    } finally {
      setAuthLoading(false);
    }
  };

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
          setStatusMsg("Code resent! Copy the new code below.");
        } else {
          setIsSimulated(false);
          setStatusMsg("A fresh code has been sent. Check your email inbox.");
        }
      } else {
        setErrorMsg(data.error || "Failed to resend code.");
      }
    } catch (err) {
      setErrorMsg("Connection error. Could not resend code.");
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
    if (!/^\d*$/.test(value)) return;
    
    const newDigits = [...otpDigits];
    newDigits[index] = value.slice(-1);
    setOtpDigits(newDigits);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    const isCompleted = newDigits.every(d => d !== "") && index === 5;
    if (isCompleted) {
      setTimeout(() => {
        handleVerifyOtp();
      }, 50);
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Simple Device Ingest Write (Auto-generates technical fields behind the scenes)
  const handleCreateConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!newName || !newDevice) {
      setFormError("Please fill in both the Village Name and the Device Code.");
      return;
    }

    setSubmitting(true);
    try {
      // Auto-configured fields hidden from rural users
      const bodyPayload = {
        name: newName,
        type: "MQTT Broker",
        host: "localhost",
        port: "1883",
        topic: `ecoedge/${newDevice}/telemetry`,
        device: newDevice,
        description: `Registered microgrid for ${newName} (${newDevice}). Registered by community operator.`
      };

      const response = await fetch("/api/connections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(bodyPayload),
      });

      const data = await response.json();
      if (data.success) {
        setConnections((prev) => [...prev, data.data]);
        setShowAddModal(false);
        setNewName("");
        setNewDevice("");
        toast.success("New Microgrid Registered Successfully!", {
          style: { background: "#1F2937", color: "#10B981", border: "1px solid #047857" }
        });
      } else {
        setFormError(data.error || "Failed to save device. Please check details.");
      }
    } catch (err) {
      setFormError("Server error: Could not save microgrid device registry.");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete/Decommission Device
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
        toast.success("Device Removed Successfully", {
          style: { background: "#1F2937", color: "#EF4444", border: "1px solid #F87171" }
        });
      } else {
        toast.error(data.error || "Failed to remove device.");
      }
    } catch (err) {
      toast.error("Server error. Could not remove device.");
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <main className="flex min-h-screen bg-gradient-light text-slate-900 overflow-x-hidden font-sans">
      <Toaster position="top-right" />
      <Sidebar />

      <section className="flex-1 p-8 min-h-screen flex flex-col justify-start relative">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none" />

        {step === "email" && (
          /* SECURITY ACCESS - EMAIL GATE */
          <div className="flex-1 flex flex-col items-center justify-center py-12 relative z-10">
            <div className="bg-white/85 backdrop-blur-md border-2 border-slate-200/50 shadow-2xl rounded-3xl p-10 max-w-lg w-full text-center relative overflow-hidden">
              <div className="w-20 h-20 bg-cyan-50 border-2 border-cyan-200 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm text-cyan-600">
                <Mail className="w-10 h-10" />
              </div>

              <h2 className="text-3xl font-black tracking-tight text-slate-900 mb-2">
                Local Operator Login
              </h2>
              <p className="text-slate-600 text-sm mb-8 leading-relaxed font-semibold">
                Registering new grids requires administrator approval. Enter your whitelisted email address to receive your 6-digit login code.
              </p>

              <form onSubmit={handleRequestOtp} className="space-y-5 text-left">
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-5 h-5" />
                  </span>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="Enter registered operator email"
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-600 text-slate-950 placeholder-slate-400 transition-all text-sm font-bold shadow-sm"
                    required
                  />
                </div>

                {errorMsg && (
                  <div className="bg-red-50 border-2 border-red-200 text-red-800 text-xs px-4 py-3 rounded-xl flex items-start gap-2 shadow-sm font-bold">
                    <ShieldAlert className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-extrabold py-3.5 px-4 rounded-2xl shadow-md transition-all duration-200 transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {authLoading ? (
                    <RefreshCw className="animate-spin w-5 h-5 text-white" />
                  ) : (
                    <>
                      Send Login Code
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>


            </div>
          </div>
        )}

        {step === "otp" && (
          /* ACCESS GATE - SECURITY CODE LAYER */
          <div className="flex-1 flex flex-col items-center justify-center py-12 relative z-10">
            <div className="bg-white/85 backdrop-blur-md border-2 border-slate-200/50 shadow-2xl rounded-3xl p-10 max-w-lg w-full text-center relative overflow-hidden">
              <button
                onClick={() => setStep("email")}
                className="absolute top-6 left-6 text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 transition cursor-pointer font-bold"
              >
                ← Back
              </button>

              <div className="absolute top-6 right-6 px-3 py-1 bg-cyan-50 border-2 border-cyan-200 text-cyan-700 text-xs font-black rounded-lg font-mono flex items-center gap-1 shadow-sm">
                ⏱ {formatTime(timer)}
              </div>

              <div className="w-16 h-16 bg-cyan-50 border-2 border-cyan-200 rounded-full flex items-center justify-center mx-auto mb-6 mt-4 text-cyan-600 shadow-sm">
                <Key className="w-8 h-8" />
              </div>

              <h2 className="text-2xl font-black tracking-tight text-slate-900 mb-2">
                Enter Login Code
              </h2>
              <p className="text-slate-600 text-xs mb-8 leading-relaxed max-w-sm mx-auto font-semibold">
                Enter the simple 6-digit numbers sent to your email to confirm your identity and register device.
              </p>

              {statusMsg && (
                <div className="bg-emerald-50 border-2 border-green-200 text-green-800 text-xs px-4 py-3 rounded-xl mb-6 text-left shadow-sm font-semibold">
                  <strong>Info:</strong> {statusMsg}
                </div>
              )}

              <form onSubmit={handleVerifyOtp} className="space-y-6">
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
                      className="w-12 h-14 bg-slate-50 border-2 border-slate-200 rounded-xl text-center text-xl font-black font-mono focus:outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/10 text-slate-950 transition-all shadow-sm"
                      disabled={timer === 0 || authLoading}
                    />
                  ))}
                </div>

                {errorMsg && (
                  <div className="bg-red-50 border-2 border-red-200 text-red-800 text-xs px-4 py-3 rounded-xl flex items-start gap-2 shadow-sm font-bold">
                    <ShieldAlert className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={timer === 0 || authLoading}
                  className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-extrabold py-3.5 px-4 rounded-2xl shadow-md transition-all duration-200 transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {authLoading ? (
                    <RefreshCw className="animate-spin w-5 h-5 text-white" />
                  ) : (
                    "Verify Access Code"
                  )}
                </button>
              </form>

              <div className="mt-6 text-center text-xs font-bold">
                <span className="text-slate-500">Didn't receive the code?</span>{" "}
                <button
                  onClick={handleResendOtp}
                  disabled={authLoading}
                  className="text-cyan-700 hover:text-cyan-800 font-black transition underline cursor-pointer disabled:opacity-50"
                >
                  Send Again
                </button>
              </div>

              {isSimulated && simulatedOtp && (
                <div className="mt-8 pt-6 border-t-2 border-slate-100">
                  <div className="bg-cyan-50 border-2 border-cyan-200 rounded-2xl p-4 shadow-inner text-left">
                    <span className="block text-[10px] font-black uppercase tracking-wider text-cyan-800 mb-1 leading-none">Developer Sandbox Mode</span>
                    <span className="block text-xs text-slate-600 leading-relaxed mb-3 font-semibold">Copy your temporary access passcode below:</span>
                    <div className="flex items-center justify-between bg-white border-2 border-cyan-200 px-4 py-2.5 rounded-xl shadow-sm">
                      <span className="font-mono text-lg font-black text-slate-900 tracking-widest">{simulatedOtp}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(simulatedOtp);
                          toast.success("Code copied!");
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
          /* PLAIN-LANGUAGE COMMUNITY GRID REGISTRY */
          <div className="flex-1 flex flex-col relative z-10 animate-in fade-in slide-in-from-bottom-5 duration-300">
            
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <h1 className="text-4xl font-black tracking-tight text-slate-900">
                  Community Grid Registry
                </h1>
                <p className="text-slate-600 text-sm mt-1 font-semibold">
                  View and manage all power microgrid devices installed across our villages.
                </p>
              </div>

              {/* Login profile status */}
              <div className="flex items-center gap-3">
                <div className="bg-white/80 backdrop-blur-md border-2 border-green-200/50 rounded-2xl px-4 py-2 flex items-center gap-2.5 shadow-md">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-600 animate-pulse" />
                  <div className="text-left font-sans">
                    <span className="block text-[9px] text-green-700 font-extrabold uppercase tracking-wider leading-none mb-0.5">Operator Active</span>
                    <span className="text-xs text-slate-900 font-bold font-mono">{activeEmail}</span>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  className="bg-red-50 hover:bg-red-100 text-red-700 border-2 border-red-200 p-2.5 rounded-2xl transition-all duration-200 cursor-pointer flex items-center justify-center shadow-sm"
                  title="Logout operator panel"
                >
                  🔒 Lock panel
                </button>
              </div>
            </div>

            {/* Quick Summary metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              
              <div className="bg-gradient-to-br from-white/90 to-cyan-100/60 backdrop-blur-md border-2 border-slate-200/50 rounded-2xl p-5 flex items-center gap-4 shadow-md">
                <div className="w-12 h-12 rounded-xl bg-cyan-50 text-cyan-700 border-2 border-cyan-200 shadow-sm flex items-center justify-center">
                  <Layers className="w-6 h-6" />
                </div>
                <div>
                  <span className="block text-xs text-slate-500 font-extrabold uppercase tracking-wider">Total Grid Devices</span>
                  <span className="text-2xl font-black text-slate-900">{connections.filter(c => c.device).length} Installed</span>
                </div>
              </div>

              <div className="bg-gradient-to-br from-white/90 to-green-100/60 backdrop-blur-md border-2 border-slate-200/50 rounded-2xl p-5 flex items-center gap-4 shadow-md">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 border-2 border-emerald-200 shadow-sm flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <span className="block text-xs text-slate-500 font-extrabold uppercase tracking-wider">Online Status</span>
                  <span className="text-sm font-black text-emerald-700 flex items-center gap-1 mt-0.5">
                    ● Telemetry Streams Active
                  </span>
                </div>
              </div>

              <div className="bg-gradient-to-br from-white/90 to-purple-100/60 backdrop-blur-md border-2 border-slate-200/50 rounded-2xl p-5 flex items-center gap-4 shadow-md">
                <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-700 border-2 border-purple-200 shadow-sm flex items-center justify-center">
                  🛡
                </div>
                <div>
                  <span className="block text-xs text-slate-500 font-extrabold uppercase tracking-wider">Connection Protocol</span>
                  <span className="text-sm font-black text-slate-800 mt-0.5">MQTT Time-series Sync</span>
                </div>
              </div>

            </div>

            {/* Grid listings */}
            {connections.filter(c => c.device).length === 0 ? (
              <div className="flex-1 min-h-[300px] border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center p-8 bg-slate-100/50">
                <Cpu className="w-12 h-12 text-slate-400 mb-4" />
                <h3 className="text-lg font-black text-slate-900 mb-1">No Microgrids Registered</h3>
                <p className="text-sm text-slate-655 text-center max-w-sm mb-6 font-semibold">
                  There are no microgrids registered in the system. Add your first installation using the button below.
                </p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white font-extrabold px-5 py-2.5 rounded-xl transition cursor-pointer shadow-md"
                >
                  + Add Grid Device
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {connections.filter(c => c.device).map((conn) => (
                  <div
                    key={conn.id}
                    className="bg-gradient-to-br from-white/90 to-slate-200/60 backdrop-blur-md border-2 border-slate-200/50 rounded-2xl p-6 shadow-md hover:shadow-lg hover:border-cyan-200 transition-all duration-200 flex flex-col h-full relative"
                  >
                    
                    {/* Grid Name and ID code details */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-cyan-50 border-2 border-cyan-250 flex items-center justify-center text-cyan-600 shrink-0 shadow-sm">
                          <Cpu className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-extrabold text-slate-900 text-base leading-tight truncate max-w-[150px]" title={conn.name}>
                            {conn.name}
                          </h3>
                          <span className="block font-mono text-[9px] font-black uppercase text-slate-400 tracking-wider mt-0.5">
                            Device Code: {conn.device}
                          </span>
                        </div>
                      </div>

                      {/* Simple Live status dot indicator */}
                      <div className="flex items-center gap-1.5 shrink-0 bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-0.5">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-600 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-700"></span>
                        </span>
                        <span className="text-[9px] font-black uppercase tracking-wide">Registered</span>
                      </div>
                    </div>

                    {/* Operator Information details */}
                    <div className="bg-white/50 backdrop-blur-sm rounded-xl p-3.5 space-y-2 mb-4 border-2 border-slate-200/50 text-xs font-semibold text-slate-700 leading-relaxed flex-1">
                      <div>
                        <span className="text-slate-400 font-extrabold uppercase tracking-wider text-[9px] block">Installation Area</span>
                        <span className="font-bold text-slate-800 text-sm mt-0.5 block">{conn.name} Microgrid</span>
                      </div>
                      <div className="pt-2 border-t border-slate-100/50">
                        <span className="text-slate-400 font-extrabold uppercase tracking-wider text-[9px] block">Registered On</span>
                        <span className="font-bold text-slate-800 block">
                          {new Date(conn.createdAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-slate-100/50">
                        <span className="text-slate-400 font-extrabold uppercase tracking-wider text-[9px] block">Registered By</span>
                        <span className="font-mono text-slate-600 truncate block mt-0.5" title={conn.creator}>{conn.creator}</span>
                      </div>
                    </div>

                    {/* Delete option simplified */}
                    <div className="pt-4 border-t-2 border-slate-100 flex items-center justify-end font-sans">
                      {deleteConfirmId === conn.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleDeleteConnection(conn.id)}
                            className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer animate-pulse"
                          >
                            Yes, Remove
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(conn.id)}
                          className="bg-red-50 hover:bg-red-100 text-red-700 border-2 border-red-200 px-3 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                          title="Remove this microgrid device registration"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove Device
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Add new device grid card trigger */}
                <div
                  onClick={() => setShowAddModal(true)}
                  className="bg-slate-100/50 border-2 border-dashed border-slate-300 hover:border-cyan-600 hover:bg-slate-200/30 text-slate-800 rounded-2xl p-6 transition-all duration-200 cursor-pointer flex flex-col items-center justify-center text-center group min-h-[250px]"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-200 group-hover:bg-cyan-50 text-slate-400 group-hover:text-cyan-600 border border-slate-350 group-hover:border-cyan-200 shadow-inner flex items-center justify-center mb-4 transition duration-200">
                    <span className="text-xl font-bold group-hover:scale-110 transition duration-200">+</span>
                  </div>
                  <h3 className="font-extrabold text-slate-800 group-hover:text-cyan-700 transition duration-200">Register New Device</h3>
                  <p className="text-slate-500 text-xs mt-1.5 max-w-[200px] leading-relaxed font-semibold">
                    Add another microgrid hardware installation box securely in your village.
                  </p>
                </div>

              </div>
            )}
          </div>
        )}

        {/* PROVISION NEW CONNECTION OVERLAY MODAL */}
        {showAddModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all duration-200">
            <div className="bg-white/95 backdrop-blur-lg border-2 border-slate-200/50 shadow-2xl rounded-3xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 font-sans">
              
              <div className="px-6 py-5 border-b-2 border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-black tracking-tight text-slate-900">
                  Add New Microgrid Device
                </h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-slate-400 hover:text-slate-700 transition text-lg cursor-pointer font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateConnection} className="p-6 space-y-5">
                {formError && (
                  <div className="bg-red-50 border-2 border-red-200 text-red-800 text-xs px-4 py-3 rounded-xl font-bold">
                    {formError}
                  </div>
                )}

                <div className="space-y-4">
                  
                  {/* Grid Name Input */}
                  <div>
                    <label className="block text-xs font-black uppercase text-slate-500 mb-1.5 tracking-wider">Village / Grid Name</label>
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g. West Village Grid, Clinic Grid"
                      className="w-full bg-slate-50 border-2 border-slate-200 text-slate-900 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/10 transition font-bold"
                      required
                    />
                    <p className="text-[10px] text-slate-400 mt-1 font-semibold">Write a simple, friendly name so everyone knows where this microgrid box is.</p>
                  </div>

                  {/* Device ID Input */}
                  <div>
                    <label className="block text-xs font-black uppercase text-slate-500 mb-1.5 tracking-wider">Device ID Code</label>
                    <input
                      value={newDevice}
                      onChange={(e) => setNewDevice(e.target.value)}
                      placeholder="e.g. device04"
                      className="w-full bg-slate-50 border-2 border-slate-200 text-slate-900 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/10 transition font-mono font-bold"
                      required
                    />
                    <p className="text-[10px] text-slate-400 mt-1 font-semibold">Look at the sticker on the physical microgrid hardware box (e.g. device04).</p>
                  </div>

                </div>

                {/* Submits */}
                <div className="pt-4 border-t-2 border-slate-100 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border-2 border-slate-200 py-3 rounded-xl font-extrabold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white font-extrabold py-3 rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer flex items-center justify-center"
                  >
                    {submitting ? "Registering..." : "Save Grid Device"}
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
