import { useState } from "react";
import {
  useGetDashboardStats, useGetDashboardPipeline, useGetRecentActivity,
  useGetLeadSources, useGetLeads, useGetAgents, getGetLeadsQueryKey,
} from "@workspace/api-client-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  Building2, Users, TrendingUp, GitBranch, Activity, ArrowUpRight, ArrowDownRight,
  AlertTriangle, CheckCircle2, Clock, Target, DollarSign, BarChart3, Layers,
  UserCheck, ChevronRight, Home, ShieldCheck, Zap, XCircle, TrendingDown,
} from "lucide-react";
import { cn, formatCurrency, stageLabel, timeAgo, scoreColor } from "@/lib/utils";
import { Link } from "wouter";
import { useRole } from "@/lib/role-context";

/* ─── Shared ─────────────────────────────────────────────────────────── */
function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("bg-card border border-card-border rounded-xl p-5", className)}>{children}</div>;
}
function SectionTitle({ icon: Icon, title, sub, action }: { icon: React.ElementType; title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary" />
        <div>
          <h2 className="text-sm font-semibold text-foreground leading-none">{title}</h2>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}
function KpiCard({ label, value, sub, icon: Icon, accent, trend, up }: {
  label: string; value: string; sub?: string; icon: React.ElementType;
  accent?: string; trend?: string; up?: boolean;
}) {
  return (
    <Card className={cn("border-l-4 hover:shadow-md transition-shadow", accent ?? "border-l-primary")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary flex-shrink-0"><Icon className="w-4 h-4" /></div>
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
            <p className="text-xl font-bold text-foreground mt-0.5 leading-none">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
        </div>
        {trend && (
          <span className={cn("flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0", up ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600")}>
            {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}{trend}
          </span>
        )}
      </div>
    </Card>
  );
}

/* ─── Mock data ───────────────────────────────────────────────────────── */
const PROJECTS = [
  { id: 1, name: "Prestige Lakeside",        location: "Whitefield, Bangalore",    type: "Residential", totalUnits: 120, sold: 78,  available: 32, underReview: 10, issues: 3, timeline: 72, completionDate: "Dec 2025", pricePerSqft: 8500, avgSqft: 1200, status: "Under Construction", pendingApprovals: 2 },
  { id: 2, name: "Godrej Summit",             location: "Hinjewadi, Pune",           type: "Residential", totalUnits: 200, sold: 158, available: 42, underReview: 0,  issues: 1, timeline: 95, completionDate: "Apr 2026", pricePerSqft: 6800, avgSqft: 1400, status: "Ready to Move",       pendingApprovals: 0 },
  { id: 3, name: "DLF Cybercity Residences",  location: "Sector 54, Gurugram",       type: "Commercial",  totalUnits: 80,  sold: 22,  available: 50, underReview: 8,  issues: 5, timeline: 38, completionDate: "Mar 2027", pricePerSqft: 14200, avgSqft: 900, status: "Under Construction", pendingApprovals: 5 },
  { id: 4, name: "Sobha Royal Crest",         location: "Sarjapur Road, Bangalore",  type: "Residential", totalUnits: 150, sold: 91,  available: 45, underReview: 14, issues: 0, timeline: 60, completionDate: "Sep 2026", pricePerSqft: 9800, avgSqft: 1600, status: "Under Construction", pendingApprovals: 3 },
];

const MILESTONES: Record<number, { name: string; done: boolean; delayed: boolean; reason?: string }[]> = {
  1: [
    { name: "Foundation", done: true, delayed: false },
    { name: "Slab Work",  done: true, delayed: true,  reason: "Monsoon delay" },
    { name: "Brickwork",  done: true, delayed: true,  reason: "Material shortage" },
    { name: "Plastering", done: true, delayed: true,  reason: "Labour dispute" },
    { name: "Finishing",  done: false, delayed: false },
    { name: "OC / Handover", done: false, delayed: false },
  ],
  2: [
    { name: "Foundation", done: true, delayed: false },
    { name: "Slab Work",  done: true, delayed: false },
    { name: "Brickwork",  done: true, delayed: false },
    { name: "Plastering", done: true, delayed: false },
    { name: "Finishing",  done: true, delayed: false },
    { name: "OC / Handover", done: false, delayed: false },
  ],
  3: [
    { name: "Foundation", done: true, delayed: false },
    { name: "Slab Work",  done: true, delayed: true,  reason: "Ground stability issues" },
    { name: "Brickwork",  done: false, delayed: true,  reason: "Waiting structural approval" },
    { name: "Plastering", done: false, delayed: false },
    { name: "Finishing",  done: false, delayed: false },
    { name: "OC / Handover", done: false, delayed: false },
  ],
  4: [
    { name: "Foundation", done: true, delayed: false },
    { name: "Slab Work",  done: true, delayed: false },
    { name: "Brickwork",  done: true, delayed: false },
    { name: "Plastering", done: false, delayed: false },
    { name: "Finishing",  done: false, delayed: false },
    { name: "OC / Handover", done: false, delayed: false },
  ],
};

const BLOCKED_UNITS = [
  { unit: "A-302", project: "Prestige Lakeside",       buyer: "Arjun Kapoor",   salesperson: "Rahul Gupta",  days: 9,  expected: "May 15" },
  { unit: "C-108", project: "DLF Cybercity Residences",buyer: "Sanjay Mehta",  salesperson: "Arjun Mehta",  days: 12, expected: "May 18" },
  { unit: "B-506", project: "Sobha Royal Crest",        buyer: "Priya Verma",   salesperson: "Riya Sharma",  days: 8,  expected: "May 14" },
];

const CASH_FLOW = [
  { project: "Prestige Lakeside",         invested: 4_80_00_000, collected: 3_40_00_000, outstanding: 1_40_00_000, expectedRevenue: 5_50_00_000, margin: 14.6 },
  { project: "Godrej Summit",             invested: 8_20_00_000, collected: 7_90_00_000, outstanding: 30_00_000,   expectedRevenue: 9_50_00_000, margin: 15.8 },
  { project: "DLF Cybercity Residences",  invested: 6_50_00_000, collected: 1_80_00_000, outstanding: 4_70_00_000, expectedRevenue: 10_20_00_000, margin: 36.4 },
  { project: "Sobha Royal Crest",         invested: 7_10_00_000, collected: 5_30_00_000, outstanding: 1_80_00_000, expectedRevenue: 8_80_00_000, margin: 19.4 },
];

const OVERDUE_COLLECTIONS = [
  { buyer: "Amit Jain",     unit: "B-105", project: "Godrej Summit",            dueDate: "Apr 15, 2026", amount: 15_00_000, days: 22 },
  { buyer: "Sunita Sharma", unit: "A-302", project: "Prestige Lakeside",        dueDate: "Apr 20, 2026", amount: 8_50_000,  days: 17 },
  { buyer: "Vikram Singh",  unit: "D-201", project: "Sobha Royal Crest",        dueDate: "Apr 28, 2026", amount: 22_00_000, days: 9  },
  { buyer: "Deepa Nair",    unit: "C-109", project: "DLF Cybercity Residences", dueDate: "May 1, 2026",  amount: 35_00_000, days: 6  },
];

const MONTHLY_CASHFLOW = [
  { month: "Jan", inflow: 82, outflow: 45 }, { month: "Feb", inflow: 95, outflow: 60 },
  { month: "Mar", inflow: 110, outflow: 72 }, { month: "Apr", inflow: 88, outflow: 55 },
  { month: "May", inflow: 130, outflow: 80 }, { month: "Jun", inflow: 145, outflow: 90 },
  { month: "Jul", inflow: 120, outflow: 75 }, { month: "Aug", inflow: 160, outflow: 95 },
];

const LOST_REASONS = [
  { reason: "Budget too high",            count: 8,  pct: 35, color: "#ef4444" },
  { reason: "Location preference",        count: 5,  pct: 22, color: "#f59e0b" },
  { reason: "Competitor offering",        count: 4,  pct: 17, color: "#8b5cf6" },
  { reason: "Project delay concern",      count: 3,  pct: 13, color: "#3b82f6" },
  { reason: "Configuration unavailable",  count: 2,  pct: 9,  color: "#10b981" },
  { reason: "No response",               count: 1,  pct: 4,  color: "#6b7280" },
];

const SOURCE_CPL = [
  { source: "99acres",     leads: 3, adSpend: 45_000,  cpl: 15_000, conversions: 1, roi: "good"   },
  { source: "Facebook",    leads: 2, adSpend: 30_000,  cpl: 15_000, conversions: 0, roi: "poor"   },
  { source: "Google",      leads: 1, adSpend: 25_000,  cpl: 25_000, conversions: 0, roi: "poor"   },
  { source: "MagicBricks", leads: 1, adSpend: 20_000,  cpl: 20_000, conversions: 0, roi: "avg"    },
  { source: "Referral",    leads: 2, adSpend: 0,       cpl: 0,       conversions: 1, roi: "best"   },
  { source: "Walk-in",     leads: 1, adSpend: 0,       cpl: 0,       conversions: 0, roi: "avg"    },
];

const EMPLOYEE_PERF = [
  { name: "Riya Sharma",  role: "Senior Agent", leads: 28, converted: 9,  rate: 32, revenue: 2_10_00_000, feedback: 4.7, target: 12, avgDays: 18, sitVisits: 21 },
  { name: "Arjun Mehta",  role: "Agent",        leads: 22, converted: 6,  rate: 27, revenue: 1_45_00_000, feedback: 4.3, target: 10, avgDays: 24, sitVisits: 15 },
  { name: "Pooja Nair",   role: "Senior Agent", leads: 31, converted: 11, rate: 35, revenue: 2_80_00_000, feedback: 4.8, target: 12, avgDays: 14, sitVisits: 26 },
  { name: "Rahul Gupta",  role: "Agent",        leads: 18, converted: 4,  rate: 22, revenue: 95_00_000,   feedback: 4.1, target: 10, avgDays: 31, sitVisits: 11 },
  { name: "Sneha Joshi",  role: "Manager",      leads: 15, converted: 7,  rate: 47, revenue: 3_20_00_000, feedback: 4.9, target: 8,  avgDays: 11, sitVisits: 12 },
];

const LOCATION_ROI = [
  { location: "Bangalore", deals: 12, avgROI: 21, growth: "+18%" },
  { location: "Pune",      deals: 8,  avgROI: 16, growth: "+12%" },
  { location: "Gurugram",  deals: 5,  avgROI: 36, growth: "+24%" },
  { location: "Mumbai",    deals: 3,  avgROI: 14, growth: "+8%"  },
];

const TODAY_VISITS = [
  { lead: "Meera Patel",    project: "Prestige Lakeside", time: "10:00 AM", unit: "A-504", status: "confirmed" },
  { lead: "Sanjay Verma",   project: "Godrej Summit",     time: "12:30 PM", unit: "B-302", status: "confirmed" },
  { lead: "Deepa Krishnan", project: "Sobha Royal Crest", time: "3:00 PM",  unit: "B-405", status: "pending"   },
];

const COLORS = ["#f59e0b", "#1e3a5f", "#10b981", "#8b5cf6", "#ef4444", "#3b82f6", "#f97316", "#06b6d4"];

/* ─── INVENTORY TAB ───────────────────────────────────────────────────── */
function InventoryTab() {
  const [expandedProject, setExpandedProject] = useState<number | null>(null);
  const totalUnits  = PROJECTS.reduce((s, p) => s + p.totalUnits, 0);
  const totalSold   = PROJECTS.reduce((s, p) => s + p.sold, 0);
  const totalAvail  = PROJECTS.reduce((s, p) => s + p.available, 0);
  const totalIssues = PROJECTS.reduce((s, p) => s + p.issues, 0);
  const pending     = PROJECTS.reduce((s, p) => s + p.pendingApprovals, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard label="Total Inventory"   value={String(totalUnits)}  sub="across all projects" icon={Layers}        accent="border-l-blue-500"   trend="+12%" up />
        <KpiCard label="Units Sold"        value={String(totalSold)}   sub={`${Math.round(totalSold/totalUnits*100)}% sell-through`} icon={CheckCircle2} accent="border-l-green-500" trend="+18%" up />
        <KpiCard label="Available Units"   value={String(totalAvail)}  sub="ready to book"       icon={Home}          accent="border-l-amber-500"  />
        <KpiCard label="Active Issues"     value={String(totalIssues)} sub="flagged by team"     icon={AlertTriangle} accent="border-l-red-500"    />
        <KpiCard label="Pending Approvals" value={String(pending)}     sub="awaiting manager"    icon={ShieldCheck}   accent="border-l-purple-500" />
      </div>

      {/* Blocked Units Alert */}
      {BLOCKED_UNITS.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/30">
          <SectionTitle icon={AlertTriangle} title="Blocked Units Alert" sub={`${BLOCKED_UNITS.length} units blocked beyond 7-day threshold`} />
          <div className="space-y-2">
            {BLOCKED_UNITS.map((u) => (
              <div key={u.unit} className="flex items-center gap-3 bg-card rounded-lg px-4 py-3 border border-amber-100">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold flex-shrink-0">{u.days}d</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{u.unit} · {u.project}</p>
                  <p className="text-xs text-muted-foreground">Blocked for <span className="font-medium">{u.buyer}</span> by {u.salesperson} · Expected conversion: {u.expected}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button className="text-xs px-2 py-1 bg-green-600 text-white rounded-md font-medium hover:bg-green-700 transition-colors">Approve</button>
                  <button className="text-xs px-2 py-1 bg-red-50 text-red-600 border border-red-200 rounded-md font-medium hover:bg-red-100 transition-colors">Release</button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Project cards + milestones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {PROJECTS.map((p) => {
          const sellPct = Math.round((p.sold / p.totalUnits) * 100);
          const ms = MILESTONES[p.id] ?? [];
          const isExpanded = expandedProject === p.id;

          return (
            <Card key={p.id} className="hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-foreground text-sm">{p.name}</h3>
                  <p className="text-xs text-muted-foreground">{p.location} · {p.type}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                  {p.issues > 0 && <span className="text-[10px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" />{p.issues}</span>}
                  {p.pendingApprovals > 0 && <span className="text-[10px] font-medium text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Clock className="w-3 h-3" />{p.pendingApprovals}</span>}
                  <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", p.status === "Ready to Move" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700")}>{p.status}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3">
                {[["Sold", p.sold, "text-green-600"], ["Available", p.available, "text-amber-600"], ["Under Review", p.underReview, "text-blue-600"]].map(([l, v, cls]) => (
                  <div key={String(l)} className="text-center bg-muted/30 rounded-lg p-2">
                    <p className={cn("text-lg font-bold", String(cls))}>{v}</p>
                    <p className="text-[10px] text-muted-foreground">{l}</p>
                  </div>
                ))}
              </div>

              <div className="mb-2">
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                  <span>Sell-through</span><span className="font-semibold text-foreground">{sellPct}% · {p.sold}/{p.totalUnits}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-green-500" style={{ width: `${sellPct}%` }} />
                </div>
              </div>
              <div className="mb-3">
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                  <span>Construction progress</span><span className="font-semibold text-foreground">{p.timeline}% · Due {p.completionDate}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${p.timeline}%` }} />
                </div>
              </div>

              {/* Milestones toggle */}
              <button onClick={() => setExpandedProject(isExpanded ? null : p.id)}
                className="text-xs text-primary hover:underline flex items-center gap-1 mb-2">
                {isExpanded ? "Hide" : "Show"} milestones
                <ChevronRight className={cn("w-3 h-3 transition-transform", isExpanded && "rotate-90")} />
              </button>

              {isExpanded && (
                <div className="mt-2 space-y-2">
                  {ms.map((m, i) => (
                    <div key={m.name} className="flex items-center gap-2">
                      <div className={cn("w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px]",
                        m.done ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground")}>
                        {m.done ? "✓" : String(i + 1)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={cn("text-xs font-medium", m.done ? "text-foreground" : "text-muted-foreground")}>{m.name}</span>
                          {m.delayed && <span className="text-[10px] bg-red-50 text-red-600 px-1 rounded flex items-center gap-0.5"><AlertTriangle className="w-2.5 h-2.5" />Delayed{m.reason ? ` · ${m.reason}` : ""}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-3">
                <span>₹{p.pricePerSqft.toLocaleString("en-IN")}/sqft · avg {p.avgSqft} sqft</span>
                <span className="font-semibold text-foreground">{formatCurrency(p.pricePerSqft * p.avgSqft)} avg unit</span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ─── CASH FLOW TAB ───────────────────────────────────────────────────── */
function CashFlowTab() {
  const [priceAdj, setPriceAdj] = useState(0);
  const [costAdj, setCostAdj] = useState(0);

  const totalInvested    = CASH_FLOW.reduce((s, c) => s + c.invested, 0);
  const totalCollected   = CASH_FLOW.reduce((s, c) => s + c.collected, 0);
  const totalOutstanding = CASH_FLOW.reduce((s, c) => s + c.outstanding, 0);
  const totalExpected    = CASH_FLOW.reduce((s, c) => s + c.expectedRevenue, 0);
  const avgMargin        = CASH_FLOW.reduce((s, c) => s + c.margin, 0) / CASH_FLOW.length;
  const totalOverdue     = OVERDUE_COLLECTIONS.reduce((s, c) => s + c.amount, 0);

  const scenarioRevenue  = totalExpected  * (1 + priceAdj / 100);
  const scenarioInvested = totalInvested  * (1 + costAdj  / 100);
  const scenarioProfit   = scenarioRevenue - scenarioInvested;
  const baseProfit       = totalExpected  - totalInvested;
  const profitDelta      = scenarioProfit - baseProfit;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard label="Total Invested"    value={formatCurrency(totalInvested)}    sub="across all projects" icon={DollarSign}    accent="border-l-blue-500"    />
        <KpiCard label="Collected So Far"  value={formatCurrency(totalCollected)}   sub={`${Math.round(totalCollected/totalInvested*100)}% of invested`} icon={TrendingUp} accent="border-l-green-500" trend="+23%" up />
        <KpiCard label="Outstanding"       value={formatCurrency(totalOutstanding)} sub="yet to be collected" icon={Clock}         accent="border-l-amber-500"   />
        <KpiCard label="Overdue (at risk)" value={formatCurrency(totalOverdue)}     sub={`${OVERDUE_COLLECTIONS.length} instalments`} icon={AlertTriangle} accent="border-l-red-500" />
        <KpiCard label="Avg Margin"        value={`${avgMargin.toFixed(1)}%`}       sub="blended profit margin" icon={Target}      accent="border-l-emerald-500" trend="+3.2%" up />
      </div>

      {/* Overdue Collections */}
      <Card className="border-red-200 bg-red-50/20">
        <SectionTitle icon={AlertTriangle} title="Overdue Instalments" sub="Buyers with missed payment deadlines" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Buyer", "Unit", "Project", "Due Date", "Amount", "Overdue By"].map(h => (
                  <th key={h} className="text-left pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider pr-4 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {OVERDUE_COLLECTIONS.map((c) => (
                <tr key={c.buyer} className="hover:bg-muted/20">
                  <td className="py-3 pr-4 font-medium text-foreground">{c.buyer}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{c.unit}</td>
                  <td className="py-3 pr-4 text-muted-foreground text-xs">{c.project}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{c.dueDate}</td>
                  <td className="py-3 pr-4 font-semibold text-foreground">{formatCurrency(c.amount)}</td>
                  <td className="py-3">
                    <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold", c.days > 15 ? "bg-red-100 text-red-700" : c.days > 7 ? "bg-amber-100 text-amber-700" : "bg-yellow-100 text-yellow-700")}>
                      {c.days} days
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground flex items-center gap-1">
          <Zap className="w-3 h-3 text-red-500" />Total overdue: <span className="font-semibold text-red-600 ml-0.5">{formatCurrency(totalOverdue)}</span> — legal notice recommended for 15+ day cases
        </p>
      </Card>

      {/* Monthly cash flow */}
      <Card>
        <SectionTitle icon={BarChart3} title="Monthly Cash Flow — FY 2025–26" sub="Inflow vs outflow (₹ lakhs)" />
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={MONTHLY_CASHFLOW} barGap={4} barSize={14}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} unit="L" />
            <Tooltip formatter={(v: number) => [`₹${v}L`]} />
            <Bar dataKey="inflow"  fill="#22c55e" radius={[4,4,0,0]} name="Inflow" />
            <Bar dataKey="outflow" fill="#f59e0b" radius={[4,4,0,0]} name="Outflow" />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-500 inline-block" />Inflow</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-500 inline-block" />Outflow</span>
        </div>
      </Card>

      {/* Project-wise table */}
      <Card>
        <SectionTitle icon={Layers} title="Project-wise Financial Summary" sub="Investment, collections, and projected profit" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Project", "Invested", "Collected", "Outstanding", "Expected Rev.", "Proj. Profit", "Margin"].map(h => (
                  <th key={h} className="text-left pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider pr-4 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {CASH_FLOW.map((c) => (
                <tr key={c.project} className="hover:bg-muted/20 transition-colors">
                  <td className="py-3 pr-4 font-medium text-foreground whitespace-nowrap">{c.project}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{formatCurrency(c.invested)}</td>
                  <td className="py-3 pr-4 text-green-600 font-medium">{formatCurrency(c.collected)}</td>
                  <td className="py-3 pr-4 text-amber-600">{formatCurrency(c.outstanding)}</td>
                  <td className="py-3 pr-4">{formatCurrency(c.expectedRevenue)}</td>
                  <td className="py-3 pr-4 text-emerald-600 font-semibold">{formatCurrency(c.expectedRevenue - c.invested)}</td>
                  <td className="py-3"><span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700">{c.margin}%</span></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/20 font-bold">
                <td className="py-3 pr-4 text-foreground">Total</td>
                <td className="py-3 pr-4">{formatCurrency(totalInvested)}</td>
                <td className="py-3 pr-4 text-green-600">{formatCurrency(totalCollected)}</td>
                <td className="py-3 pr-4 text-amber-600">{formatCurrency(totalOutstanding)}</td>
                <td className="py-3 pr-4">{formatCurrency(totalExpected)}</td>
                <td className="py-3 pr-4 text-emerald-600">{formatCurrency(totalExpected - totalInvested)}</td>
                <td className="py-3 text-green-700">{avgMargin.toFixed(1)}%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Scenario Modelling */}
      <Card className="border-blue-200 bg-blue-50/20">
        <SectionTitle icon={Zap} title="Scenario Modelling" sub="See how price or cost changes affect total profit" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-foreground">Price per sqft adjustment</label>
                <span className={cn("text-sm font-bold", priceAdj >= 0 ? "text-green-600" : "text-red-600")}>{priceAdj >= 0 ? "+" : ""}{priceAdj}%</span>
              </div>
              <input type="range" min={-20} max={20} value={priceAdj} onChange={(e) => setPriceAdj(Number(e.target.value))}
                className="w-full accent-primary" />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1"><span>-20%</span><span>0</span><span>+20%</span></div>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-foreground">Construction cost adjustment</label>
                <span className={cn("text-sm font-bold", costAdj <= 0 ? "text-green-600" : "text-red-600")}>{costAdj >= 0 ? "+" : ""}{costAdj}%</span>
              </div>
              <input type="range" min={-20} max={20} value={costAdj} onChange={(e) => setCostAdj(Number(e.target.value))}
                className="w-full accent-primary" />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1"><span>-20%</span><span>0</span><span>+20%</span></div>
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Impact Preview</p>
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-sm text-foreground">Base Profit</span>
              <span className="font-bold text-foreground">{formatCurrency(baseProfit)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-sm text-foreground">Adjusted Profit</span>
              <span className={cn("font-bold text-lg", scenarioProfit >= baseProfit ? "text-green-600" : "text-red-600")}>{formatCurrency(scenarioProfit)}</span>
            </div>
            <div className={cn("flex items-center gap-2 py-2 px-3 rounded-lg", profitDelta >= 0 ? "bg-green-50" : "bg-red-50")}>
              {profitDelta >= 0 ? <TrendingUp className="w-4 h-4 text-green-600 flex-shrink-0" /> : <TrendingDown className="w-4 h-4 text-red-600 flex-shrink-0" />}
              <span className={cn("text-sm font-semibold", profitDelta >= 0 ? "text-green-700" : "text-red-700")}>
                {profitDelta >= 0 ? "+" : ""}{formatCurrency(profitDelta)} impact on profit
              </span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ─── LEAD MANAGEMENT TAB ─────────────────────────────────────────────── */
function LeadManagementTab({ stats, sources, pipeline, activity }: {
  stats: ReturnType<typeof useGetDashboardStats>["data"];
  sources: ReturnType<typeof useGetLeadSources>["data"];
  pipeline: ReturnType<typeof useGetDashboardPipeline>["data"];
  activity: ReturnType<typeof useGetRecentActivity>["data"];
}) {
  const { data: allLeads } = useGetLeads({}, { query: { queryKey: getGetLeadsQueryKey({}) } });
  const leadList = allLeads ?? [];
  const stageOrder = ["new","contacted","qualified","proposal","negotiation","closed_won","closed_lost"];
  const stageCounts = stageOrder.map(s => ({ stage: s, count: leadList.filter(l => l.status === s).length }));
  const funnelMax = Math.max(...stageCounts.map(s => s.count), 1);
  const sourceTotal = (sources ?? []).reduce((s, x) => s + x.count, 0);

  // Follow-up compliance: leads still "new" or "contacted" with no progress in ~7d
  const staleLeads = leadList.filter(l => ["new","contacted"].includes(l.status)).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Leads"       value={String(stats?.totalLeads ?? 0)}     sub={`+${stats?.newLeadsThisMonth ?? 0} this month`}  icon={Users}       accent="border-l-blue-500"   trend="+8%" up />
        <KpiCard label="Converted"         value={String(leadList.filter(l=>l.status==="closed_won").length)} sub="became customers" icon={UserCheck} accent="border-l-green-500" trend="+21%" up />
        <KpiCard label="In Progress"       value={String(leadList.filter(l=>!["closed_won","closed_lost"].includes(l.status)).length)} sub="active pipeline" icon={GitBranch} accent="border-l-amber-500" />
        <KpiCard label="Conversion Rate"   value={`${stats?.conversionRate ?? 0}%`}   sub="lead → closed won"  icon={Target}      accent="border-l-purple-500" trend="+3%" up />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funnel */}
        <Card>
          <SectionTitle icon={GitBranch} title="Lead Conversion Funnel" sub="Leads at each pipeline stage" />
          <div className="space-y-2">
            {stageCounts.filter(s => s.count > 0).map((s, i) => (
              <div key={s.stage}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-foreground capitalize">{stageLabel(s.stage)}</span>
                  <span className="text-muted-foreground">{s.count}</span>
                </div>
                <div className="h-6 rounded-md bg-muted overflow-hidden">
                  <div className="h-full rounded-md flex items-center pl-2 text-[11px] font-medium text-white"
                    style={{ width: `${(s.count / funnelMax) * 100}%`, background: COLORS[i % COLORS.length] }}>
                    {s.count > 0 && s.count}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Lead Sources */}
        <Card>
          <SectionTitle icon={BarChart3} title="Lead Sources" sub="Where leads are coming from" />
          {(sources ?? []).length > 0 ? (
            <div className="space-y-2.5">
              {(sources ?? []).map((s, i) => {
                const pct = sourceTotal > 0 ? Math.round((s.count / sourceTotal) * 100) : 0;
                return (
                  <div key={s.source}>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-medium text-foreground capitalize">{s.source}</span>
                      <span className="text-xs text-muted-foreground">{s.count} · {pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <p className="text-sm text-muted-foreground">No source data</p>}
        </Card>
      </div>

      {/* Cost per lead by source */}
      <Card>
        <SectionTitle icon={DollarSign} title="Cost Per Lead by Channel" sub="Ad spend efficiency — where is your budget working hardest?" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Channel", "Leads", "Ad Spend", "Cost / Lead", "Conversions", "ROI Signal"].map(h => (
                  <th key={h} className="text-left pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {SOURCE_CPL.map((s) => (
                <tr key={s.source} className="hover:bg-muted/20">
                  <td className="py-3 pr-4 font-medium text-foreground">{s.source}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{s.leads}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{s.adSpend > 0 ? formatCurrency(s.adSpend) : "—"}</td>
                  <td className="py-3 pr-4 font-medium text-foreground">{s.cpl > 0 ? `₹${s.cpl.toLocaleString("en-IN")}` : "Organic"}</td>
                  <td className="py-3 pr-4">{s.conversions}</td>
                  <td className="py-3">
                    <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full",
                      s.roi === "best" ? "bg-green-100 text-green-700" :
                      s.roi === "good" ? "bg-blue-100 text-blue-700"  :
                      s.roi === "avg"  ? "bg-amber-100 text-amber-700" :
                                         "bg-red-100 text-red-700"
                    )}>
                      {s.roi === "best" ? "Best ROI" : s.roi === "good" ? "Good" : s.roi === "avg" ? "Average" : "Poor"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Follow-up compliance */}
      <Card className="border-orange-200 bg-orange-50/20">
        <SectionTitle icon={AlertTriangle} title="Follow-up Compliance" sub="Leads with no status progress — action required" />
        {staleLeads.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">All leads have recent activity ✓</p>
        ) : (
          <div className="space-y-2">
            {staleLeads.map((lead) => (
              <div key={lead.id} className="flex items-center gap-3 bg-card rounded-lg px-4 py-3 border border-orange-100">
                <div className="w-7 h-7 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                  {lead.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{lead.name}</p>
                  <p className="text-xs text-muted-foreground">Status: <span className="capitalize font-medium">{lead.status}</span> · {lead.agentName ?? "Unassigned"} · {lead.source}</p>
                </div>
                <Link href={`/leads/${lead.id}`} className="text-xs text-primary hover:underline flex-shrink-0">Follow up →</Link>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Lost lead reasons */}
      <Card>
        <SectionTitle icon={XCircle} title="Lost Lead Analysis" sub="Why are leads not converting?" />
        <div className="space-y-2.5">
          {LOST_REASONS.map((r) => (
            <div key={r.reason}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-foreground">{r.reason}</span>
                <span className="text-xs text-muted-foreground">{r.count} leads · {r.pct}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${r.pct}%`, background: r.color }} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground flex items-center gap-1">
          <Zap className="w-3 h-3 text-amber-500" />
          <strong className="text-foreground">Top action:</strong> 35% lost to budget — consider introducing a more affordable configuration or payment plan.
        </p>
      </Card>

      {/* Pipeline value */}
      <Card>
        <SectionTitle icon={DollarSign} title="Pipeline Value by Stage" sub="Deal values across active stages"
          action={<Link href="/leads" className="text-xs text-primary hover:underline flex items-center gap-1">All leads <ChevronRight className="w-3 h-3" /></Link>} />
        <ResponsiveContainer width="100%" height={170}>
          <BarChart data={(pipeline ?? []).filter(p => !["closed_won","closed_lost"].includes(p.stage))} barSize={28}>
            <XAxis dataKey="stage" tickFormatter={stageLabel} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 10 }} width={58} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v: number) => [formatCurrency(v), "Value"]} labelFormatter={stageLabel} />
            <Bar dataKey="value" fill="#f59e0b" radius={[5,5,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

/* ─── ANALYSIS TAB ────────────────────────────────────────────────────── */
function AnalysisTab() {
  return (
    <div className="space-y-6">
      {/* Employee performance */}
      <Card>
        <SectionTitle icon={UserCheck} title="Sales Team Performance" sub="Leads, conversions, revenue, and average time to close" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Employee","Role","Leads","Converted","Conv. %","Revenue","Avg. Days","Visits","Feedback","vs Target"].map(h => (
                  <th key={h} className="text-left pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider pr-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {EMPLOYEE_PERF.map((e) => {
                const vsTarget = e.converted - e.target;
                return (
                  <tr key={e.name} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                          {e.name.split(" ").map(w=>w[0]).join("")}
                        </div>
                        <span className="font-medium text-foreground whitespace-nowrap">{e.name}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-xs text-muted-foreground whitespace-nowrap">{e.role}</td>
                    <td className="py-3 pr-3 font-medium">{e.leads}</td>
                    <td className="py-3 pr-3 font-medium text-green-600">{e.converted}</td>
                    <td className="py-3 pr-3">
                      <span className={cn("px-1.5 py-0.5 rounded text-xs font-semibold", e.rate >= 35 ? "bg-green-100 text-green-700" : e.rate >= 25 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700")}>
                        {e.rate}%
                      </span>
                    </td>
                    <td className="py-3 pr-3 font-semibold text-foreground whitespace-nowrap">{formatCurrency(e.revenue)}</td>
                    <td className="py-3 pr-3">
                      <span className={cn("text-xs font-medium", e.avgDays <= 15 ? "text-green-600" : e.avgDays <= 25 ? "text-amber-600" : "text-red-600")}>
                        {e.avgDays}d avg
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-muted-foreground">{e.sitVisits}</td>
                    <td className="py-3 pr-3">
                      <span className="text-xs">{"★".repeat(Math.floor(e.feedback))}</span>
                      <span className="text-xs text-muted-foreground ml-1">{e.feedback}</span>
                    </td>
                    <td className="py-3">
                      <span className={cn("flex items-center gap-0.5 text-xs font-semibold", vsTarget >= 0 ? "text-green-600" : "text-red-600")}>
                        {vsTarget >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {vsTarget >= 0 ? `+${vsTarget}` : vsTarget}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lost reasons chart */}
        <Card>
          <SectionTitle icon={XCircle} title="Lost Lead Reasons" sub="Top reasons deals don't close" />
          <div className="space-y-3">
            {LOST_REASONS.map((r) => (
              <div key={r.reason} className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: r.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between mb-0.5">
                    <span className="text-xs font-medium text-foreground">{r.reason}</span>
                    <span className="text-xs text-muted-foreground">{r.count} · {r.pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${r.pct}%`, background: r.color }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Location growth */}
        <Card>
          <SectionTitle icon={Building2} title="Growth by Location" sub="Deal activity and ROI by city" />
          <div className="space-y-3">
            {LOCATION_ROI.map((l, i) => (
              <div key={l.location} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: COLORS[i] }}>
                  {l.location.slice(0,2).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">{l.location}</p>
                  <p className="text-xs text-muted-foreground">{l.deals} deals · avg {l.avgROI}% ROI</p>
                </div>
                <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex-shrink-0">{l.growth}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ─── EMPLOYEE DASHBOARD ──────────────────────────────────────────────── */
function EmployeeDashboard({ stats, activity }: {
  stats: ReturnType<typeof useGetDashboardStats>["data"];
  activity: ReturnType<typeof useGetRecentActivity>["data"];
}) {
  const { data: agents } = useGetAgents();
  const { data: allLeads } = useGetLeads({}, { query: { queryKey: getGetLeadsQueryKey({}) } });

  const me = agents?.[0];
  const myLeads      = (allLeads ?? []).filter(l => l.agentId === me?.id);
  const myConverted  = myLeads.filter(l => l.status === "closed_won").length;
  const myActive     = myLeads.filter(l => !["closed_won","closed_lost"].includes(l.status)).length;
  const myConvRate   = myLeads.length > 0 ? Math.round((myConverted / myLeads.length) * 100) : 0;
  const myPipeline   = myLeads.filter(l => !["closed_won","closed_lost"].includes(l.status));

  // Overdue follow-ups: "new" or "contacted" leads (proxy for not-yet-followed-up)
  const overdueFollowups = myLeads.filter(l => ["new","contacted"].includes(l.status)).slice(0, 4);

  const targetLeads    = 10;
  const targetConverted = 4;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="My Leads"         value={String(myLeads.length)}   sub={`Target: ${targetLeads}`}     icon={Users}        accent="border-l-blue-500"   trend="+5%" up />
        <KpiCard label="My Conversions"   value={String(myConverted)}      sub={`Target: ${targetConverted}`} icon={CheckCircle2} accent="border-l-green-500"  trend="+2%" up />
        <KpiCard label="Active Pipeline"  value={String(myActive)}         sub="in progress"                  icon={GitBranch}    accent="border-l-amber-500"  />
        <KpiCard label="My Conv. Rate"    value={`${myConvRate}%`}         sub="vs team avg 31%"              icon={Target}       accent="border-l-purple-500" />
      </div>

      {/* Targets */}
      <Card>
        <SectionTitle icon={Target} title="My Monthly Targets" sub={new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })} />
        <div className="grid grid-cols-2 gap-6">
          {[
            { label: "Leads Assigned", current: myLeads.length, target: targetLeads },
            { label: "Conversions",    current: myConverted,    target: targetConverted },
          ].map(({ label, current, target }) => {
            const pct = Math.min((current / target) * 100, 100);
            const done = current >= target;
            return (
              <div key={label}>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">{label}</span>
                  <span className="text-sm font-bold">{current} / {target}</span>
                </div>
                <div className="h-3 rounded-full bg-muted overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all", done ? "bg-green-500" : "bg-blue-500")} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">{done ? "✓ Target reached!" : `${target - current} more needed`}</p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Today's site visits */}
      <Card>
        <SectionTitle icon={Calendar} title="Today's Site Visits" sub={new Date().toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric" })} />
        {TODAY_VISITS.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No site visits scheduled today</p>
        ) : (
          <div className="space-y-2">
            {TODAY_VISITS.map((v) => (
              <div key={v.lead} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                <div className="text-center flex-shrink-0">
                  <p className="text-xs font-bold text-primary">{v.time}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{v.lead}</p>
                  <p className="text-xs text-muted-foreground">{v.project} · Unit {v.unit}</p>
                </div>
                <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0", v.status === "confirmed" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700")}>
                  {v.status === "confirmed" ? "Confirmed" : "Pending"}
                </span>
                <button className="text-xs px-2.5 py-1 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 transition-opacity flex-shrink-0">
                  Check In
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Overdue follow-ups */}
      {overdueFollowups.length > 0 && (
        <Card className="border-red-200 bg-red-50/20">
          <SectionTitle icon={AlertTriangle} title="Overdue Follow-ups" sub="These leads need your attention now" />
          <div className="space-y-2">
            {overdueFollowups.map((lead) => (
              <div key={lead.id} className="flex items-center gap-3 p-3 rounded-lg border border-red-100 bg-card">
                <div className="w-7 h-7 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                  {lead.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{lead.name}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="capitalize">{lead.status}</span> · {lead.source} · Budget: {lead.budget ? formatCurrency(lead.budget) : "—"}
                  </p>
                </div>
                <Link href={`/leads/${lead.id}`} className="text-xs px-2.5 py-1 bg-red-600 text-white rounded-md font-medium hover:bg-red-700 transition-colors flex-shrink-0">
                  Follow Up
                </Link>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* My active leads */}
      <Card>
        <SectionTitle icon={GitBranch} title="My Active Leads" sub="Your pipeline right now"
          action={<Link href="/leads" className="text-xs text-primary hover:underline flex items-center gap-1">View all <ChevronRight className="w-3 h-3" /></Link>} />
        {myPipeline.length === 0 ? (
          <div className="py-8 text-center">
            <Users className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No active leads assigned</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Lead","Status","Score","Budget","Source"].map(h => (
                    <th key={h} className="text-left pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {myPipeline.slice(0, 8).map((lead) => (
                  <tr key={lead.id} className="hover:bg-muted/20 cursor-pointer" onClick={() => window.location.href = `/leads/${lead.id}`}>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                          {lead.name.split(" ").map((w: string) => w[0]).join("").slice(0,2).toUpperCase()}
                        </div>
                        <p className="font-medium text-foreground">{lead.name}</p>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={cn("inline-flex px-2 py-0.5 rounded text-xs font-medium", {
                        "bg-blue-100 text-blue-700": lead.status === "new",
                        "bg-purple-100 text-purple-700": lead.status === "contacted",
                        "bg-amber-100 text-amber-700": lead.status === "qualified",
                        "bg-orange-100 text-orange-700": lead.status === "proposal",
                        "bg-yellow-100 text-yellow-700": lead.status === "negotiation",
                      })}>
                        {stageLabel(lead.status)}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-1.5">
                        <div className="w-10 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className={cn("h-full rounded-full", lead.score >= 80 ? "bg-green-500" : lead.score >= 60 ? "bg-amber-500" : "bg-red-400")} style={{ width: `${lead.score}%` }} />
                        </div>
                        <span className={cn("text-xs font-bold", scoreColor(lead.score))}>{lead.score}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-xs font-medium text-foreground">{lead.budget ? formatCurrency(lead.budget) : "—"}</td>
                    <td className="py-3 text-xs text-muted-foreground capitalize">{lead.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Recent activity */}
      <Card>
        <SectionTitle icon={Activity} title="Team Activity" sub="Latest updates" />
        <ul className="divide-y divide-border">
          {(activity ?? []).slice(0, 5).map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-2.5">
              <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
              <p className="text-sm text-muted-foreground flex-1">
                <span className="font-medium text-foreground">{item.entityName}</span> — {item.description}
                {item.agentName && <span> by <span className="font-medium text-foreground">{item.agentName}</span></span>}
              </p>
              <span className="text-xs text-muted-foreground flex-shrink-0">{timeAgo(item.createdAt)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/* ─── CFO DASHBOARD ────────────────────────────────────────────────────── */
function CFODashboard() {
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0" />
        <p className="text-sm text-blue-800"><span className="font-semibold">CFO View:</span> You have access to financial data entry and all cash flow modules. Navigate to Analytics for P&L reports.</p>
      </div>
      <CashFlowTab />
    </div>
  );
}

/* ─── ROOT PAGE ────────────────────────────────────────────────────────── */
type OwnerTab = "inventory" | "cashflow" | "leads" | "analysis";
const OWNER_TABS: { id: OwnerTab; label: string; icon: React.ElementType }[] = [
  { id: "inventory", label: "Inventory",      icon: Layers },
  { id: "cashflow",  label: "Cash Flow",       icon: DollarSign },
  { id: "leads",     label: "Lead Management", icon: Users },
  { id: "analysis",  label: "Analysis",        icon: BarChart3 },
];

export default function DashboardPage() {
  const { role, profile } = useRole();
  const [tab, setTab] = useState<OwnerTab>("inventory");

  const { data: stats }    = useGetDashboardStats();
  const { data: pipeline } = useGetDashboardPipeline();
  const { data: activity } = useGetRecentActivity();
  const { data: sources }  = useGetLeadSources();

  const isOwnerOrManager = role === "owner" || role === "manager";
  const isCFO            = role === "cfo";
  const isEmployee       = role === "sales" || role === "employee";

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isOwnerOrManager ? "Owner & Manager Dashboard" : isCFO ? "Finance Dashboard" : "My Dashboard"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isOwnerOrManager
              ? "Full business view — inventory, finances, leads, and team performance"
              : isCFO
              ? "Financial data, cash flow, and project economics"
              : "Your personal pipeline, targets, and follow-ups"}
          </p>
        </div>
        <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold text-white flex-shrink-0 self-start sm:self-auto", profile.color)}>
          <ShieldCheck className="w-3.5 h-3.5" />
          {profile.label}
        </div>
      </div>

      {/* Owner/Manager: tab strip */}
      {isOwnerOrManager && (
        <div className="flex gap-1 border-b border-border overflow-x-auto">
          {OWNER_TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
                tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {isOwnerOrManager && tab === "inventory" && <InventoryTab />}
      {isOwnerOrManager && tab === "cashflow"  && <CashFlowTab />}
      {isOwnerOrManager && tab === "leads"     && <LeadManagementTab stats={stats} sources={sources} pipeline={pipeline} activity={activity} />}
      {isOwnerOrManager && tab === "analysis"  && <AnalysisTab />}
      {isCFO && <CFODashboard />}
      {isEmployee && <EmployeeDashboard stats={stats} activity={activity} />}
    </div>
  );
}
