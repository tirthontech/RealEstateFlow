import { useState, useMemo } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import {
  useGetDashboardStats, useGetDashboardPipeline, useGetRecentActivity,
  useGetLeadSources, useGetLeads, useGetAgents, getGetLeadsQueryKey,
  useCreateLead,
} from "@workspace/api-client-react";
import type { DashboardStats, LeadSource, PipelineStage, ActivityItem } from "@workspace/api-client-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  Building2, Users, TrendingUp, GitBranch, Activity, ArrowUpRight, ArrowDownRight,
  AlertTriangle, CheckCircle2, Clock, Target, DollarSign, BarChart3, Layers,
  UserCheck, ChevronRight, Home, ShieldCheck, Zap, XCircle, TrendingDown, Calendar,
  Pencil, Plus, CheckCheck, Phone, X, HandCoins, BarChart2, Flame, Thermometer,
} from "lucide-react";
import { cn, formatCurrency, stageLabel, timeAgo, scoreColor, statusColor } from "@/lib/utils";
import { Link } from "wouter";
import { useRole } from "@/lib/role-context";
import { useToast } from "@/hooks/use-toast";

/* ─── Primitives ──────────────────────────────────────────────────────── */
function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("bg-card border border-card-border rounded-xl p-4 sm:p-5", className)}>{children}</div>;
}

function SectionTitle({ icon: Icon, title, sub, action }: {
  icon: React.ElementType; title: string; sub?: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-2 mb-4">
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="w-4 h-4 text-primary flex-shrink-0" />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground leading-none">{title}</h2>
          {sub && <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{sub}</p>}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

/* Redesigned KPI card — icon left, label/value/trend stacked right */
function KpiCard({ label, value, sub, icon: Icon, accent, trend, up }: {
  label: string; value: string; sub?: string; icon: React.ElementType;
  accent?: string; trend?: string; up?: boolean;
}) {
  return (
    <Card className={cn("border-l-4 hover:shadow-md transition-shadow", accent ?? "border-l-primary")}>
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10 text-primary flex-shrink-0">
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] sm:text-[11px] text-muted-foreground font-semibold uppercase tracking-wider truncate">{label}</p>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <p className="text-lg sm:text-xl font-bold text-foreground leading-none">{value}</p>
            {trend && (
              <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-semibold px-1 py-0.5 rounded-full flex-shrink-0",
                up ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600")}>
                {up ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}{trend}
              </span>
            )}
          </div>
          {sub && <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">{sub}</p>}
        </div>
      </div>
    </Card>
  );
}

/* Scrollable table wrapper */
function ScrollTable({ children, minWidth = 520 }: { children: React.ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto scrollbar-hide -mx-1 px-1 scroll-touch">
      <div style={{ minWidth }}>{children}</div>
    </div>
  );
}

/* ─── Mock data ───────────────────────────────────────────────────────── */
const PROJECTS = [
  { id: 1, name: "Prestige Lakeside",       location: "Whitefield, Bangalore",   type: "Residential", totalUnits: 120, sold: 78,  available: 32, underReview: 10, issues: 3, timeline: 72, completionDate: "Dec 2025", pricePerSqft: 8500,  avgSqft: 1200, status: "Under Construction", pendingApprovals: 2 },
  { id: 2, name: "Godrej Summit",            location: "Hinjewadi, Pune",          type: "Residential", totalUnits: 200, sold: 158, available: 42, underReview: 0,  issues: 1, timeline: 95, completionDate: "Apr 2026", pricePerSqft: 6800,  avgSqft: 1400, status: "Ready to Move",       pendingApprovals: 0 },
  { id: 3, name: "DLF Cybercity",            location: "Sector 54, Gurugram",      type: "Commercial",  totalUnits: 80,  sold: 22,  available: 50, underReview: 8,  issues: 5, timeline: 38, completionDate: "Mar 2027", pricePerSqft: 14200, avgSqft: 900,  status: "Under Construction", pendingApprovals: 5 },
  { id: 4, name: "Sobha Royal Crest",        location: "Sarjapur Road, Bangalore", type: "Residential", totalUnits: 150, sold: 91,  available: 45, underReview: 14, issues: 0, timeline: 60, completionDate: "Sep 2026", pricePerSqft: 9800,  avgSqft: 1600, status: "Under Construction", pendingApprovals: 3 },
];

const MILESTONES: Record<number, { name: string; done: boolean; delayed: boolean; reason?: string }[]> = {
  1: [
    { name: "Foundation", done: true,  delayed: false },
    { name: "Slab Work",  done: true,  delayed: true,  reason: "Monsoon delay" },
    { name: "Brickwork",  done: true,  delayed: true,  reason: "Material shortage" },
    { name: "Plastering", done: true,  delayed: true,  reason: "Labour dispute" },
    { name: "Finishing",  done: false, delayed: false },
    { name: "OC/Handover",done: false, delayed: false },
  ],
  2: [
    { name: "Foundation", done: true,  delayed: false },
    { name: "Slab Work",  done: true,  delayed: false },
    { name: "Brickwork",  done: true,  delayed: false },
    { name: "Plastering", done: true,  delayed: false },
    { name: "Finishing",  done: true,  delayed: false },
    { name: "OC/Handover",done: false, delayed: false },
  ],
  3: [
    { name: "Foundation", done: true,  delayed: false },
    { name: "Slab Work",  done: true,  delayed: true,  reason: "Ground stability" },
    { name: "Brickwork",  done: false, delayed: true,  reason: "Structural approval pending" },
    { name: "Plastering", done: false, delayed: false },
    { name: "Finishing",  done: false, delayed: false },
    { name: "OC/Handover",done: false, delayed: false },
  ],
  4: [
    { name: "Foundation", done: true,  delayed: false },
    { name: "Slab Work",  done: true,  delayed: false },
    { name: "Brickwork",  done: true,  delayed: false },
    { name: "Plastering", done: false, delayed: false },
    { name: "Finishing",  done: false, delayed: false },
    { name: "OC/Handover",done: false, delayed: false },
  ],
};

const BLOCKED_UNITS = [
  { unit: "A-302", project: "Prestige Lakeside",  buyer: "Arjun Kapoor",  salesperson: "Rahul Gupta",  days: 9,  expected: "May 15" },
  { unit: "C-108", project: "DLF Cybercity",      buyer: "Sanjay Mehta",  salesperson: "Arjun Mehta",  days: 12, expected: "May 18" },
  { unit: "B-506", project: "Sobha Royal Crest",  buyer: "Priya Verma",   salesperson: "Riya Sharma",  days: 8,  expected: "May 14" },
];

const CASH_FLOW = [
  { project: "Prestige Lakeside",  invested: 4_80_00_000, collected: 3_40_00_000, outstanding: 1_40_00_000, expectedRevenue: 5_50_00_000, margin: 14.6 },
  { project: "Godrej Summit",      invested: 8_20_00_000, collected: 7_90_00_000, outstanding: 30_00_000,   expectedRevenue: 9_50_00_000, margin: 15.8 },
  { project: "DLF Cybercity",      invested: 6_50_00_000, collected: 1_80_00_000, outstanding: 4_70_00_000, expectedRevenue: 10_20_00_000, margin: 36.4 },
  { project: "Sobha Royal Crest",  invested: 7_10_00_000, collected: 5_30_00_000, outstanding: 1_80_00_000, expectedRevenue: 8_80_00_000, margin: 19.4 },
];

const OVERDUE_COLLECTIONS = [
  { buyer: "Amit Jain",     unit: "B-105", project: "Godrej Summit",   dueDate: "Apr 15", amount: 15_00_000, days: 22 },
  { buyer: "Sunita Sharma", unit: "A-302", project: "Prestige Lakeside", dueDate: "Apr 20", amount: 8_50_000, days: 17 },
  { buyer: "Vikram Singh",  unit: "D-201", project: "Sobha Royal Crest", dueDate: "Apr 28", amount: 22_00_000, days: 9  },
  { buyer: "Deepa Nair",    unit: "C-109", project: "DLF Cybercity",   dueDate: "May 1",  amount: 35_00_000, days: 6  },
];

const MONTHLY_CF = [
  { month: "Jan", inflow: 82, outflow: 45 }, { month: "Feb", inflow: 95, outflow: 60 },
  { month: "Mar", inflow: 110, outflow: 72 }, { month: "Apr", inflow: 88, outflow: 55 },
  { month: "May", inflow: 130, outflow: 80 }, { month: "Jun", inflow: 145, outflow: 90 },
  { month: "Jul", inflow: 120, outflow: 75 }, { month: "Aug", inflow: 160, outflow: 95 },
];

const LOST_REASONS = [
  { reason: "Budget too high",          count: 8,  pct: 35, color: "#ef4444" },
  { reason: "Location preference",      count: 5,  pct: 22, color: "#f59e0b" },
  { reason: "Competitor offering",      count: 4,  pct: 17, color: "#8b5cf6" },
  { reason: "Project delay concern",    count: 3,  pct: 13, color: "#3b82f6" },
  { reason: "Config unavailable",       count: 2,  pct: 9,  color: "#10b981" },
  { reason: "No response",             count: 1,  pct: 4,  color: "#6b7280" },
];

const SOURCE_CPL = [
  { source: "99acres",     leads: 3, adSpend: 45_000, cpl: 15_000, conversions: 1, roi: "good" },
  { source: "Facebook",    leads: 2, adSpend: 30_000, cpl: 15_000, conversions: 0, roi: "poor" },
  { source: "Google",      leads: 1, adSpend: 25_000, cpl: 25_000, conversions: 0, roi: "poor" },
  { source: "MagicBricks", leads: 1, adSpend: 20_000, cpl: 20_000, conversions: 0, roi: "avg"  },
  { source: "Referral",    leads: 2, adSpend: 0,      cpl: 0,      conversions: 1, roi: "best" },
];

const EMPLOYEE_PERF = [
  { name: "Riya Sharma",  role: "Sr. Agent",  leads: 28, converted: 9,  rate: 32, revenue: 2_10_00_000, feedback: 4.7, target: 12, avgDays: 18, visits: 21 },
  { name: "Arjun Mehta",  role: "Agent",      leads: 22, converted: 6,  rate: 27, revenue: 1_45_00_000, feedback: 4.3, target: 10, avgDays: 24, visits: 15 },
  { name: "Pooja Nair",   role: "Sr. Agent",  leads: 31, converted: 11, rate: 35, revenue: 2_80_00_000, feedback: 4.8, target: 12, avgDays: 14, visits: 26 },
  { name: "Rahul Gupta",  role: "Agent",      leads: 18, converted: 4,  rate: 22, revenue: 95_00_000,   feedback: 4.1, target: 10, avgDays: 31, visits: 11 },
  { name: "Sneha Joshi",  role: "Manager",    leads: 15, converted: 7,  rate: 47, revenue: 3_20_00_000, feedback: 4.9, target: 8,  avgDays: 11, visits: 12 },
];

const LOCATION_ROI = [
  { location: "Bangalore", deals: 12, avgROI: 21, growth: "+18%" },
  { location: "Pune",      deals: 8,  avgROI: 16, growth: "+12%" },
  { location: "Gurugram",  deals: 5,  avgROI: 36, growth: "+24%" },
  { location: "Mumbai",    deals: 3,  avgROI: 14, growth: "+8%"  },
];

const TODAY_VISITS = [
  { lead: "Meera Patel",    project: "Prestige Lakeside", time: "10:00 AM", unit: "A-504", confirmed: true  },
  { lead: "Sanjay Verma",   project: "Godrej Summit",     time: "12:30 PM", unit: "B-302", confirmed: true  },
  { lead: "Deepa Krishnan", project: "Sobha Royal Crest", time: "3:00 PM",  unit: "B-405", confirmed: false },
];

const COLORS = ["#f59e0b", "#1e3a5f", "#10b981", "#8b5cf6", "#ef4444", "#3b82f6", "#f97316", "#06b6d4"];

/* ─── TODAY'S FOCUS ───────────────────────────────────────────────────── */
type TodayData = {
  todayViewings: { id: number; time: string; status: string; leadName: string | null; propertyTitle: string | null; agentName: string | null }[];
  overdueLeads:  { id: number; name: string; phone: string | null; source: string; createdAt: string }[];
  hotLeads:      { id: number; name: string; phone: string | null; source: string; score: number; status: string; budget: number | null }[];
};

function TodaysFocusWidget() {
  const { token } = useAuth();
  const { data, isLoading } = useQuery<TodayData>({
    queryKey: ["dashboard-today"],
    queryFn: () => fetch("/api/dashboard/today", {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json()),
    enabled: !!token,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
      </div>
    );
  }
  if (!data) return null;

  const { todayViewings, overdueLeads, hotLeads } = data;

  return (
    <div className="space-y-3">
      {/* 3-KPI summary strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 flex items-center gap-3">
          <Calendar className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <div>
            <p className="text-xl font-bold text-blue-700 leading-none">{todayViewings.length}</p>
            <p className="text-[10px] font-semibold text-blue-600/80 uppercase tracking-wide mt-0.5">Today's Visits</p>
          </div>
        </div>
        <div className={cn("border rounded-xl p-3.5 flex items-center gap-3", overdueLeads.length > 0 ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200")}>
          <AlertTriangle className={cn("w-5 h-5 flex-shrink-0", overdueLeads.length > 0 ? "text-red-600" : "text-emerald-600")} />
          <div>
            <p className={cn("text-xl font-bold leading-none", overdueLeads.length > 0 ? "text-red-700" : "text-emerald-700")}>{overdueLeads.length}</p>
            <p className={cn("text-[10px] font-semibold uppercase tracking-wide mt-0.5", overdueLeads.length > 0 ? "text-red-600/80" : "text-emerald-600/80")}>Overdue Leads</p>
          </div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3.5 flex items-center gap-3">
          <Flame className="w-5 h-5 text-orange-600 flex-shrink-0" />
          <div>
            <p className="text-xl font-bold text-orange-700 leading-none">{hotLeads.length}</p>
            <p className="text-[10px] font-semibold text-orange-600/80 uppercase tracking-wide mt-0.5">Hot Leads</p>
          </div>
        </div>
      </div>

      {/* Today's viewings list */}
      {todayViewings.length > 0 && (
        <Card>
          <SectionTitle icon={Calendar} title="Today's Site Visits" sub={new Date().toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric" })} />
          <div className="space-y-2">
            {todayViewings.map(v => (
              <div key={v.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                <span className="text-xs font-bold text-primary whitespace-nowrap flex-shrink-0 w-14">{v.time}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{v.leadName ?? "—"}</p>
                  <p className="text-xs text-muted-foreground truncate">{v.propertyTitle ?? "—"}{v.agentName ? ` · ${v.agentName}` : ""}</p>
                </div>
                <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap",
                  v.status === "confirmed" ? "bg-green-100 text-green-700" : v.status === "completed" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700")}>
                  {v.status.charAt(0).toUpperCase() + v.status.slice(1)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Overdue leads */}
      {overdueLeads.length > 0 && (
        <Card className="border-red-200 bg-red-50/20">
          <SectionTitle icon={AlertTriangle} title="Overdue Leads — Act Now" sub="New leads older than 2 hours without contact · SLA breach" />
          <div className="space-y-2">
            {overdueLeads.map(l => {
              const ageHrs = ((Date.now() - new Date(l.createdAt).getTime()) / 3_600_000).toFixed(1);
              return (
                <div key={l.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-red-100 bg-card">
                  <div className="w-7 h-7 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                    {l.name.split(" ").map((w: string) => w[0]).join("").slice(0,2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{l.name}</p>
                    <p className="text-xs text-muted-foreground truncate capitalize">{l.source} · <span className="text-red-600 font-medium">{ageHrs}h ago</span></p>
                  </div>
                  <Link href={`/leads/${l.id}`}
                    className="text-xs px-2.5 py-1.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors flex-shrink-0 whitespace-nowrap">
                    Follow Up
                  </Link>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Hot leads */}
      {hotLeads.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/20">
          <SectionTitle icon={Flame} title="Hot Leads — High Intent" sub="Score ≥75 · Need a call or visit scheduled today" />
          <div className="space-y-2">
            {hotLeads.map(l => (
              <div key={l.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-orange-100 bg-card">
                <div className="w-7 h-7 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                  {l.name.split(" ").map((w: string) => w[0]).join("").slice(0,2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{l.name}</p>
                  <p className="text-xs text-muted-foreground truncate capitalize">{l.source} · Score: <span className="font-bold text-orange-700">{l.score}</span></p>
                </div>
                {l.budget && <span className="text-xs font-semibold text-foreground whitespace-nowrap flex-shrink-0">{formatCurrency(l.budget)}</span>}
                <Link href={`/leads/${l.id}`}
                  className="text-xs px-2.5 py-1.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors flex-shrink-0 whitespace-nowrap">
                  View
                </Link>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ─── INVENTORY ───────────────────────────────────────────────────────── */
function InventoryTab() {
  const [expandedProject, setExpandedProject] = useState<number | null>(null);
  const [blockedUnits, setBlockedUnits] = useState([...BLOCKED_UNITS]);
  const { toast } = useToast();

  const totalUnits  = PROJECTS.reduce((s, p) => s + p.totalUnits, 0);
  const totalSold   = PROJECTS.reduce((s, p) => s + p.sold, 0);
  const totalAvail  = PROJECTS.reduce((s, p) => s + p.available, 0);
  const totalIssues = PROJECTS.reduce((s, p) => s + p.issues, 0);
  const pending     = PROJECTS.reduce((s, p) => s + p.pendingApprovals, 0);

  function approveUnit(unit: string) {
    setBlockedUnits((prev) => prev.filter((u) => u.unit !== unit));
    toast({ title: `Unit ${unit} approved`, description: "Booking confirmed and moved to active pipeline." });
  }

  function releaseUnit(unit: string) {
    setBlockedUnits((prev) => prev.filter((u) => u.unit !== unit));
    toast({ title: `Unit ${unit} released`, description: "Unit is now available for re-booking.", variant: "destructive" });
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        <KpiCard label="Total Inventory"   value={String(totalUnits)}  sub="across all projects" icon={Layers}        accent="border-l-blue-500"   trend="+12%" up />
        <KpiCard label="Units Sold"        value={String(totalSold)}   sub={`${Math.round(totalSold/totalUnits*100)}% sell-through`} icon={CheckCircle2} accent="border-l-green-500" trend="+18%" up />
        <KpiCard label="Available"         value={String(totalAvail)}  sub="ready to book"       icon={Home}          accent="border-l-amber-500"  />
        <KpiCard label="Active Issues"     value={String(totalIssues)} sub="flagged by team"     icon={AlertTriangle} accent="border-l-red-500"    />
        <KpiCard label="Pending Approvals" value={String(pending)}     sub="awaiting manager"    icon={ShieldCheck}   accent="border-l-purple-500" />
      </div>

      {/* Blocked Units Alert */}
      {blockedUnits.length > 0 && (
      <Card className="border-amber-200 bg-amber-50/40 !p-4">
        <SectionTitle icon={AlertTriangle} title="Blocked Units Alert" sub={`${blockedUnits.length} unit${blockedUnits.length !== 1 ? "s" : ""} blocked beyond 7-day threshold`} />
        <div className="space-y-2">
          {blockedUnits.map((u) => (
            <div key={u.unit} className="flex flex-col sm:flex-row sm:items-center gap-3 bg-card rounded-lg px-3 py-3 border border-amber-100">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold flex-shrink-0">{u.days}d</div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{u.unit} · {u.project}</p>
                  <p className="text-xs text-muted-foreground">
                    For <span className="font-medium text-foreground">{u.buyer}</span> · {u.salesperson} · Expected: {u.expected}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0 sm:ml-auto">
                <button onClick={() => approveUnit(u.unit)} className="flex-1 sm:flex-none text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors">Approve</button>
                <button onClick={() => releaseUnit(u.unit)} className="flex-1 sm:flex-none text-xs px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg font-medium hover:bg-red-100 transition-colors">Release</button>
              </div>
            </div>
          ))}
        </div>
      </Card>
      )}

      {/* Project cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {PROJECTS.map((p) => {
          const sellPct = Math.round((p.sold / p.totalUnits) * 100);
          const ms = MILESTONES[p.id] ?? [];
          const isExpanded = expandedProject === p.id;
          return (
            <Card key={p.id} className="hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-foreground text-sm truncate">{p.name}</h3>
                  <p className="text-xs text-muted-foreground truncate">{p.location} · {p.type}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1 flex-shrink-0 justify-end">
                  {p.issues > 0 && <span className="text-[10px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 whitespace-nowrap"><AlertTriangle className="w-2.5 h-2.5" />{p.issues}</span>}
                  {p.pendingApprovals > 0 && <span className="text-[10px] font-medium text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 whitespace-nowrap"><Clock className="w-2.5 h-2.5" />{p.pendingApprovals}</span>}
                  <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap", p.status === "Ready to Move" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700")}>{p.status}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3">
                {[["Sold", p.sold, "text-green-600"], ["Available", p.available, "text-amber-600"], ["Review", p.underReview, "text-blue-600"]].map(([l, v, cls]) => (
                  <div key={String(l)} className="text-center bg-muted/30 rounded-lg p-2">
                    <p className={cn("text-base sm:text-lg font-bold", String(cls))}>{v}</p>
                    <p className="text-[10px] text-muted-foreground">{l}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-2 mb-3">
                {[
                  { label: "Sell-through", pct: sellPct, detail: `${sellPct}% · ${p.sold}/${p.totalUnits}`, color: "bg-green-500" },
                  { label: "Construction", pct: p.timeline, detail: `${p.timeline}% · Due ${p.completionDate}`, color: "bg-blue-500" },
                ].map(({ label, pct, detail, color }) => (
                  <div key={label}>
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                      <span>{label}</span><span className="font-semibold text-foreground">{detail}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={() => setExpandedProject(isExpanded ? null : p.id)}
                className="text-xs text-primary hover:underline flex items-center gap-1 mb-2">
                {isExpanded ? "Hide" : "Show"} milestones
                <ChevronRight className={cn("w-3 h-3 transition-transform", isExpanded && "rotate-90")} />
              </button>

              {isExpanded && (
                <div className="space-y-1.5 py-2 border-t border-border">
                  {ms.map((m, i) => (
                    <div key={m.name} className="flex items-center gap-2">
                      <div className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0",
                        m.done ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground")}>
                        {m.done ? "✓" : i + 1}
                      </div>
                      <span className={cn("text-xs", m.done ? "text-foreground font-medium" : "text-muted-foreground")}>{m.name}</span>
                      {m.delayed && <span className="text-[9px] bg-red-50 text-red-600 px-1 rounded flex items-center gap-0.5 ml-auto flex-shrink-0"><AlertTriangle className="w-2 h-2" />{m.reason ?? "Delayed"}</span>}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 flex items-center justify-between text-[10px] sm:text-xs text-muted-foreground border-t border-border pt-3">
                <span>₹{p.pricePerSqft.toLocaleString("en-IN")}/sqft · avg {p.avgSqft} sqft</span>
                <span className="font-semibold text-foreground">{formatCurrency(p.pricePerSqft * p.avgSqft)}</span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

type PaymentEntry = { buyer: string; unit: string; project: string; dueDate: string; amount: number; days: number };
type ProjectFinancial = { project: string; invested: number; collected: number; outstanding: number; expectedRevenue: number; margin: number };

/* ─── CASH FLOW ───────────────────────────────────────────────────────── */
function CashFlowTab({ editable = false }: { editable?: boolean }) {
  const [priceAdj, setPriceAdj] = useState(0);
  const [costAdj, setCostAdj] = useState(0);

  const [payments, setPayments] = useState<PaymentEntry[]>([...OVERDUE_COLLECTIONS]);
  const [projects, setProjects] = useState<ProjectFinancial[]>([...CASH_FLOW]);
  const [editingPayment, setEditingPayment] = useState<PaymentEntry | null>(null);
  const [addingPayment, setAddingPayment] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectFinancial | null>(null);
  const [newPmt, setNewPmt] = useState<Partial<PaymentEntry>>({});
  const [editPmt, setEditPmt] = useState<Partial<PaymentEntry>>({});
  const [editProj, setEditProj] = useState<Partial<ProjectFinancial>>({});

  function markPaid(buyer: string) {
    setPayments(prev => prev.filter(p => p.buyer !== buyer));
  }
  function saveEditPayment() {
    if (!editingPayment) return;
    setPayments(prev => prev.map(p => p.buyer === editingPayment.buyer ? { ...editingPayment, ...editPmt } as PaymentEntry : p));
    setEditingPayment(null); setEditPmt({});
  }
  function saveAddPayment() {
    if (!newPmt.buyer || !newPmt.amount) return;
    setPayments(prev => [...prev, { buyer: newPmt.buyer!, unit: newPmt.unit ?? "—", project: newPmt.project ?? "—", dueDate: newPmt.dueDate ?? "—", amount: Number(newPmt.amount), days: Number(newPmt.days ?? 0) }]);
    setAddingPayment(false); setNewPmt({});
  }
  function saveEditProject() {
    if (!editingProject) return;
    setProjects(prev => prev.map(p => p.project === editingProject.project ? { ...editingProject, ...editProj } as ProjectFinancial : p));
    setEditingProject(null); setEditProj({});
  }

  const totals = useMemo(() => ({
    invested:    projects.reduce((s, c) => s + c.invested, 0),
    collected:   projects.reduce((s, c) => s + c.collected, 0),
    outstanding: projects.reduce((s, c) => s + c.outstanding, 0),
    expected:    projects.reduce((s, c) => s + c.expectedRevenue, 0),
    overdue:     payments.reduce((s, c) => s + c.amount, 0),
    avgMargin:   projects.length > 0 ? projects.reduce((s, c) => s + c.margin, 0) / projects.length : 0,
  }), [projects, payments]);

  const baseProfit     = totals.expected - totals.invested;
  const scenarioProfit = (totals.expected * (1 + priceAdj / 100)) - (totals.invested * (1 + costAdj / 100));
  const profitDelta    = scenarioProfit - baseProfit;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        <KpiCard label="Total Invested"   value={formatCurrency(totals.invested)}    sub="across all projects" icon={DollarSign}    accent="border-l-blue-500"    />
        <KpiCard label="Collected"        value={formatCurrency(totals.collected)}   sub={`${Math.round(totals.collected/totals.invested*100)}% of invested`} icon={TrendingUp} accent="border-l-green-500" trend="+23%" up />
        <KpiCard label="Outstanding"      value={formatCurrency(totals.outstanding)} sub="yet to collect"      icon={Clock}         accent="border-l-amber-500"   />
        <KpiCard label="Overdue"          value={formatCurrency(totals.overdue)}     sub={`${OVERDUE_COLLECTIONS.length} instalments`} icon={AlertTriangle} accent="border-l-red-500" />
        <KpiCard label="Avg Margin"       value={`${totals.avgMargin.toFixed(1)}%`}  sub="blended profit"      icon={Target}        accent="border-l-emerald-500" trend="+3.2%" up />
      </div>

      {/* Overdue collections */}
      <Card className="border-red-200 bg-red-50/20">
        <SectionTitle icon={AlertTriangle} title="Overdue Instalments" sub="Buyers with missed payment deadlines"
          action={editable ? (
            <button onClick={() => { setNewPmt({}); setAddingPayment(true); }}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity whitespace-nowrap">
              <Plus className="w-3 h-3" />Add Entry
            </button>
          ) : undefined}
        />
        {payments.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">No overdue instalments — all caught up!</div>
        ) : (
          <ScrollTable minWidth={editable ? 560 : 480}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Buyer", "Unit / Project", "Due Date", "Amount", "Overdue", ...(editable ? ["Actions"] : [])].map(h => (
                    <th key={h} className="text-left pb-2 text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider pr-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.map((c) => (
                  <tr key={c.buyer} className="hover:bg-muted/20">
                    <td className="py-2.5 pr-3 font-medium text-foreground whitespace-nowrap text-sm">{c.buyer}</td>
                    <td className="py-2.5 pr-3 text-xs">
                      <span className="font-medium text-foreground">{c.unit}</span>
                      <span className="text-muted-foreground"> · {c.project}</span>
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-muted-foreground whitespace-nowrap">{c.dueDate}</td>
                    <td className="py-2.5 pr-3 font-semibold text-sm whitespace-nowrap">{formatCurrency(c.amount)}</td>
                    <td className="py-2.5 pr-3">
                      <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap",
                        c.days > 15 ? "bg-red-100 text-red-700" : c.days > 7 ? "bg-amber-100 text-amber-700" : "bg-yellow-100 text-yellow-700")}>
                        {c.days}d
                      </span>
                    </td>
                    {editable && (
                      <td className="py-2.5">
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setEditingPayment(c); setEditPmt({ ...c }); }}
                            className="p-1 rounded hover:bg-blue-50 text-blue-600 transition-colors" title="Edit">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => markPaid(c.buyer)}
                            className="p-1 rounded hover:bg-green-50 text-green-600 transition-colors" title="Mark as Paid">
                            <CheckCheck className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
        )}
        <p className="mt-3 text-xs text-muted-foreground flex items-start gap-1">
          <Zap className="w-3 h-3 text-red-500 flex-shrink-0 mt-0.5" />
          Total overdue: <span className="font-semibold text-red-600 ml-0.5">{formatCurrency(totals.overdue)}</span>
          <span className="hidden sm:inline"> — legal notice recommended for 15+ day cases</span>
        </p>
      </Card>

      {/* Edit Payment Modal */}
      {editingPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-card rounded-xl border border-border shadow-xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Edit Payment Entry</h3>
              <button onClick={() => { setEditingPayment(null); setEditPmt({}); }} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            {([
              { label: "Buyer Name", key: "buyer", type: "text" },
              { label: "Unit", key: "unit", type: "text" },
              { label: "Project", key: "project", type: "text" },
              { label: "Due Date", key: "dueDate", type: "text" },
              { label: "Amount (₹)", key: "amount", type: "number" },
              { label: "Days Overdue", key: "days", type: "number" },
            ] as const).map(({ label, key, type }) => (
              <div key={key}>
                <label className="text-xs font-medium text-muted-foreground block mb-1">{label}</label>
                <input type={type} value={String((editPmt as Record<string, unknown>)[key] ?? "")}
                  onChange={e => setEditPmt(p => ({ ...p, [key]: type === "number" ? Number(e.target.value) : e.target.value }))}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <button onClick={saveEditPayment} className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">Save</button>
              <button onClick={() => { setEditingPayment(null); setEditPmt({}); }} className="flex-1 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted/50 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Payment Modal */}
      {addingPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-card rounded-xl border border-border shadow-xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Add Payment Entry</h3>
              <button onClick={() => { setAddingPayment(false); setNewPmt({}); }} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            {([
              { label: "Buyer Name *", key: "buyer", type: "text" },
              { label: "Unit", key: "unit", type: "text" },
              { label: "Project", key: "project", type: "text" },
              { label: "Due Date", key: "dueDate", type: "text", placeholder: "e.g. May 15" },
              { label: "Amount (₹) *", key: "amount", type: "number" },
              { label: "Days Overdue", key: "days", type: "number" },
            ] as const).map(({ label, key, type, placeholder }: { label: string; key: string; type: string; placeholder?: string }) => (
              <div key={key}>
                <label className="text-xs font-medium text-muted-foreground block mb-1">{label}</label>
                <input type={type} placeholder={placeholder ?? ""} value={String((newPmt as Record<string, unknown>)[key] ?? "")}
                  onChange={e => setNewPmt(p => ({ ...p, [key]: type === "number" ? Number(e.target.value) : e.target.value }))}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <button onClick={saveAddPayment} className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">Add</button>
              <button onClick={() => { setAddingPayment(false); setNewPmt({}); }} className="flex-1 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted/50 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Monthly chart */}
      <Card>
        <SectionTitle icon={BarChart3} title="Monthly Cash Flow" sub="Inflow vs outflow (₹ lakhs) — FY 2025–26" />
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={MONTHLY_CF} barGap={4} barSize={12}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} unit="L" width={36} />
            <Tooltip formatter={(v: number) => [`₹${v}L`]} />
            <Bar dataKey="inflow"  fill="#22c55e" radius={[4,4,0,0]} name="Inflow" />
            <Bar dataKey="outflow" fill="#f59e0b" radius={[4,4,0,0]} name="Outflow" />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-green-500 inline-block flex-shrink-0" />Inflow</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-500 inline-block flex-shrink-0" />Outflow</span>
        </div>
      </Card>

      {/* Project table */}
      <Card>
        <SectionTitle icon={Layers} title="Project-wise Financial Summary" sub="Investment, collections, projected profit" />
        <ScrollTable minWidth={editable ? 640 : 560}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Project", "Invested", "Collected", "Outstanding", "Expected", "Profit", "Margin", ...(editable ? [""] : [])].map(h => (
                  <th key={h} className="text-left pb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider pr-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {projects.map((c) => (
                <tr key={c.project} className="hover:bg-muted/20">
                  <td className="py-2.5 pr-3 font-medium text-foreground text-xs whitespace-nowrap">{c.project}</td>
                  <td className="py-2.5 pr-3 text-muted-foreground text-xs whitespace-nowrap">{formatCurrency(c.invested)}</td>
                  <td className="py-2.5 pr-3 text-green-600 font-medium text-xs whitespace-nowrap">{formatCurrency(c.collected)}</td>
                  <td className="py-2.5 pr-3 text-amber-600 text-xs whitespace-nowrap">{formatCurrency(c.outstanding)}</td>
                  <td className="py-2.5 pr-3 text-xs whitespace-nowrap">{formatCurrency(c.expectedRevenue)}</td>
                  <td className="py-2.5 pr-3 text-emerald-600 font-semibold text-xs whitespace-nowrap">{formatCurrency(c.expectedRevenue - c.invested)}</td>
                  <td className="py-2.5 pr-3"><span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-700 whitespace-nowrap">{c.margin}%</span></td>
                  {editable && (
                    <td className="py-2.5">
                      <button onClick={() => { setEditingProject(c); setEditProj({ ...c }); }}
                        className="p-1 rounded hover:bg-blue-50 text-blue-600 transition-colors" title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/20 font-bold text-xs">
                <td className="py-2.5 pr-3 text-foreground">Total</td>
                <td className="py-2.5 pr-3 whitespace-nowrap">{formatCurrency(totals.invested)}</td>
                <td className="py-2.5 pr-3 text-green-600 whitespace-nowrap">{formatCurrency(totals.collected)}</td>
                <td className="py-2.5 pr-3 text-amber-600 whitespace-nowrap">{formatCurrency(totals.outstanding)}</td>
                <td className="py-2.5 pr-3 whitespace-nowrap">{formatCurrency(totals.expected)}</td>
                <td className="py-2.5 pr-3 text-emerald-600 whitespace-nowrap">{formatCurrency(totals.expected - totals.invested)}</td>
                <td className="py-2.5 text-green-700">{totals.avgMargin.toFixed(1)}%</td>
                {editable && <td />}
              </tr>
            </tfoot>
          </table>
        </ScrollTable>
      </Card>

      {/* Edit Project Modal */}
      {editingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-card rounded-xl border border-border shadow-xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground text-sm">Edit: {editingProject.project}</h3>
              <button onClick={() => { setEditingProject(null); setEditProj({}); }} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            {([
              { label: "Invested (₹)", key: "invested" },
              { label: "Collected (₹)", key: "collected" },
              { label: "Outstanding (₹)", key: "outstanding" },
              { label: "Expected Revenue (₹)", key: "expectedRevenue" },
              { label: "Margin (%)", key: "margin" },
            ] as const).map(({ label, key }) => (
              <div key={key}>
                <label className="text-xs font-medium text-muted-foreground block mb-1">{label}</label>
                <input type="number" value={String((editProj as Record<string, unknown>)[key] ?? "")}
                  onChange={e => setEditProj(p => ({ ...p, [key]: Number(e.target.value) }))}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <button onClick={saveEditProject} className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">Save</button>
              <button onClick={() => { setEditingProject(null); setEditProj({}); }} className="flex-1 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted/50 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Scenario modelling */}
      <Card className="border-blue-200 bg-blue-50/20">
        <SectionTitle icon={Zap} title="Scenario Modelling" sub="See how price or cost changes affect total profit" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="space-y-5">
            {[
              { label: "Price per sqft adjustment", value: priceAdj, setter: setPriceAdj, positive: "green" },
              { label: "Construction cost adjustment", value: costAdj, setter: setCostAdj, positive: "red" },
            ].map(({ label, value, setter }) => (
              <div key={label}>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium text-foreground">{label}</label>
                  <span className={cn("text-sm font-bold", value >= 0 ? "text-green-600" : "text-red-600")}>{value >= 0 ? "+" : ""}{value}%</span>
                </div>
                <input type="range" min={-20} max={20} value={value} onChange={(e) => setter(Number(e.target.value))}
                  className="w-full accent-primary h-2" />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1"><span>-20%</span><span>0</span><span>+20%</span></div>
              </div>
            ))}
          </div>
          <div className="bg-card rounded-xl border border-border p-4 space-y-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Impact Preview</p>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-sm text-foreground">Base Profit</span>
              <span className="font-bold">{formatCurrency(baseProfit)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-sm text-foreground">Adjusted Profit</span>
              <span className={cn("font-bold text-lg", scenarioProfit >= baseProfit ? "text-green-600" : "text-red-600")}>{formatCurrency(scenarioProfit)}</span>
            </div>
            <div className={cn("flex items-center gap-2 py-2.5 px-3 rounded-lg", profitDelta >= 0 ? "bg-green-50" : "bg-red-50")}>
              {profitDelta >= 0 ? <TrendingUp className="w-4 h-4 text-green-600 flex-shrink-0" /> : <TrendingDown className="w-4 h-4 text-red-600 flex-shrink-0" />}
              <span className={cn("text-sm font-semibold", profitDelta >= 0 ? "text-green-700" : "text-red-700")}>
                {profitDelta >= 0 ? "+" : ""}{formatCurrency(profitDelta)} impact
              </span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ─── LEAD MANAGEMENT ─────────────────────────────────────────────────── */
function LeadManagementTab({ stats, sources, pipeline, activity }: {
  stats: DashboardStats | undefined;
  sources: LeadSource[] | undefined;
  pipeline: PipelineStage[] | undefined;
  activity: ActivityItem[] | undefined;
}) {
  const { data: allLeads } = useGetLeads({}, { query: { queryKey: getGetLeadsQueryKey({}) } });
  const leadList = allLeads ?? [];
  const stageOrder = ["new","contacted","qualified","proposal","negotiation","closed_won","closed_lost"];
  const stageCounts = useMemo(() => stageOrder.map(s => ({ stage: s, count: leadList.filter(l => l.status === s).length })), [leadList]);
  const funnelMax  = useMemo(() => Math.max(...stageCounts.map(s => s.count), 1), [stageCounts]);
  const sourceTotal = (sources ?? []).reduce((s, x) => s + x.count, 0);
  const staleLeads  = leadList.filter(l => ["new","contacted"].includes(l.status)).slice(0, 5);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total Leads"    value={String(stats?.totalLeads ?? 0)}     sub={`+${stats?.newLeadsThisMonth ?? 0} this month`} icon={Users}       accent="border-l-blue-500"   trend="+8%" up />
        <KpiCard label="Converted"      value={String(leadList.filter(l=>l.status==="closed_won").length)} sub="became customers" icon={UserCheck} accent="border-l-green-500" trend="+21%" up />
        <KpiCard label="In Progress"    value={String(leadList.filter(l=>!["closed_won","closed_lost"].includes(l.status)).length)} sub="active pipeline" icon={GitBranch} accent="border-l-amber-500" />
        <KpiCard label="Conv. Rate"     value={`${stats?.conversionRate ?? 0}%`}   sub="lead → closed won" icon={Target}      accent="border-l-purple-500" trend="+3%" up />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Funnel */}
        <Card>
          <SectionTitle icon={GitBranch} title="Lead Conversion Funnel" sub="Leads at each pipeline stage" />
          <div className="space-y-2">
            {stageCounts.filter(s => s.count > 0).map((s, i) => (
              <div key={s.stage}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-foreground">{stageLabel(s.stage)}</span>
                  <span className="text-muted-foreground">{s.count}</span>
                </div>
                <div className="h-5 rounded bg-muted overflow-hidden">
                  <div className="h-full rounded flex items-center pl-2 text-[11px] font-medium text-white"
                    style={{ width: `${(s.count / funnelMax) * 100}%`, background: COLORS[i % COLORS.length] }}>
                    {s.count}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Lead sources */}
        <Card>
          <SectionTitle icon={BarChart3} title="Lead Sources" sub="Where leads are coming from" />
          <div className="space-y-2.5">
            {(sources ?? []).map((s, i) => {
              const pct = sourceTotal > 0 ? Math.round((s.count / sourceTotal) * 100) : 0;
              return (
                <div key={s.source}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-medium text-foreground capitalize">{s.source}</span>
                    <span className="text-xs text-muted-foreground">{s.count} · {pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Cost per lead */}
      <Card>
        <SectionTitle icon={DollarSign} title="Cost Per Lead by Channel" sub="Where is your marketing budget working hardest?" />
        <ScrollTable minWidth={460}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Channel", "Leads", "Ad Spend", "CPL", "Converted", "ROI"].map(h => (
                  <th key={h} className="text-left pb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider pr-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {SOURCE_CPL.map((s) => (
                <tr key={s.source} className="hover:bg-muted/20">
                  <td className="py-2.5 pr-3 font-medium text-foreground text-sm">{s.source}</td>
                  <td className="py-2.5 pr-3 text-muted-foreground text-sm">{s.leads}</td>
                  <td className="py-2.5 pr-3 text-muted-foreground text-xs whitespace-nowrap">{s.adSpend > 0 ? `₹${(s.adSpend/1000).toFixed(0)}k` : "—"}</td>
                  <td className="py-2.5 pr-3 font-medium text-sm whitespace-nowrap">{s.cpl > 0 ? `₹${(s.cpl/1000).toFixed(0)}k` : "Organic"}</td>
                  <td className="py-2.5 pr-3 text-sm">{s.conversions}</td>
                  <td className="py-2.5">
                    <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap",
                      s.roi === "best" ? "bg-green-100 text-green-700" : s.roi === "good" ? "bg-blue-100 text-blue-700" : s.roi === "avg" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700")}>
                      {s.roi === "best" ? "Best" : s.roi === "good" ? "Good" : s.roi === "avg" ? "Avg" : "Poor"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
      </Card>

      {/* Follow-up compliance */}
      {staleLeads.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/20">
          <SectionTitle icon={AlertTriangle} title="Follow-up Compliance" sub="Leads with no status progress — action required" />
          <div className="space-y-2">
            {staleLeads.map((lead) => (
              <div key={lead.id} className="flex items-center gap-3 bg-card rounded-lg px-3 py-2.5 border border-orange-100">
                <div className="w-7 h-7 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                  {lead.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{lead.name}</p>
                  <p className="text-xs text-muted-foreground truncate capitalize">{lead.status} · {lead.source}</p>
                </div>
                <Link href={`/leads/${lead.id}`} className="text-xs text-primary hover:underline flex-shrink-0 whitespace-nowrap">Follow up →</Link>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Lost lead analysis */}
      <Card>
        <SectionTitle icon={XCircle} title="Lost Lead Analysis" sub="Why are leads not converting?" />
        <div className="space-y-2.5">
          {LOST_REASONS.map((r) => (
            <div key={r.reason}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-foreground">{r.reason}</span>
                <span className="text-xs text-muted-foreground">{r.count} · {r.pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${r.pct}%`, background: r.color }} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground flex items-start gap-1">
          <Zap className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
          35% lost to budget — consider a more affordable configuration or flexible payment plan.
        </p>
      </Card>

      {/* Pipeline chart */}
      <Card>
        <SectionTitle icon={DollarSign} title="Pipeline Value by Stage" sub="Deal values across active stages"
          action={<Link href="/leads" className="text-xs text-primary hover:underline flex items-center gap-1 whitespace-nowrap">All leads <ChevronRight className="w-3 h-3" /></Link>} />
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={(pipeline ?? []).filter(p => !["closed_won","closed_lost"].includes(p.stage))} barSize={22}>
            <XAxis dataKey="stage" tickFormatter={s => stageLabel(s).split(" ")[0]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 10 }} width={52} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v: number) => [formatCurrency(v), "Value"]} labelFormatter={stageLabel} />
            <Bar dataKey="value" fill="#f59e0b" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

/* ─── ANALYSIS ────────────────────────────────────────────────────────── */
function AnalysisTab() {
  return (
    <div className="space-y-5">
      <Card>
        <SectionTitle icon={UserCheck} title="Sales Team Performance" sub="Leads, conversions, revenue and time to close" />
        <ScrollTable minWidth={600}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Employee","Leads","Conv.","Rate","Revenue","Avg Days","Visits","vs Target"].map(h => (
                  <th key={h} className="text-left pb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider pr-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {EMPLOYEE_PERF.map((e) => {
                const delta = e.converted - e.target;
                return (
                  <tr key={e.name} className="hover:bg-muted/20">
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                          {e.name.split(" ").map(w=>w[0]).join("")}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground text-xs whitespace-nowrap">{e.name}</p>
                          <p className="text-[10px] text-muted-foreground">{e.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 text-sm">{e.leads}</td>
                    <td className="py-2.5 pr-3 text-green-600 font-medium text-sm">{e.converted}</td>
                    <td className="py-2.5 pr-3">
                      <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap",
                        e.rate >= 35 ? "bg-green-100 text-green-700" : e.rate >= 25 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700")}>{e.rate}%</span>
                    </td>
                    <td className="py-2.5 pr-3 font-semibold text-xs whitespace-nowrap">{formatCurrency(e.revenue)}</td>
                    <td className="py-2.5 pr-3">
                      <span className={cn("text-xs font-medium whitespace-nowrap",
                        e.avgDays <= 15 ? "text-green-600" : e.avgDays <= 25 ? "text-amber-600" : "text-red-600")}>{e.avgDays}d</span>
                    </td>
                    <td className="py-2.5 pr-3 text-muted-foreground text-sm">{e.visits}</td>
                    <td className="py-2.5">
                      <span className={cn("flex items-center gap-0.5 text-xs font-semibold whitespace-nowrap",
                        delta >= 0 ? "text-green-600" : "text-red-600")}>
                        {delta >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {delta >= 0 ? `+${delta}` : delta}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollTable>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <SectionTitle icon={XCircle} title="Lost Lead Reasons" sub="Top reasons deals don't close" />
          <div className="space-y-3">
            {LOST_REASONS.map((r) => (
              <div key={r.reason} className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: r.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between mb-0.5">
                    <span className="text-xs font-medium text-foreground truncate mr-2">{r.reason}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{r.count} · {r.pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${r.pct}%`, background: r.color }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle icon={Building2} title="Growth by Location" sub="Deal activity and ROI by city" />
          <div className="space-y-2.5">
            {LOCATION_ROI.map((l, i) => (
              <div key={l.location} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: COLORS[i] }}>
                  {l.location.slice(0,2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{l.location}</p>
                  <p className="text-xs text-muted-foreground">{l.deals} deals · {l.avgROI}% ROI</p>
                </div>
                <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap">{l.growth}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ─── QUICK LEAD DIALOG ───────────────────────────────────────────────── */
function QuickLeadDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const createLead = useCreateLead({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetLeadsQueryKey({}) });
        toast({ title: "Lead logged successfully" });
        onClose();
        setForm({ name: "", phone: "", source: "phone", budget: "", notes: "" });
      },
      onError: () => toast({ title: "Failed to log lead", variant: "destructive" }),
    },
  });
  const [form, setForm] = useState({ name: "", phone: "", source: "phone", budget: "", notes: "" });

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-card rounded-xl border border-border shadow-xl w-full max-w-sm p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-green-100"><Phone className="w-4 h-4 text-green-700" /></div>
            <h3 className="font-semibold text-foreground">Log Inbound Call Lead</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Full Name *</label>
          <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Caller's name"
            className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Phone</label>
          <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+91 xxxxx xxxxx"
            className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Source</label>
          <select value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))}
            className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
            {["phone","whatsapp","referral","walk_in","99acres","magicbricks","facebook","google","other"].map(s => (
              <option key={s} value={s}>{s.replace(/_/g," ").replace(/\b\w/g,l=>l.toUpperCase())}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Budget (₹)</label>
          <input type="number" value={form.budget} onChange={e => setForm(p => ({ ...p, budget: e.target.value }))} placeholder="e.g. 5000000"
            className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Quick Notes</label>
          <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="What did they want?"
            className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
        </div>
        <div className="flex gap-2 pt-1">
          <button disabled={!form.name || createLead.isPending}
            onClick={() => createLead.mutate({ data: {
              name: form.name, email: `${form.name.toLowerCase().replace(/\s+/g,"")}@lead.com`,
              phone: form.phone || null, source: form.source, status: "new", score: 50,
              budget: form.budget ? Number(form.budget) : null,
              notes: form.notes || null, propertyType: null,
            }})}
            className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50">
            {createLead.isPending ? "Logging…" : "Log Lead"}
          </button>
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted/50 transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  );
}

/* ─── EMPLOYEE DASHBOARD ──────────────────────────────────────────────── */
const TEAM_FILTERS = ["D1", "D2", "D3", "D4", "D5"];

function getGreeting(name: string) {
  const h = new Date().getHours();
  const tod = h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening";
  return `Good ${tod}, ${name.split(" ")[0]}!`;
}

function EmployeeDashboard({ activity }: {
  activity: ActivityItem[] | undefined;
}) {
  const [quickLeadOpen, setQuickLeadOpen] = useState(false);
  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  const { profile } = useRole();
  const { data: agents }   = useGetAgents();
  const { data: allLeads } = useGetLeads({}, { query: { queryKey: getGetLeadsQueryKey({}) } });

  const me           = agents?.[0];
  const myLeads      = useMemo(() => (allLeads ?? []).filter(l => l.assignedTo === me?.id), [allLeads, me]);
  const myConverted  = useMemo(() => myLeads.filter(l => l.status === "closed_won").length, [myLeads]);
  const myPipeline   = useMemo(() => myLeads.filter(l => !["closed_won","closed_lost"].includes(l.status)), [myLeads]);
  const overdueFollowups = useMemo(() => myLeads.filter(l => ["new","contacted"].includes(l.status)).slice(0, 4), [myLeads]);

  const totalCustomers   = myLeads.length;
  const activeCustomers  = useMemo(() => myLeads.filter(l => ["contacted","qualified","proposal","negotiation"].includes(l.status)).length, [myLeads]);
  const notActiveCount   = useMemo(() => myLeads.filter(l => l.status === "closed_lost").length, [myLeads]);
  const activePct        = totalCustomers > 0 ? Math.round((activeCustomers / totalCustomers) * 100) : 0;
  const pendingCustomers = useMemo(() => myLeads.filter(l => l.status === "new").length, [myLeads]);
  const pendingPct       = totalCustomers > 0 ? Math.round((pendingCustomers / totalCustomers) * 100) : 0;

  const targetLeads = 10, targetConv = 4;

  return (
    <div className="space-y-5">
      <QuickLeadDialog open={quickLeadOpen} onClose={() => setQuickLeadOpen(false)} />

      {/* Time-of-day greeting */}
      <div>
        <h2 className="text-lg font-bold text-foreground">{getGreeting(profile.name)}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Here's your activity summary for today.</p>
      </div>

      {/* Quick action banner */}
      <div className="flex items-center justify-between gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <Phone className="w-4 h-4 text-green-700 flex-shrink-0" />
          <p className="text-sm text-green-800 font-medium">Got an inbound call? Log the lead instantly.</p>
        </div>
        <button onClick={() => setQuickLeadOpen(true)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors whitespace-nowrap flex-shrink-0">
          <Plus className="w-3.5 h-3.5" />Quick Add
        </button>
      </div>

      {/* 6-card customer KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard label="Total Customers"   value={String(totalCustomers)}   sub="all assigned leads"   icon={Users}        accent="border-l-indigo-500" />
        <KpiCard label="Active Customers"  value={String(activeCustomers)}  sub="in active stages"     icon={CheckCircle2} accent="border-l-green-500"  />
        <KpiCard label="Not Active"        value={String(notActiveCount)}   sub="closed / lost"        icon={XCircle}      accent="border-l-red-400"    />
        <KpiCard label="Active %"          value={`${activePct}%`}          sub="of total leads"       icon={TrendingUp}   accent="border-l-blue-500"   />
        <KpiCard label="Pending Customers" value={String(pendingCustomers)} sub="fresh — no contact"   icon={Clock}        accent="border-l-amber-500"  />
        <KpiCard label="Pending %"         value={`${pendingPct}%`}         sub="of total leads"       icon={Target}       accent="border-l-orange-500" />
      </div>

      {/* D1–D5 team segment filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Team:</span>
        {TEAM_FILTERS.map(f => (
          <button key={f} onClick={() => setTeamFilter(teamFilter === f ? null : f)}
            className={cn("px-4 py-1.5 text-xs font-bold rounded-full border transition-colors",
              teamFilter === f
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "border-border text-muted-foreground hover:bg-muted/50 hover:border-muted-foreground/30")}>
            {f}
          </button>
        ))}
        {teamFilter && (
          <button onClick={() => setTeamFilter(null)} className="text-xs text-primary hover:underline">× Clear</button>
        )}
      </div>

      {/* Targets */}
      <Card>
        <SectionTitle icon={Target} title="My Monthly Targets" sub={new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {[
            { label: "Leads Assigned", current: myLeads.length, target: targetLeads },
            { label: "Conversions",    current: myConverted,    target: targetConv  },
          ].map(({ label, current, target }) => {
            const pct  = Math.min((current / target) * 100, 100);
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
        <div className="space-y-2">
          {TODAY_VISITS.map((v) => (
            <div key={v.lead} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <p className="text-xs font-bold text-primary whitespace-nowrap flex-shrink-0">{v.time}</p>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{v.lead}</p>
                  <p className="text-xs text-muted-foreground truncate">{v.project} · Unit {v.unit}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", v.confirmed ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700")}>
                  {v.confirmed ? "Confirmed" : "Pending"}
                </span>
                <button className="text-xs px-2.5 py-1 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity">
                  Check In
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Overdue follow-ups */}
      {overdueFollowups.length > 0 && (
        <Card className="border-red-200 bg-red-50/20">
          <SectionTitle icon={AlertTriangle} title="Overdue Follow-ups" sub="These leads need your attention now" />
          <div className="space-y-2">
            {overdueFollowups.map((lead) => (
              <div key={lead.id} className="flex items-center gap-3 p-3 rounded-lg border border-red-100 bg-card">
                <div className="w-7 h-7 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                  {lead.name.split(" ").map((w: string) => w[0]).join("").slice(0,2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{lead.name}</p>
                  <p className="text-xs text-muted-foreground truncate capitalize">{lead.status} · {lead.source}</p>
                </div>
                <Link href={`/leads/${lead.id}`}
                  className="text-xs px-2.5 py-1.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors flex-shrink-0 whitespace-nowrap">
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
          action={<Link href="/leads" className="text-xs text-primary hover:underline flex items-center gap-1 whitespace-nowrap">View all <ChevronRight className="w-3 h-3" /></Link>} />
        {myPipeline.length === 0 ? (
          <div className="py-8 text-center">
            <Users className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No active leads assigned</p>
          </div>
        ) : (
          <ScrollTable minWidth={400}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Lead","Status","Score","Budget"].map(h => (
                    <th key={h} className="text-left pb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider pr-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {myPipeline.slice(0, 8).map((lead) => (
                  <tr key={lead.id} className="hover:bg-muted/20 cursor-pointer" onClick={() => window.location.href = `/leads/${lead.id}`}>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                          {lead.name.split(" ").map((w: string) => w[0]).join("").slice(0,2).toUpperCase()}
                        </div>
                        <p className="font-medium text-foreground text-xs whitespace-nowrap">{lead.name}</p>
                      </div>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className={cn("inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap", {
                        "bg-blue-100 text-blue-700":    lead.status === "new",
                        "bg-purple-100 text-purple-700":lead.status === "contacted",
                        "bg-amber-100 text-amber-700":  lead.status === "qualified",
                        "bg-orange-100 text-orange-700":lead.status === "proposal",
                        "bg-yellow-100 text-yellow-700":lead.status === "negotiation",
                      })}>
                        {stageLabel(lead.status)}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-1">
                        <div className="w-10 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className={cn("h-full rounded-full", lead.score >= 80 ? "bg-green-500" : lead.score >= 60 ? "bg-amber-500" : "bg-red-400")} style={{ width: `${lead.score}%` }} />
                        </div>
                        <span className={cn("text-xs font-bold", scoreColor(lead.score))}>{lead.score}</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-xs font-medium whitespace-nowrap">{lead.budget ? formatCurrency(lead.budget) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
        )}
      </Card>

      {/* Activity */}
      <Card>
        <SectionTitle icon={Activity} title="Team Activity" />
        <ul className="divide-y divide-border">
          {(activity ?? []).slice(0, 5).map((item) => (
            <li key={item.id} className="flex items-start gap-3 py-2.5">
              <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
              <p className="text-xs text-muted-foreground flex-1">
                <span className="font-medium text-foreground">{item.entityName}</span> — {item.description}
                {item.agentName && <span> by <span className="font-medium text-foreground">{item.agentName}</span></span>}
              </p>
              <span className="text-[10px] text-muted-foreground flex-shrink-0 whitespace-nowrap">{timeAgo(item.createdAt)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

type CFOProperty = { name: string; location: string; type: string; investment: number; expectedRevenue: number; status: "active" | "sold" | "pipeline" };
const CFO_PROPERTIES_INIT: CFOProperty[] = [
  { name: "Prestige Lakeside",  location: "Whitefield, Bangalore",   type: "Residential", investment: 4_80_00_000, expectedRevenue: 5_50_00_000, status: "active"   },
  { name: "Godrej Summit",      location: "Hinjewadi, Pune",          type: "Residential", investment: 8_20_00_000, expectedRevenue: 9_50_00_000, status: "active"   },
  { name: "DLF Cybercity",      location: "Sector 54, Gurugram",      type: "Commercial",  investment: 6_50_00_000, expectedRevenue: 10_20_00_000, status: "active"  },
  { name: "Sobha Royal Crest",  location: "Sarjapur Road, Bangalore", type: "Residential", investment: 7_10_00_000, expectedRevenue: 8_80_00_000, status: "pipeline" },
];

/* ─── CFO DASHBOARD ────────────────────────────────────────────────────── */
function CFODashboard() {
  type CFOTab = "cashflow" | "properties";
  const [tab, setTab] = useState<CFOTab>("cashflow");
  const [cfoProps, setCfoProps] = useState<CFOProperty[]>(CFO_PROPERTIES_INIT);
  const [addingProp, setAddingProp] = useState(false);
  const [editingProp, setEditingProp] = useState<CFOProperty | null>(null);
  const [propForm, setPropForm] = useState<Partial<CFOProperty>>({});

  function saveProp() {
    if (!propForm.name || !propForm.investment) return;
    if (editingProp) {
      setCfoProps(prev => prev.map(p => p.name === editingProp.name ? { ...editingProp, ...propForm } as CFOProperty : p));
      setEditingProp(null);
    } else {
      setCfoProps(prev => [...prev, { name: propForm.name!, location: propForm.location ?? "—", type: propForm.type ?? "Residential", investment: Number(propForm.investment), expectedRevenue: Number(propForm.expectedRevenue ?? 0), status: "pipeline" }]);
      setAddingProp(false);
    }
    setPropForm({});
  }

  const CFO_TABS = [
    { id: "cashflow" as CFOTab, label: "Cash Flow", icon: DollarSign },
    { id: "properties" as CFOTab, label: "Properties", icon: Building2 },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-3">
        <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800">
          <span className="font-semibold">CFO View:</span> Full access to financial data entry, cash flow, and property analysis. Use edit buttons to update records.
        </p>
      </div>

      {/* CFO Tab strip */}
      <div className="flex gap-0.5 border-b border-border">
        {CFO_TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn("flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
              tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {tab === "cashflow" && <CashFlowTab editable />}

      {tab === "properties" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Property Portfolio Analysis</h2>
              <p className="text-xs text-muted-foreground">Investment vs expected revenue per property</p>
            </div>
            <button onClick={() => { setPropForm({}); setAddingProp(true); }}
              className="flex items-center gap-1 text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity">
              <Plus className="w-3.5 h-3.5" />Add Property
            </button>
          </div>

          {/* Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-card border border-card-border rounded-xl p-4 border-l-4 border-l-blue-500">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Total Investment</p>
              <p className="text-lg font-bold text-foreground mt-1">{formatCurrency(cfoProps.reduce((s, p) => s + p.investment, 0))}</p>
            </div>
            <div className="bg-card border border-card-border rounded-xl p-4 border-l-4 border-l-green-500">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Expected Revenue</p>
              <p className="text-lg font-bold text-foreground mt-1">{formatCurrency(cfoProps.reduce((s, p) => s + p.expectedRevenue, 0))}</p>
            </div>
            <div className="bg-card border border-card-border rounded-xl p-4 border-l-4 border-l-emerald-500 col-span-2 sm:col-span-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Expected Profit</p>
              <p className="text-lg font-bold text-emerald-600 mt-1">{formatCurrency(cfoProps.reduce((s, p) => s + (p.expectedRevenue - p.investment), 0))}</p>
            </div>
          </div>

          {/* Properties table */}
          <div className="bg-card border border-card-border rounded-xl p-4 sm:p-5">
            <div className="overflow-x-auto -mx-1 px-1">
              <table className="w-full text-sm" style={{ minWidth: 600 }}>
                <thead>
                  <tr className="border-b border-border">
                    {["Property", "Location", "Type", "Investment", "Expected Rev.", "Profit", "ROI", "Status", ""].map(h => (
                      <th key={h} className="text-left pb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider pr-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {cfoProps.map((p) => {
                    const profit = p.expectedRevenue - p.investment;
                    const roi = p.investment > 0 ? ((profit / p.investment) * 100).toFixed(1) : "0";
                    return (
                      <tr key={p.name} className="hover:bg-muted/20">
                        <td className="py-2.5 pr-3 font-medium text-foreground text-xs whitespace-nowrap">{p.name}</td>
                        <td className="py-2.5 pr-3 text-muted-foreground text-xs whitespace-nowrap">{p.location}</td>
                        <td className="py-2.5 pr-3 text-xs">{p.type}</td>
                        <td className="py-2.5 pr-3 text-xs whitespace-nowrap">{formatCurrency(p.investment)}</td>
                        <td className="py-2.5 pr-3 text-xs whitespace-nowrap">{formatCurrency(p.expectedRevenue)}</td>
                        <td className="py-2.5 pr-3 text-emerald-600 font-semibold text-xs whitespace-nowrap">{formatCurrency(profit)}</td>
                        <td className="py-2.5 pr-3">
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-700 whitespace-nowrap">{roi}%</span>
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap",
                            p.status === "active" ? "bg-blue-100 text-blue-700" : p.status === "sold" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700")}>
                            {p.status}
                          </span>
                        </td>
                        <td className="py-2.5">
                          <button onClick={() => { setEditingProp(p); setPropForm({ ...p }); }}
                            className="p-1 rounded hover:bg-blue-50 text-blue-600 transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Property Modal */}
      {(addingProp || editingProp) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-card rounded-xl border border-border shadow-xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">{editingProp ? "Edit Property" : "Add New Property"}</h3>
              <button onClick={() => { setAddingProp(false); setEditingProp(null); setPropForm({}); }} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            {([
              { label: "Property Name *", key: "name", type: "text" },
              { label: "Location", key: "location", type: "text" },
              { label: "Type", key: "type", type: "text", placeholder: "Residential / Commercial" },
              { label: "Investment (₹) *", key: "investment", type: "number" },
              { label: "Expected Revenue (₹)", key: "expectedRevenue", type: "number" },
            ] as const).map(({ label, key, type, placeholder }: { label: string; key: string; type: string; placeholder?: string }) => (
              <div key={key}>
                <label className="text-xs font-medium text-muted-foreground block mb-1">{label}</label>
                <input type={type} placeholder={placeholder ?? ""}
                  value={String((propForm as Record<string, unknown>)[key] ?? "")}
                  onChange={e => setPropForm(p => ({ ...p, [key]: type === "number" ? Number(e.target.value) : e.target.value }))}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            ))}
            {editingProp && (
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Status</label>
                <select value={propForm.status ?? editingProp.status}
                  onChange={e => setPropForm(p => ({ ...p, status: e.target.value as CFOProperty["status"] }))}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="active">Active</option>
                  <option value="sold">Sold</option>
                  <option value="pipeline">Pipeline</option>
                </select>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={saveProp} className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
                {editingProp ? "Save" : "Add"}
              </button>
              <button onClick={() => { setAddingProp(false); setEditingProp(null); setPropForm({}); }} className="flex-1 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted/50 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const BROKER_PERF = [
  { name: "Vijay Broker",   leads: 14, sold: 5, pending: 9, commission: 3_80_000, lastActivity: "2d ago" },
  { name: "Anita Kapoor",   leads: 9,  sold: 3, pending: 6, commission: 2_20_000, lastActivity: "1d ago" },
  { name: "Suresh Reddy",   leads: 6,  sold: 2, pending: 4, commission: 1_50_000, lastActivity: "4d ago" },
];

/* ─── BROKER DASHBOARD ────────────────────────────────────────────────── */
function BrokerDashboard({ activity }: { activity: ActivityItem[] | undefined }) {
  const [quickLeadOpen, setQuickLeadOpen] = useState(false);
  const { data: allLeads } = useGetLeads({}, { query: { queryKey: getGetLeadsQueryKey({}) } });
  const brokerLeads = useMemo(() => (allLeads ?? []).filter(l => l.source === "referral" || l.source === "phone"), [allLeads]);
  const brokerConverted = brokerLeads.filter(l => l.status === "closed_won").length;
  const brokerPipeline = brokerLeads.filter(l => !["closed_won","closed_lost"].includes(l.status)).length;

  return (
    <div className="space-y-5">
      <QuickLeadDialog open={quickLeadOpen} onClose={() => setQuickLeadOpen(false)} />

      {/* Banner */}
      <div className="flex items-center justify-between gap-3 bg-teal-50 border border-teal-200 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <HandCoins className="w-4 h-4 text-teal-700 flex-shrink-0" />
          <p className="text-sm text-teal-800 font-medium">Found a client? Add them as a lead or report a property sold.</p>
        </div>
        <button onClick={() => setQuickLeadOpen(true)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 transition-colors whitespace-nowrap flex-shrink-0">
          <Plus className="w-3.5 h-3.5" />Add Lead
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="My Leads"    value={String(brokerLeads.length)} sub="added via referral/phone" icon={Users}       accent="border-l-teal-500"   />
        <KpiCard label="Sold"        value={String(brokerConverted)}    sub="closed won"               icon={CheckCircle2} accent="border-l-green-500" trend="+2" up />
        <KpiCard label="In Pipeline" value={String(brokerPipeline)}     sub="active deals"             icon={GitBranch}   accent="border-l-amber-500"  />
        <KpiCard label="Commission"  value={formatCurrency(brokerConverted * 1_90_000)} sub="est. earned" icon={HandCoins} accent="border-l-purple-500" />
      </div>

      {/* Broker performance table */}
      <Card>
        <SectionTitle icon={BarChart2} title="Broker Performance" sub="All registered brokers — leads sourced and deals closed" />
        <ScrollTable minWidth={520}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Broker","Leads Added","Sold","Pipeline","Est. Commission","Last Active"].map(h => (
                  <th key={h} className="text-left pb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider pr-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {BROKER_PERF.map((b) => (
                <tr key={b.name} className="hover:bg-muted/20">
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                        {b.name.split(" ").map(w=>w[0]).join("")}
                      </div>
                      <span className="font-medium text-foreground text-xs whitespace-nowrap">{b.name}</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 text-sm">{b.leads}</td>
                  <td className="py-2.5 pr-3 text-green-600 font-semibold text-sm">{b.sold}</td>
                  <td className="py-2.5 pr-3 text-amber-600 text-sm">{b.pending}</td>
                  <td className="py-2.5 pr-3 font-semibold text-xs whitespace-nowrap">{formatCurrency(b.commission)}</td>
                  <td className="py-2.5 text-muted-foreground text-xs whitespace-nowrap">{b.lastActivity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
      </Card>

      {/* Active leads */}
      <Card>
        <SectionTitle icon={GitBranch} title="My Active Pipeline" sub="Leads in progress"
          action={<Link href="/leads" className="text-xs text-primary hover:underline flex items-center gap-1 whitespace-nowrap">View all <ChevronRight className="w-3 h-3" /></Link>} />
        {brokerPipeline === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">No active leads yet. Add a lead to get started.</div>
        ) : (
          <ScrollTable minWidth={380}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Lead","Status","Budget"].map(h => (
                    <th key={h} className="text-left pb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider pr-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {brokerLeads.filter(l => !["closed_won","closed_lost"].includes(l.status)).slice(0, 8).map(lead => (
                  <tr key={lead.id} className="hover:bg-muted/20 cursor-pointer" onClick={() => window.location.href = `/leads/${lead.id}`}>
                    <td className="py-2.5 pr-3 font-medium text-foreground text-xs whitespace-nowrap">{lead.name}</td>
                    <td className="py-2.5 pr-3">
                      <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", statusColor(lead.status))}>
                        {stageLabel(lead.status)}
                      </span>
                    </td>
                    <td className="py-2.5 text-xs font-medium whitespace-nowrap">{lead.budget ? formatCurrency(lead.budget) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
        )}
      </Card>
    </div>
  );
}

/* ─── PAGE ROOT ────────────────────────────────────────────────────────── */
type OwnerTab = "inventory" | "cashflow" | "leads" | "analysis";

const OWNER_TABS: { id: OwnerTab; label: string; shortLabel: string; icon: React.ElementType }[] = [
  { id: "inventory", label: "Inventory",      shortLabel: "Inventory", icon: Layers    },
  { id: "cashflow",  label: "Cash Flow",       shortLabel: "Cash Flow", icon: DollarSign },
  { id: "leads",     label: "Lead Management", shortLabel: "Leads",     icon: Users     },
  { id: "analysis",  label: "Analysis",        shortLabel: "Analysis",  icon: BarChart3 },
];

export default function DashboardPage() {
  const { role, profile } = useRole();
  const [tab, setTab]     = useState<OwnerTab>("inventory");

  const { data: stats }    = useGetDashboardStats();
  const { data: pipeline } = useGetDashboardPipeline();
  const { data: activity } = useGetRecentActivity();
  const { data: sources }  = useGetLeadSources();

  const isOwnerOrManager = role === "owner" || role === "manager";
  const isCFO            = role === "cfo";
  const isEmployee       = role === "sales";
  const isBroker         = role === "broker";

  const headerTitle = isOwnerOrManager ? "Owner & Manager Dashboard"
    : isCFO ? "Finance Dashboard"
    : isBroker ? "Broker Dashboard"
    : "My Dashboard";

  const headerSub = isOwnerOrManager ? "Full business view — inventory, finances, leads, and team performance"
    : isCFO ? "Financial data, cash flow, and property analysis"
    : isBroker ? "Your leads, deals, broker performance, and commission tracker"
    : "Your personal pipeline, targets, and follow-ups";

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-tight">{headerTitle}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{headerSub}</p>
        </div>
        <div className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-semibold text-white flex-shrink-0 whitespace-nowrap", profile.color)}>
          <ShieldCheck className="w-3 h-3" />
          <span className="hidden sm:inline">{profile.label}</span>
          <span className="sm:hidden">{profile.label.split(" ")[0]}</span>
        </div>
      </div>

      {/* Owner/Manager tab strip */}
      {isOwnerOrManager && (
        <div className="overflow-x-auto scrollbar-hide -mx-1 px-1 scroll-touch">
          <div className="flex gap-0.5 border-b border-border min-w-max">
            {OWNER_TABS.map(({ id, label, shortLabel, icon: Icon }) => (
              <button key={id} onClick={() => setTab(id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
                  tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="sm:hidden">{shortLabel}</span>
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Today's Focus — real-time site visits, overdue leads, hot leads (all roles except CFO) */}
      {!isCFO && <TodaysFocusWidget />}

      {/* Content */}
      {isOwnerOrManager && tab === "inventory" && <InventoryTab />}
      {isOwnerOrManager && tab === "cashflow"  && <CashFlowTab />}
      {isOwnerOrManager && tab === "leads"     && <LeadManagementTab stats={stats} sources={sources} pipeline={pipeline} activity={activity} />}
      {isOwnerOrManager && tab === "analysis"  && <AnalysisTab />}
      {isCFO      && <CFODashboard />}
      {isEmployee && <EmployeeDashboard activity={activity} />}
      {isBroker   && <BrokerDashboard activity={activity} />}
    </div>
  );
}
