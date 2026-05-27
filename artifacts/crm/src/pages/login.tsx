import { useState } from "react";
import { useLocation } from "wouter";
import { Eye, EyeOff, Lock, User, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username.trim(), password);
      setLocation("/dashboard");
    } catch (err: any) {
      setError(err.message ?? "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Left brand panel ───────────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[55%] relative flex-col justify-between p-10 overflow-hidden"
        style={{ background: "linear-gradient(145deg, #0B1D6E 0%, #1438A8 45%, #1a3fa8 70%, #0f2d8c 100%)" }}
      >
        {/* Decorative circles */}
        <div className="absolute -top-28 -left-28 w-[360px] h-[360px] rounded-full pointer-events-none"
          style={{ background: "rgba(255,255,255,0.06)" }} />
        <div className="absolute top-[30%] -right-24 w-[260px] h-[260px] rounded-full pointer-events-none"
          style={{ background: "rgba(255,255,255,0.05)" }} />
        <div className="absolute -bottom-20 right-[5%] w-[340px] h-[340px] rounded-full pointer-events-none"
          style={{ background: "rgba(255,255,255,0.06)" }} />
        <div className="absolute bottom-[20%] left-8 w-[120px] h-[120px] rounded-full pointer-events-none"
          style={{ background: "rgba(255,255,255,0.04)" }} />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <img src="/logo.png" alt="RealtySell" className="h-11 w-auto object-contain drop-shadow-md" />
        </div>

        {/* Hero copy */}
        <div className="relative z-10 space-y-7">
          <div className="space-y-4">
            <h1 className="text-[2.4rem] font-bold text-white leading-[1.15] tracking-tight">
              Close more deals,<br />built for your team.
            </h1>
            <p className="text-blue-200 text-[15px] leading-relaxed max-w-[340px]">
              India's smartest real estate CRM. Track leads, schedule viewings, and grow your revenue — all in one platform.
            </p>
          </div>

          <div className="flex flex-col gap-3.5">
            {[
              "Lead & Pipeline Management",
              "Smart Site Visit Scheduling",
              "Commission Tracking & Splits",
            ].map(f => (
              <div key={f} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center"
                  style={{ background: "rgba(6,182,212,0.22)" }}>
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-300" />
                </div>
                <span className="text-[14px] text-white font-medium">{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-blue-300/60 text-xs">© 2026 RealtySell by TirthonTech. All rights reserved.</p>
        </div>
      </div>

      {/* ── Right form panel ──────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-6 py-10 bg-white overflow-y-auto">
        <div className="w-full max-w-[360px]">

          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <img src="/logo.png" alt="RealtySell" className="h-9 w-auto object-contain" />
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-[1.6rem] font-bold text-gray-900 leading-tight">Welcome back</h2>
            <p className="text-gray-500 text-sm mt-1">Sign in to access your dashboard</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Username</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
                  <User className="w-4 h-4 text-gray-400" />
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  placeholder="Enter your username"
                  className="w-full h-11 pl-10 pr-4 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 transition"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
                  <Lock className="w-4 h-4 text-gray-400" />
                </span>
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••••"
                  className="w-full h-11 pl-10 pr-11 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  className="absolute inset-y-0 right-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full h-11 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-60 btn-gradient mt-1"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Signing in…
                </>
              ) : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
