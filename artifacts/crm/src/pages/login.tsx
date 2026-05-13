import { useState } from "react";
import { useLocation } from "wouter";
import { Eye, EyeOff, LogIn } from "lucide-react";
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
      setError(err.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" alt="EstateFlow" className="h-16 w-auto object-contain mb-2" />
          <p className="text-slate-400 text-sm">India's #1 Realty CRM</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl shadow-2xl p-7">
          <h2 className="text-lg font-semibold text-foreground mb-1">Welcome back</h2>
          <p className="text-xs text-muted-foreground mb-6">Sign in to your account to continue</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                placeholder="e.g. admin"
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full h-10 px-3 pr-10 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full h-10 bg-primary text-primary-foreground rounded-lg text-sm font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50 transition"
            >
              {loading ? (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>

        {/* Demo credentials hint */}
        <div className="mt-5 bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Demo credentials</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {[
              { u: "admin",  pw: "Admin@123", role: "Owner (Admin)" },
              { u: "harsh",  pw: "Demo@123",  role: "Owner" },
              { u: "rakesh", pw: "Demo@123",  role: "CFO" },
              { u: "sneha",  pw: "Demo@123",  role: "Manager" },
              { u: "riya",   pw: "Demo@123",  role: "Sales" },
              { u: "vijay",  pw: "Demo@123",  role: "Broker" },
            ].map(d => (
              <button
                key={d.u}
                type="button"
                onClick={() => { setUsername(d.u); setPassword(d.pw); }}
                className="text-left text-[11px] text-slate-300 hover:text-white transition-colors py-0.5"
              >
                <span className="font-mono font-semibold text-slate-200">{d.u}</span>
                <span className="text-slate-500 ml-1">· {d.role}</span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-500 mt-2">Click any row to autofill credentials</p>
        </div>
      </div>
    </div>
  );
}
