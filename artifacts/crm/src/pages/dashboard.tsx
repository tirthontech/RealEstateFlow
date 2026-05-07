import { useState, useEffect } from "react";
import {
  useGetDashboardStats, useGetDashboardPipeline, useGetRecentActivity,
  useGetLeadSources, useGetLeads, useGetAgents,
  getGetLeadsQueryKey,
} from "@workspace/api-client-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, PieChart, Pie, Cell,
} from "recharts";
import {
  Building2, Users, TrendingUp, GitBranch, Activity, ArrowUpRight,
  ArrowDownRight, AlertTriangle, CheckCircle2, Clock, Target,
  DollarSign, BarChart3, Layers, UserCheck, ChevronRight,
  Home, ShieldCheck,
} from "lucide-react";
import { cn, formatCurrency, stageLabel, timeAgo, scoreColor } from "@/lib/utils";
import { Link } from "wouter";

/* ─── Role persistence ───────────────────────────────────────────────────── */
type Role = "owner" | "employee";
function useRole() {
  const [role, setRoleState] = useState<Role>(() => (localStorage.getItem("ef_role") as Role) ?? "owner");
  function setRole(r: Role) { localStorage.setItem("ef_role", r); setRoleState(r); }
  return [role, setRole] as const;
}

/* ─── Mock project / cash-flow data (real estate India) ─────────────────── */
const PROJECTS = [
  {
    id: 1, name: "Prestige Lakeside", location: "Whitefield, Bangalore", type: "Residential",
    totalUnits: 120, sold: 78, available: 32, underReview: 10, issues: 3,
    timeline: 72, launchDate: "Jan 2024", completionDate: "Dec 2025",
    pricePerSqft: 8500, avgSqft: 1200, status: "Under Construction",
    pendingApprovals: 2,
  },
  {
    id: 2, name: "Godrej Summit", location: "Hinjewadi, Pune", type: "Residential",
    totalUnits: 200, sold: 158, available: 42, underReview: 0, issues: 1,
    timeline: 95, launchDate: "Mar 2023", completionDate: "Apr 2026",
    pricePerSqft: 6800, avgSqft: 1400, status: "Ready to Move",
    pendingApprovals: 0,
  },
  {
    id: 3, name: "DLF Cybercity Residences", location: "Sector 54, Gurugram", type: "Commercial",
    totalUnits: 80, sold: 22, available: 50, underReview: 8, issues: 5,
    timeline: 38, launchDate: "Jun 2024", completionDate: "Mar 2027",
    pricePerSqft: 14200, avgSqft: 900, status: "Under Construction",
    pendingApprovals: 5,
  },
  {
    id: 4, name: "Sobha Royal Crest", location: "Sarjapur Road, Bangalore", type: "Residential",
    totalUnits: 150, sold: 91, available: 45, underReview: 14, issues: 0,
    timeline: 60, launchDate: "Aug 2023", completionDate: "Sep 2026",
    pricePerSqft: 9800, avgSqft: 1600, status: "Under Construction",
    pendingApprovals: 3,
  },
];

const CASH_FLOW = [
  { project: "Prestige Lakeside",          invested: 4_80_00_000, collected: 3_40_00_000, outstanding: 1_40_00_000, expectedRevenue: 5_50_00_000, margin: 14.6 },
  { project: "Godrej Summit",              invested: 8_20_00_000, collected: 7_90_00_000, outstanding: 30_00_000,   expectedRevenue: 9_50_00_000, margin: 15.8 },
  { project: "DLF Cybercity Residences",   invested: 6_50_00_000, collected: 1_80_00_000, outstanding: 4_70_00_000, expectedRevenue: 10_20_00_000, margin: 36.4 },
  { project: "Sobha Royal Crest",          invested: 7_10_00_000, collected: 5_30_00_000, outstanding: 1_80_00_000, expectedRevenue: 8_80_00_000, margin: 19.4 },
];

const MONTHLY_CASHFLOW = [
  { month: "Jan", inflow: 82, outflow: 45 }, { month: "Feb", inflow: 95, outflow: 60 },
  { month: "Mar", inflow: 110, outflow: 72 }, { month: "Apr", inflow: 88, outflow: 55 },
  { month: "May", inflow: 130, outflow: 80 }, { month: "Jun", inflow: 145, outflow: 90 },
  { month: "Jul", inflow: 120, outflow: 75 }, { month: "Aug", inflow: 160, outflow: 95 },
];

const EMPLOYEE_PERF = [
  { name: "Riya Sharma", role: "Senior Agent",   leads: 28, converted: 9,  rate: 32, revenue: 2_10_00_000, feedback: 4.7, target: 12 },
  { name: "Arjun Mehta", role: "Agent",          leads: 22, converted: 6,  rate: 27, revenue: 1_45_00_000, feedback: 4.3, target: 10 },
  { name: "Pooja Nair",  role: "Senior Agent",   leads: 31, converted: 11, rate: 35, revenue: 2_80_00_000, feedback: 4.8, target: 12 },
  { name: "Rahul Gupta", role: "Agent",          leads: 18, converted: 4,  rate: 22, revenue: 95_00_000,   feedback: 4.1, target: 10 },
  { name: "Sneha Joshi", role: "Manager",        leads: 15, converted: 7,  rate: 47, revenue: 3_20_00_000, feedback: 4.9, target: 8  },
];

const INV_ROI = [
  { name: "Residential", projects: 3, totalInvested: 20_10_00_000, revenue: 23_80_00_000, roi: 18.4, trend: "up" },
  { name: "Commercial",  projects: 1, totalInvested: 6_50_00_000,  revenue: 10_20_00_000, roi: 36.4, trend: "up" },
  { name: "Luxury Villa",projects: 0, totalInvested: 0,             revenue: 0,            roi: 0,    trend: "flat" },
];

const LOCATION_ROI = [
  { location: "Bangalore",  deals: 12, avgROI: 21, growth: "+18%" },
  { location: "Pune",       deals: 8,  avgROI: 16, growth: "+12%" },
  { location: "Gurugram",   deals: 5,  avgROI: 36, growth: "+24%" },
  { location: "Mumbai",     deals: 3,  avgROI: 14, growth: "+8%"  },
];

/* ─── Shared card primitives ─────────────────────────────────────────────── */
function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("bg-card border border-card-border rounded-xl p-5", className)}>{children}</div>;
}

function SectionTitle({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="w-4 h-4 text-primary" />
      <div>
        <h2 className="text-sm font-semibold text-foreground leading-none">{title}</h2>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
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
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary flex-shrink-0">
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
            <p className="text-xl font-bold text-foreground mt-0.5 leading-none">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
        </div>
        {trend && (
          <span className={cn("flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0", up ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600")}>
            {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {trend}
          </span>
        )}
      </div>
    </Card>
  );
}

/* ─── OWNER TAB: Inventory ───────────────────────────────────────────────── */
function InventoryTab() {
  const totalUnits  = PROJECTS.reduce((s, p) => s + p.totalUnits, 0);
  const totalSold   = PROJECTS.reduce((s, p) => s + p.sold, 0);
  const totalAvail  = PROJECTS.reduce((s, p) => s + p.available, 0);
  const totalIssues = PROJECTS.reduce((s, p) => s + p.issues, 0);
  const pending     = PROJECTS.reduce((s, p) => s + p.pendingApprovals, 0);

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard label="Total Inventory"     value={String(totalUnits)}  sub="across all projects" icon={Layers}     accent="border-l-blue-500"   trend="+12%" up />
        <KpiCard label="Units Sold"          value={String(totalSold)}   sub={`${Math.round(totalSold/totalUnits*100)}% sell-through`} icon={CheckCircle2} accent="border-l-green-500"  trend="+18%" up />
        <KpiCard label="Available Units"     value={String(totalAvail)}  sub="ready to book"       icon={Home}       accent="border-l-amber-500"  />
        <KpiCard label="Active Issues"       value={String(totalIssues)} sub="flagged by team"     icon={AlertTriangle} accent="border-l-red-500" />
        <KpiCard label="Pending Approvals"   value={String(pending)}     sub="awaiting manager"    icon={ShieldCheck}  accent="border-l-purple-500" />
      </div>

      {/* Project cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {PROJECTS.map((p) => {
          const sellPct = Math.round((p.sold / p.totalUnits) * 100);
          return (
            <Card key={p.id} className="hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-foreground text-sm">{p.name}</h3>
                  <p className="text-xs text-muted-foreground">{p.location} · {p.type}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {p.issues > 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">
                      <AlertTriangle className="w-3 h-3" />{p.issues} issues
                    </span>
                  )}
                  {p.pendingApprovals > 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-medium text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full">
                      <Clock className="w-3 h-3" />{p.pendingApprovals} pending
                    </span>
                  )}
                  <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", p.status === "Ready to Move" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700")}>
                    {p.status}
                  </span>
                </div>
              </div>

              {/* Unit counts */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center bg-muted/30 rounded-lg p-2.5">
                  <p className="text-lg font-bold text-green-600">{p.sold}</p>
                  <p className="text-[10px] text-muted-foreground">Sold</p>
                </div>
                <div className="text-center bg-muted/30 rounded-lg p-2.5">
                  <p className="text-lg font-bold text-amber-600">{p.available}</p>
                  <p className="text-[10px] text-muted-foreground">Available</p>
                </div>
                <div className="text-center bg-muted/30 rounded-lg p-2.5">
                  <p className="text-lg font-bold text-blue-600">{p.underReview}</p>
                  <p className="text-[10px] text-muted-foreground">Under Review</p>
                </div>
              </div>

              {/* Sell-through bar */}
              <div className="mb-3">
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                  <span>Sell-through</span><span className="font-semibold text-foreground">{sellPct}% · {p.sold}/{p.totalUnits} units</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${sellPct}%` }} />
                </div>
              </div>

              {/* Construction timeline */}
              <div>
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                  <span>Construction progress</span><span className="font-semibold text-foreground">{p.timeline}% · Due {p.completionDate}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${p.timeline}%` }} />
                </div>
              </div>

              {/* Price */}
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-3">
                <span>₹{p.pricePerSqft.toLocaleString("en-IN")}/sqft · avg {p.avgSqft} sqft</span>
                <span className="font-semibold text-foreground">
                  {formatCurrency(p.pricePerSqft * p.avgSqft)} avg unit
                </span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ─── OWNER TAB: Cash Flow ───────────────────────────────────────────────── */
function CashFlowTab() {
  const totalInvested  = CASH_FLOW.reduce((s, c) => s + c.invested, 0);
  const totalCollected = CASH_FLOW.reduce((s, c) => s + c.collected, 0);
  const totalOutstanding = CASH_FLOW.reduce((s, c) => s + c.outstanding, 0);
  const totalExpected  = CASH_FLOW.reduce((s, c) => s + c.expectedRevenue, 0);
  const avgMargin = CASH_FLOW.reduce((s, c) => s + c.margin, 0) / CASH_FLOW.length;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard label="Total Invested"    value={formatCurrency(totalInvested)}    sub="across all projects" icon={DollarSign}   accent="border-l-blue-500" />
        <KpiCard label="Collected So Far"  value={formatCurrency(totalCollected)}   sub={`${Math.round(totalCollected/totalInvested*100)}% of invested`} icon={TrendingUp}  accent="border-l-green-500"  trend="+23%" up />
        <KpiCard label="Outstanding"       value={formatCurrency(totalOutstanding)} sub="yet to be collected" icon={Clock}        accent="border-l-amber-500" />
        <KpiCard label="Total Expected Rev"value={formatCurrency(totalExpected)}    sub="on full sell-out"    icon={BarChart3}    accent="border-l-purple-500" trend="+15%" up />
        <KpiCard label="Avg Profit Margin" value={`${avgMargin.toFixed(1)}%`}       sub="blended across projects" icon={Target}  accent="border-l-emerald-500" trend="+3.2%" up />
      </div>

      {/* Monthly cash flow chart */}
      <Card>
        <SectionTitle icon={BarChart3} title="Monthly Cash Flow — FY 2025–26" sub="Inflow vs outflow in lakhs (₹L)" />
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={MONTHLY_CASHFLOW} barGap={4} barSize={14}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} unit="L" />
            <Tooltip formatter={(v: number) => [`₹${v}L`]} />
            <Bar dataKey="inflow"  fill="#22c55e" radius={[4,4,0,0]} name="Inflow" />
            <Bar dataKey="outflow" fill="#f59e0b" radius={[4,4,0,0]} name="Outflow" />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
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
                {["Project", "Invested", "Collected", "Outstanding", "Expected Revenue", "Proj. Profit", "Margin"].map(h => (
                  <th key={h} className="text-left pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider pr-4 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {CASH_FLOW.map((c) => {
                const profit = c.expectedRevenue - c.invested;
                return (
                  <tr key={c.project} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 pr-4 font-medium text-foreground whitespace-nowrap">{c.project}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{formatCurrency(c.invested)}</td>
                    <td className="py-3 pr-4 text-green-600 font-medium">{formatCurrency(c.collected)}</td>
                    <td className="py-3 pr-4 text-amber-600">{formatCurrency(c.outstanding)}</td>
                    <td className="py-3 pr-4 text-foreground">{formatCurrency(c.expectedRevenue)}</td>
                    <td className="py-3 pr-4 text-emerald-600 font-semibold">{formatCurrency(profit)}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700">
                        {c.margin}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/20">
                <td className="py-3 pr-4 font-bold text-foreground">Total</td>
                <td className="py-3 pr-4 font-bold">{formatCurrency(totalInvested)}</td>
                <td className="py-3 pr-4 font-bold text-green-600">{formatCurrency(totalCollected)}</td>
                <td className="py-3 pr-4 font-bold text-amber-600">{formatCurrency(totalOutstanding)}</td>
                <td className="py-3 pr-4 font-bold">{formatCurrency(totalExpected)}</td>
                <td className="py-3 pr-4 font-bold text-emerald-600">{formatCurrency(totalExpected - totalInvested)}</td>
                <td className="py-3 font-bold text-green-700">{avgMargin.toFixed(1)}%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ─── OWNER TAB: Lead Management ─────────────────────────────────────────── */
function LeadManagementTab({ stats, sources, pipeline, activity }: {
  stats: ReturnType<typeof useGetDashboardStats>["data"];
  sources: ReturnType<typeof useGetLeadSources>["data"];
  pipeline: ReturnType<typeof useGetDashboardPipeline>["data"];
  activity: ReturnType<typeof useGetRecentActivity>["data"];
}) {
  const COLORS = ["#f59e0b","#1e3a5f","#10b981","#8b5cf6","#ef4444","#3b82f6","#f97316","#06b6d4"];

  const stageOrder = ["new","contacted","qualified","proposal","negotiation","closed_won","closed_lost"];
  const { data: allLeads } = useGetLeads({}, { query: { queryKey: getGetLeadsQueryKey({}) } });
  const leadList = allLeads ?? [];

  const stageCounts = stageOrder.map(s => ({ stage: s, count: leadList.filter(l => l.status === s).length }));
  const funnelMax = Math.max(...stageCounts.map(s => s.count), 1);

  const sourceTotal = (sources ?? []).reduce((s, x) => s + x.count, 0);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Leads"       value={String(stats?.totalLeads ?? 0)}     sub={`+${stats?.newLeadsThisMonth ?? 0} this month`}  icon={Users}       accent="border-l-blue-500"  trend="+8%"  up />
        <KpiCard label="Leads → Customers" value={String(leadList.filter(l=>l.status==="closed_won").length)} sub="converted this year" icon={UserCheck} accent="border-l-green-500" trend="+21%" up />
        <KpiCard label="In Progress"       value={String(leadList.filter(l=>!["closed_won","closed_lost"].includes(l.status)).length)} sub="active pipeline" icon={GitBranch} accent="border-l-amber-500" />
        <KpiCard label="Conversion Rate"   value={`${stats?.conversionRate ?? 0}%`}   sub="lead → closed won"                                icon={Target}      accent="border-l-purple-500" trend="+3%" up />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversion Funnel */}
        <Card>
          <SectionTitle icon={GitBranch} title="Lead Conversion Funnel" sub="Leads at each pipeline stage" />
          <div className="space-y-2">
            {stageCounts.filter(s => s.count > 0).map((s, i) => (
              <div key={s.stage}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-foreground font-medium capitalize">{stageLabel(s.stage)}</span>
                  <span className="text-muted-foreground">{s.count} leads</span>
                </div>
                <div className="h-6 rounded-md bg-muted overflow-hidden relative">
                  <div
                    className="h-full rounded-md flex items-center pl-2 text-[11px] font-medium text-white transition-all"
                    style={{ width: `${(s.count / funnelMax) * 100}%`, background: COLORS[i % COLORS.length] }}
                  >
                    {s.count > 0 && `${s.count}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Lead Sources */}
        <Card>
          <SectionTitle icon={BarChart3} title="Lead Sources Breakdown" sub="Where are your leads coming from?" />
          {(sources ?? []).length > 0 ? (
            <div className="space-y-2.5">
              {(sources ?? []).map((s, i) => {
                const pct = sourceTotal > 0 ? Math.round((s.count / sourceTotal) * 100) : 0;
                return (
                  <div key={s.source}>
                    <div className="flex items-center justify-between mb-1">
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

      {/* Pipeline value chart */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <SectionTitle icon={DollarSign} title="Pipeline Value by Stage" sub="Deal values across active stages" />
          <Link href="/leads" className="text-xs text-primary hover:underline flex items-center gap-1">
            View all leads <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={(pipeline ?? []).filter(p => !["closed_won","closed_lost"].includes(p.stage))} barSize={28}>
            <XAxis dataKey="stage" tickFormatter={stageLabel} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 10 }} width={58} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v: number) => [formatCurrency(v), "Value"]} labelFormatter={stageLabel} />
            <Bar dataKey="value" fill="#f59e0b" radius={[5,5,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Recent Activity */}
      <Card>
        <SectionTitle icon={Activity} title="Recent Team Activity" />
        <ul className="divide-y divide-border">
          {(activity ?? []).slice(0, 6).map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-2.5">
              <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                {(item.agentName ?? "?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">
                  <span className="font-semibold">{item.entityName}</span>
                  <span className="text-muted-foreground"> — {item.description}</span>
                  {item.agentName && <span className="text-muted-foreground"> · <span className="text-foreground font-medium">{item.agentName}</span></span>}
                </p>
              </div>
              <span className="text-xs text-muted-foreground flex-shrink-0">{timeAgo(item.createdAt)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/* ─── OWNER TAB: Analysis ─────────────────────────────────────────────────── */
function AnalysisTab() {
  const COLORS = ["#f59e0b","#10b981","#8b5cf6","#3b82f6"];
  const pieData = INV_ROI.filter(r => r.projects > 0).map(r => ({ name: r.name, value: r.totalInvested }));

  return (
    <div className="space-y-6">
      {/* Employee Performance */}
      <Card>
        <SectionTitle icon={UserCheck} title="Employee Performance" sub="Leads assigned, converted, and revenue this year" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Employee","Role","Leads","Converted","Conv. Rate","Revenue","Feedback","vs Target"].map(h => (
                  <th key={h} className="text-left pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider pr-4 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {EMPLOYEE_PERF.map((e) => {
                const vsTarget = e.converted - e.target;
                return (
                  <tr key={e.name} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                          {e.name.split(" ").map(w=>w[0]).join("")}
                        </div>
                        <span className="font-medium text-foreground whitespace-nowrap">{e.name}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-xs text-muted-foreground whitespace-nowrap">{e.role}</td>
                    <td className="py-3 pr-4 font-medium">{e.leads}</td>
                    <td className="py-3 pr-4 font-medium text-green-600">{e.converted}</td>
                    <td className="py-3 pr-4">
                      <span className={cn("px-1.5 py-0.5 rounded text-xs font-semibold", e.rate >= 35 ? "bg-green-100 text-green-700" : e.rate >= 25 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700")}>
                        {e.rate}%
                      </span>
                    </td>
                    <td className="py-3 pr-4 font-semibold text-foreground">{formatCurrency(e.revenue)}</td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-1">
                        {"★".repeat(Math.floor(e.feedback))}
                        <span className="text-xs text-muted-foreground ml-1">{e.feedback}</span>
                      </div>
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
        {/* Inventory ROI by type */}
        <Card>
          <SectionTitle icon={BarChart3} title="Inventory ROI by Property Type" sub="Which project types generate the most return" />
          <div className="space-y-4">
            {INV_ROI.filter(r => r.projects > 0).map((r, i) => (
              <div key={r.name} className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i] }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-foreground">{r.name}</span>
                    <span className="text-xs text-muted-foreground">{r.projects} projects</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${r.roi}%`, background: COLORS[i] }} />
                    </div>
                    <span className="text-xs font-bold text-foreground w-10 text-right">{r.roi}% ROI</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Invested {formatCurrency(r.totalInvested)} → Expected {formatCurrency(r.revenue)}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-green-500" />
              Commercial projects yield <span className="font-semibold text-foreground ml-0.5">36%+ ROI</span> — highest growth segment
            </p>
          </div>
        </Card>

        {/* Location growth */}
        <Card>
          <SectionTitle icon={Building2} title="Growth by Location" sub="Where is deal activity strongest?" />
          <div className="space-y-3">
            {LOCATION_ROI.map((l, i) => (
              <div key={l.location} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: COLORS[i] }}>
                  {l.location.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{l.location}</p>
                  <p className="text-xs text-muted-foreground">{l.deals} deals · avg {l.avgROI}% ROI</p>
                </div>
                <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex-shrink-0">
                  {l.growth}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-green-500" />
              Gurugram showing <span className="font-semibold text-foreground mx-0.5">+24% growth</span> — recommend expanding inventory
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ─── EMPLOYEE Dashboard ─────────────────────────────────────────────────── */
function EmployeeDashboard({ stats, activity }: {
  stats: ReturnType<typeof useGetDashboardStats>["data"];
  activity: ReturnType<typeof useGetRecentActivity>["data"];
}) {
  // Show the first agent's perspective as the "logged in" employee
  const { data: agents } = useGetAgents();
  const { data: allLeads } = useGetLeads({}, { query: { queryKey: getGetLeadsQueryKey({}) } });

  const me = agents?.[0];
  const myLeads = (allLeads ?? []).filter(l => l.agentId === me?.id);
  const myConverted = myLeads.filter(l => l.status === "closed_won").length;
  const myActive = myLeads.filter(l => !["closed_won","closed_lost"].includes(l.status)).length;
  const myConvRate = myLeads.length > 0 ? Math.round((myConverted / myLeads.length) * 100) : 0;
  const myPipeline = (allLeads ?? []).filter(l => l.agentId === me?.id && !["closed_won","closed_lost"].includes(l.status));

  const targetLeads = 10;
  const targetConverted = 4;

  return (
    <div className="space-y-6">
      {/* My stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="My Total Leads"    value={String(myLeads.length)}   sub={`Target: ${targetLeads} this month`}  icon={Users}       accent="border-l-blue-500"  trend="+5%" up />
        <KpiCard label="My Conversions"    value={String(myConverted)}      sub={`Target: ${targetConverted}`}         icon={CheckCircle2} accent="border-l-green-500" trend="+2%" up />
        <KpiCard label="Active Pipeline"   value={String(myActive)}         sub="leads in progress"                   icon={GitBranch}    accent="border-l-amber-500" />
        <KpiCard label="My Conv. Rate"     value={`${myConvRate}%`}         sub="leads to closed won"                 icon={Target}       accent="border-l-purple-500" />
      </div>

      {/* Target tracker */}
      <Card>
        <SectionTitle icon={Target} title="My Monthly Targets" sub={`${new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })}`} />
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">Leads Assigned</span>
              <span className="text-sm font-bold text-foreground">{myLeads.length} / {targetLeads}</span>
            </div>
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <div className={cn("h-full rounded-full transition-all", myLeads.length >= targetLeads ? "bg-green-500" : "bg-blue-500")} style={{ width: `${Math.min((myLeads.length / targetLeads) * 100, 100)}%` }} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{Math.max(0, targetLeads - myLeads.length)} more needed</p>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">Conversions</span>
              <span className="text-sm font-bold text-foreground">{myConverted} / {targetConverted}</span>
            </div>
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <div className={cn("h-full rounded-full transition-all", myConverted >= targetConverted ? "bg-green-500" : "bg-amber-500")} style={{ width: `${Math.min((myConverted / targetConverted) * 100, 100)}%` }} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{myConverted >= targetConverted ? "✓ Target reached!" : `${targetConverted - myConverted} more to go`}</p>
          </div>
        </div>
      </Card>

      {/* My leads pipeline */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <SectionTitle icon={GitBranch} title="My Active Leads" sub="Your pipeline right now" />
          <Link href="/leads" className="text-xs text-primary hover:underline flex items-center gap-1">
            View all <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        {myPipeline.length === 0 ? (
          <div className="py-8 text-center">
            <Users className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No active leads assigned to you</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider pr-4">Lead</th>
                  <th className="text-left pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider pr-4">Status</th>
                  <th className="text-left pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider pr-4">Score</th>
                  <th className="text-left pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider pr-4">Budget</th>
                  <th className="text-left pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {myPipeline.slice(0, 8).map((lead) => (
                  <tr key={lead.id} className="hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => window.location.href = `/leads/${lead.id}`}>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                          {lead.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{lead.name}</p>
                          <p className="text-xs text-muted-foreground">{lead.email}</p>
                        </div>
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
                        <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className={cn("h-full rounded-full", lead.score >= 80 ? "bg-green-500" : lead.score >= 60 ? "bg-amber-500" : "bg-red-400")} style={{ width: `${lead.score}%` }} />
                        </div>
                        <span className={cn("text-xs font-bold", scoreColor(lead.score))}>{lead.score}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-foreground font-medium text-xs">
                      {lead.budget ? formatCurrency(lead.budget) : "—"}
                    </td>
                    <td className="py-3 text-xs text-muted-foreground capitalize">{lead.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Recent activity relevant to me */}
      <Card>
        <SectionTitle icon={Activity} title="Recent Activity" sub="Latest updates from your team" />
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

/* ─── PAGE ROOT ──────────────────────────────────────────────────────────── */
type OwnerTab = "inventory" | "cashflow" | "leads" | "analysis";
const OWNER_TABS: { id: OwnerTab; label: string; icon: React.ElementType }[] = [
  { id: "inventory", label: "Inventory",      icon: Layers },
  { id: "cashflow",  label: "Cash Flow",       icon: DollarSign },
  { id: "leads",     label: "Lead Management", icon: Users },
  { id: "analysis",  label: "Analysis",        icon: BarChart3 },
];

export default function DashboardPage() {
  const [role, setRole] = useRole();
  const [tab, setTab] = useState<OwnerTab>("inventory");

  const { data: stats }    = useGetDashboardStats();
  const { data: pipeline } = useGetDashboardPipeline();
  const { data: activity } = useGetRecentActivity();
  const { data: sources }  = useGetLeadSources();

  return (
    <div className="p-6 space-y-6">
      {/* Header + Role switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {role === "owner" ? "Owner & Manager Dashboard" : "My Dashboard"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {role === "owner"
              ? "Full business view — inventory, finances, leads, and team analysis"
              : "Your personal pipeline, targets, and activity"}
          </p>
        </div>

        {/* Role switcher */}
        <div className="flex items-center gap-1 p-1 bg-muted rounded-lg self-start sm:self-auto flex-shrink-0">
          <button
            onClick={() => setRole("owner")}
            className={cn("flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all", role === "owner" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            <ShieldCheck className="w-4 h-4" />Owner / Manager
          </button>
          <button
            onClick={() => setRole("employee")}
            className={cn("flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all", role === "employee" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            <UserCheck className="w-4 h-4" />My Dashboard
          </button>
        </div>
      </div>

      {/* Owner: tab strip */}
      {role === "owner" && (
        <div className="flex gap-1 border-b border-border">
          {OWNER_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                tab === id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {role === "owner" ? (
        <>
          {tab === "inventory" && <InventoryTab />}
          {tab === "cashflow"  && <CashFlowTab />}
          {tab === "leads"     && <LeadManagementTab stats={stats} sources={sources} pipeline={pipeline} activity={activity} />}
          {tab === "analysis"  && <AnalysisTab />}
        </>
      ) : (
        <EmployeeDashboard stats={stats} activity={activity} />
      )}
    </div>
  );
}
