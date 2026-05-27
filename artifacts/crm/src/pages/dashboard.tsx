import { useState, useMemo } from "react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import {
  useGetDashboardStats, useGetDashboardPipeline, useGetRecentActivity,
  useGetLeadSources, useGetLeads, useGetAgents, getGetLeadsQueryKey,
  useCreateLead, customFetch,
} from "@workspace/api-client-react";
import type { DashboardStats, LeadSource, PipelineStage, ActivityItem } from "@workspace/api-client-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Building2, Users, TrendingUp, GitBranch, Activity, ArrowUpRight, ArrowDownRight,
  AlertTriangle, CheckCircle2, Clock, Target, DollarSign, BarChart3, Layers,
  UserCheck, ChevronRight, Home, ShieldCheck, Zap, XCircle, TrendingDown, Calendar,
  Pencil, Plus, Phone, X, HandCoins, BarChart2, Flame,
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

/* KPI card — Koshpal-style: icon circle top-left, value prominent, no border accent */
const ACCENT_MAP: Record<string, { bg: string; text: string }> = {
  "border-l-blue-500":    { bg: "bg-blue-50",    text: "text-blue-600" },
  "border-l-green-500":   { bg: "bg-green-50",   text: "text-green-600" },
  "border-l-amber-500":   { bg: "bg-amber-50",   text: "text-amber-600" },
  "border-l-red-400":     { bg: "bg-red-50",     text: "text-red-500" },
  "border-l-red-500":     { bg: "bg-red-50",     text: "text-red-600" },
  "border-l-purple-500":  { bg: "bg-purple-50",  text: "text-purple-600" },
  "border-l-emerald-500": { bg: "bg-emerald-50", text: "text-emerald-600" },
  "border-l-indigo-500":  { bg: "bg-indigo-50",  text: "text-indigo-600" },
  "border-l-teal-500":    { bg: "bg-teal-50",    text: "text-teal-600" },
  "border-l-orange-500":  { bg: "bg-orange-50",  text: "text-orange-600" },
};

function KpiCard({ label, value, sub, icon: Icon, accent, trend, up }: {
  label: string; value: string; sub?: string; icon: React.ElementType;
  accent?: string; trend?: string; up?: boolean;
}) {
  const { bg: iconBg, text: iconText } = ACCENT_MAP[accent ?? ""] ?? { bg: "bg-primary/10", text: "text-primary" };
  return (
    <Card className="hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", iconBg)}>
          <Icon className={cn("w-5 h-5", iconText)} />
        </div>
        {trend && (
          <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0",
            up ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600")}>
            {up ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}{trend}
          </span>
        )}
      </div>
      <p className="text-[10px] sm:text-[11px] text-muted-foreground font-semibold uppercase tracking-wider truncate">{label}</p>
      <p className="text-xl sm:text-2xl font-bold text-foreground leading-none mt-1">{value}</p>
      {sub && <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">{sub}</p>}
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



const COLORS = ["#f59e0b", "#1e3a5f", "#10b981", "#8b5cf6", "#ef4444", "#3b82f6", "#f97316", "#06b6d4"];

/* ─── TODAY'S FOCUS ───────────────────────────────────────────────────── */
type TodayData = {
  todayViewings: { id: number; time: string; status: string; agentId: number | null; leadName: string | null; propertyTitle: string | null; agentName: string | null }[];
  overdueLeads:  { id: number; name: string; phone: string | null; source: string; createdAt: string }[];
  hotLeads:      { id: number; name: string; phone: string | null; source: string; score: number; status: string; budget: number | null }[];
};

function TodaysFocusWidget() {
  const { token } = useAuth();
  const { data, isLoading, isError } = useQuery<TodayData>({
    queryKey: ["dashboard-today"],
    queryFn: async () => {
      const r = await fetch("/api/dashboard/today", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    enabled: !!token,
    refetchInterval: 60_000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
      </div>
    );
  }
  if (isError || !data) return null;

  const todayViewings = data.todayViewings ?? [];
  const overdueLeads  = data.overdueLeads  ?? [];
  const hotLeads      = data.hotLeads      ?? [];

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
type InventoryProperty = {
  id: number; title: string; city: string; type: string; status: string; price: number;
  totalUnits: number; available: number; sold: number; booked: number; blocked: number;
};
type BlockedUnitDetail = {
  id: number; unitNo: string; propertyId: number | null; propertyTitle: string | null;
  buyerName: string | null; daysBlocked: number;
};

function InventoryTab() {
  const { token } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: invData, isLoading } = useQuery<{ properties: InventoryProperty[]; blockedUnits: BlockedUnitDetail[] }>({
    queryKey: ["dashboard-inventory"],
    queryFn: async () => {
      const r = await fetch("/api/dashboard/inventory", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    enabled: !!token,
    refetchInterval: 60_000,
  });

  const projects = invData?.properties ?? [];
  const blockedUnits = invData?.blockedUnits ?? [];

  const totalUnits = projects.reduce((s, p) => s + p.totalUnits, 0);
  const totalSold  = projects.reduce((s, p) => s + p.sold, 0);
  const totalAvail = projects.reduce((s, p) => s + p.available, 0);
  const totalBlocked = projects.reduce((s, p) => s + p.blocked + p.booked, 0);

  async function approveUnit(unit: BlockedUnitDetail) {
    try {
      const r = await fetch(`/api/units/${unit.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: "booked" }),
      });
      if (!r.ok) throw new Error();
      qc.invalidateQueries({ queryKey: ["dashboard-inventory"] });
      toast({ title: `Unit ${unit.unitNo} approved`, description: "Booking confirmed and moved to active pipeline." });
    } catch {
      toast({ title: "Failed to approve unit", variant: "destructive" });
    }
  }
  async function releaseUnit(unit: BlockedUnitDetail) {
    try {
      const r = await fetch(`/api/units/${unit.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: "available" }),
      });
      if (!r.ok) throw new Error();
      qc.invalidateQueries({ queryKey: ["dashboard-inventory"] });
      toast({ title: `Unit ${unit.unitNo} released`, description: "Unit is now available for re-booking.", variant: "destructive" });
    } catch {
      toast({ title: "Failed to release unit", variant: "destructive" });
    }
  }

  if (isLoading) return <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}</div>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total Units"  value={String(totalUnits)} sub="across all properties" icon={Layers}        accent="border-l-blue-500"   />
        <KpiCard label="Sold"         value={String(totalSold)}  sub={totalUnits > 0 ? `${Math.round(totalSold/totalUnits*100)}% sell-through` : "—"} icon={CheckCircle2} accent="border-l-green-500" />
        <KpiCard label="Available"    value={String(totalAvail)} sub="ready to book"          icon={Home}          accent="border-l-amber-500"  />
        <KpiCard label="Blocked/Booked" value={String(totalBlocked)} sub="pending conversion" icon={AlertTriangle} accent="border-l-red-500"    />
      </div>

      {/* Blocked Units Alert */}
      {blockedUnits.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/40 !p-4">
          <SectionTitle icon={AlertTriangle} title="Blocked Units Alert" sub={`${blockedUnits.length} unit${blockedUnits.length !== 1 ? "s" : ""} awaiting approval`} />
          <div className="space-y-2">
            {blockedUnits.map((u) => (
              <div key={u.unitNo} className="flex flex-col sm:flex-row sm:items-center gap-3 bg-card rounded-lg px-3 py-3 border border-amber-100">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold flex-shrink-0">{u.daysBlocked}d</div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{u.unitNo} · {u.propertyTitle ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {u.buyerName ? <>For <span className="font-medium text-foreground">{u.buyerName}</span></> : "No buyer linked"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0 sm:ml-auto">
                  <button onClick={() => approveUnit(u)} className="flex-1 sm:flex-none text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors">Approve</button>
                  <button onClick={() => releaseUnit(u)} className="flex-1 sm:flex-none text-xs px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg font-medium hover:bg-red-100 transition-colors">Release</button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Property cards */}
      {projects.length === 0 ? (
        <Card><p className="text-sm text-muted-foreground text-center py-8">No properties found. Add properties to see inventory.</p></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {projects.map((p) => {
            const sellPct = p.totalUnits > 0 ? Math.round((p.sold / p.totalUnits) * 100) : 0;
            const statusCls = p.status === "available" ? "bg-green-100 text-green-700"
              : p.status === "sold" ? "bg-slate-100 text-slate-600"
              : p.status === "under_offer" ? "bg-blue-100 text-blue-700"
              : "bg-red-100 text-red-700";
            return (
              <Card key={p.id} className="hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground text-sm truncate">{p.title}</h3>
                    <p className="text-xs text-muted-foreground truncate">{p.city} · {p.type}</p>
                  </div>
                  <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0", statusCls)}>
                    {p.status.replace(/_/g, " ")}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 mb-3">
                  {[["Sold", p.sold, "text-green-600"], ["Available", p.available, "text-amber-600"], ["Booked", p.booked, "text-blue-600"], ["Blocked", p.blocked, "text-red-500"]].map(([l, v, cls]) => (
                    <div key={String(l)} className="text-center bg-muted/30 rounded-lg p-2">
                      <p className={cn("text-base sm:text-lg font-bold", String(cls))}>{v}</p>
                      <p className="text-[10px] text-muted-foreground">{l}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                    <span>Sell-through</span>
                    <span className="font-semibold text-foreground">{sellPct}% · {p.sold}/{p.totalUnits}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${sellPct}%` }} />
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-[10px] sm:text-xs text-muted-foreground border-t border-border pt-3">
                  <span>{p.totalUnits} total units</span>
                  <span className="font-semibold text-foreground">{formatCurrency(p.price)}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

type ProjectFinancial = { project: string; propertyId: number; invested: number; collected: number; outstanding: number; expectedRevenue: number; margin: number };

/* ─── CASH FLOW ───────────────────────────────────────────────────────── */
function CashFlowTab({ editable = false }: { editable?: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [priceAdj, setPriceAdj] = useState(0);
  const [costAdj, setCostAdj] = useState(0);

  const { data: dbProjects } = useQuery<ProjectFinancial[]>({
    queryKey: ["project-financials"],
    queryFn: () => customFetch<any[]>("/api/project-financials").then(rows =>
      rows.map(r => ({
        project: r.projectName,
        propertyId: r.propertyId,
        invested: Number(r.totalInvested),
        collected: Number(r.totalCollected),
        outstanding: Number(r.totalOutstanding),
        expectedRevenue: Number(r.expectedRevenue),
        margin: Number(r.margin),
      }))
    ),
  });

  const projects: ProjectFinancial[] = dbProjects ?? [];

  const [editingProject, setEditingProject] = useState<ProjectFinancial | null>(null);
  const [editProj, setEditProj] = useState<Partial<ProjectFinancial>>({});

  const saveProjectMutation = useMutation({
    mutationFn: ({ propertyId, data }: { propertyId: number; data: Partial<ProjectFinancial> }) =>
      customFetch(`/api/project-financials/${propertyId}`, {
        method: "PUT",
        body: JSON.stringify({
          projectName: data.project,
          totalInvested: data.invested,
          totalCollected: data.collected,
          totalOutstanding: data.outstanding,
          expectedRevenue: data.expectedRevenue,
          margin: data.margin,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-financials"] });
      toast({ title: "Project financials saved ✓" });
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  function saveEditProject() {
    if (!editingProject) return;
    const merged = { ...editingProject, ...editProj } as ProjectFinancial;
    if (!merged.propertyId) return;
    saveProjectMutation.mutate({ propertyId: merged.propertyId, data: merged });
    setEditingProject(null); setEditProj({});
  }

  const totals = useMemo(() => ({
    invested:    projects.reduce((s, c) => s + c.invested, 0),
    collected:   projects.reduce((s, c) => s + c.collected, 0),
    outstanding: projects.reduce((s, c) => s + c.outstanding, 0),
    expected:    projects.reduce((s, c) => s + c.expectedRevenue, 0),
    avgMargin:   projects.length > 0 ? projects.reduce((s, c) => s + c.margin, 0) / projects.length : 0,
  }), [projects]);

  const baseProfit     = totals.expected - totals.invested;
  const scenarioProfit = (totals.expected * (1 + priceAdj / 100)) - (totals.invested * (1 + costAdj / 100));
  const profitDelta    = scenarioProfit - baseProfit;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total Invested"   value={formatCurrency(totals.invested)}    sub="across all projects" icon={DollarSign}    accent="border-l-blue-500"    />
        <KpiCard label="Collected"        value={formatCurrency(totals.collected)}   sub={totals.invested > 0 ? `${Math.round(totals.collected/totals.invested*100)}% of invested` : "—"} icon={TrendingUp} accent="border-l-green-500" />
        <KpiCard label="Outstanding"      value={formatCurrency(totals.outstanding)} sub="yet to collect"      icon={Clock}         accent="border-l-amber-500"   />
        <KpiCard label="Avg Margin"       value={`${totals.avgMargin.toFixed(1)}%`}  sub="blended profit"      icon={Target}        accent="border-l-emerald-500" />
      </div>

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

type LostReason = { reason: string; count: number; pct: number; color: string };

/* ─── LOST LEAD ANALYSIS CARD (shared between tabs) ─────────────────────── */
function LostLeadAnalysisCard() {
  const { token } = useAuth();
  const { data: lostReasons = [] } = useQuery<LostReason[]>({
    queryKey: ["dashboard-lost-reasons"],
    queryFn: async () => {
      const r = await fetch("/api/dashboard/lost-reasons", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    enabled: !!token,
    refetchInterval: 120_000,
  });

  const topReason = lostReasons[0];

  return (
    <Card>
      <SectionTitle icon={XCircle} title="Lost Lead Analysis" sub="Why are leads not converting?" />
      {lostReasons.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No lost lead data yet — reasons are captured when leads are marked lost.
        </p>
      ) : (
        <>
          <div className="space-y-2.5">
            {lostReasons.map((r) => (
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
          {topReason && (
            <p className="mt-4 text-xs text-muted-foreground flex items-start gap-1">
              <Zap className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
              {topReason.pct}% lost to "{topReason.reason}" — consider addressing this as a priority.
            </p>
          )}
        </>
      )}
    </Card>
  );
}

/* ─── LEAD MANAGEMENT ─────────────────────────────────────────────────── */
type AdSpendRecord = { id: number; channel: string; month: number; year: number; spend: number; leadsGenerated: number; cpl: number | null };

function LeadManagementTab({ stats, sources, pipeline, activity }: {
  stats: DashboardStats | undefined;
  sources: LeadSource[] | undefined;
  pipeline: PipelineStage[] | undefined;
  activity: ActivityItem[] | undefined;
}) {
  const { token } = useAuth();
  const { data: allLeads } = useGetLeads({}, { query: { queryKey: getGetLeadsQueryKey({}) } });
  const leadList = allLeads ?? [];
  const stageOrder = ["new","contacted","qualified","proposal","negotiation","closed_won","closed_lost"];
  const stageCounts = useMemo(() => stageOrder.map(s => ({ stage: s, count: leadList.filter(l => l.status === s).length })), [leadList]);
  const funnelMax  = useMemo(() => Math.max(...stageCounts.map(s => s.count), 1), [stageCounts]);
  const sourceTotal = (sources ?? []).reduce((s, x) => s + x.count, 0);
  const staleLeads  = leadList.filter(l => ["new","contacted"].includes(l.status)).slice(0, 5);

  const { data: adSpend = [] } = useQuery<AdSpendRecord[]>({
    queryKey: ["ad-spend"],
    queryFn: async () => {
      const r = await fetch("/api/ad-spend", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    enabled: !!token,
    refetchInterval: 300_000,
  });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total Leads"    value={String(stats?.totalLeads ?? 0)}     sub={`+${stats?.newLeadsThisMonth ?? 0} this month`} icon={Users}       accent="border-l-blue-500"   />
        <KpiCard label="Converted"      value={String(leadList.filter(l=>l.status==="closed_won").length)} sub="became customers" icon={UserCheck} accent="border-l-green-500" />
        <KpiCard label="In Progress"    value={String(leadList.filter(l=>!["closed_won","closed_lost"].includes(l.status)).length)} sub="active pipeline" icon={GitBranch} accent="border-l-amber-500" />
        <KpiCard label="Conv. Rate"     value={`${stats?.conversionRate ?? 0}%`}   sub="lead → closed won" icon={Target}      accent="border-l-purple-500" />
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
        <SectionTitle icon={DollarSign} title="Cost Per Lead by Channel"
          sub="Enter monthly ad spend below to compute real CPL"
          action={<span className="text-xs text-muted-foreground">Owner can edit spend in Settings</span>}
        />
        {adSpend.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm text-muted-foreground">No ad spend data yet. Add monthly spend per channel to compute real CPL.</p>
          </div>
        ) : (
          <ScrollTable minWidth={460}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Channel", "Month", "Ad Spend", "Leads", "CPL"].map(h => (
                    <th key={h} className="text-left pb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider pr-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {adSpend.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/20">
                    <td className="py-2.5 pr-3 font-medium text-foreground text-sm capitalize">{s.channel}</td>
                    <td className="py-2.5 pr-3 text-muted-foreground text-xs">{new Date(s.year, s.month - 1).toLocaleString("en-IN", { month: "short", year: "2-digit" })}</td>
                    <td className="py-2.5 pr-3 text-muted-foreground text-xs whitespace-nowrap">₹{(s.spend/1000).toFixed(0)}k</td>
                    <td className="py-2.5 pr-3 text-sm">{s.leadsGenerated}</td>
                    <td className="py-2.5 font-medium text-sm whitespace-nowrap">
                      {s.cpl != null ? `₹${(s.cpl/1000).toFixed(1)}k` : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
        )}
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
      <LostLeadAnalysisCard />

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
type AgentPerf = {
  id: number; name: string; email: string; role: string;
  leadsThisMonth: number; bookingsThisMonth: number; revenueThisMonth: number; visitsThisMonth: number;
};
type LocationRoi = { location: string; deals: number; avgROI: number };

function AnalysisTab() {
  const { token } = useAuth();

  const { data: agentPerf = [] } = useQuery<AgentPerf[]>({
    queryKey: ["dashboard-agents-performance"],
    queryFn: async () => {
      const r = await fetch("/api/dashboard/agents-performance", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    enabled: !!token,
    refetchInterval: 60_000,
  });

  const { data: lostReasons = [] } = useQuery<LostReason[]>({
    queryKey: ["dashboard-lost-reasons"],
    queryFn: async () => {
      const r = await fetch("/api/dashboard/lost-reasons", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    enabled: !!token,
    refetchInterval: 120_000,
  });

  const { data: locationRoi = [] } = useQuery<LocationRoi[]>({
    queryKey: ["dashboard-location-roi"],
    queryFn: async () => {
      const r = await fetch("/api/dashboard/location-roi", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    enabled: !!token,
    refetchInterval: 120_000,
  });

  type DemandIntelligence = {
    bhkDemand: { type: string; count: number }[];
    budgetDemand: { range: string; count: number }[];
    topObjections: { reason: string; count: number }[];
    totalActiveLeads: number;
  };
  const { data: demandData } = useQuery<DemandIntelligence>({
    queryKey: ["dashboard-demand-intelligence"],
    queryFn: async () => {
      const r = await fetch("/api/dashboard/demand-intelligence", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    enabled: !!token,
    refetchInterval: 120_000,
  });

  type VisitConversion = {
    totalVisitsScheduled: number; completedVisits: number; bookingsFromVisits: number;
    conversionRate: number;
    byAgent: { agentId: number; agentName: string; visits: number; completed: number; conversionRate: number }[];
  };
  const { data: visitConv } = useQuery<VisitConversion>({
    queryKey: ["dashboard-visit-conversion"],
    queryFn: async () => {
      const r = await fetch("/api/dashboard/visit-conversion", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    enabled: !!token,
    refetchInterval: 120_000,
  });

  const TARGET_BOOKINGS = 4;

  return (
    <div className="space-y-5">
      <Card>
        <SectionTitle icon={UserCheck} title="Sales Team Performance" sub={`This month — leads assigned, bookings, and revenue`} />
        {agentPerf.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No agent data for this month yet.</p>
        ) : (
          <ScrollTable minWidth={580}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Team Member","Role","Leads","Bookings","Revenue","Site Visits","vs Target"].map(h => (
                    <th key={h} className="text-left pb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider pr-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {agentPerf.map((e) => {
                  const delta = e.bookingsThisMonth - TARGET_BOOKINGS;
                  const rate = e.leadsThisMonth > 0 ? Math.round((e.bookingsThisMonth / e.leadsThisMonth) * 100) : 0;
                  return (
                    <tr key={e.id} className="hover:bg-muted/20">
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                            {e.name.split(" ").map(w=>w[0]).join("")}
                          </div>
                          <p className="font-medium text-foreground text-xs whitespace-nowrap">{e.name}</p>
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 text-[10px] text-muted-foreground capitalize whitespace-nowrap">{e.role}</td>
                      <td className="py-2.5 pr-3 text-sm">{e.leadsThisMonth}</td>
                      <td className="py-2.5 pr-3">
                        <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap",
                          rate >= 35 ? "bg-green-100 text-green-700" : rate >= 20 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700")}>
                          {e.bookingsThisMonth} ({rate}%)
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 font-semibold text-xs whitespace-nowrap">{formatCurrency(e.revenueThisMonth)}</td>
                      <td className="py-2.5 pr-3 text-muted-foreground text-sm">{e.visitsThisMonth}</td>
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
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <SectionTitle icon={XCircle} title="Lost Lead Reasons" sub="Top reasons deals don't close" />
          {lostReasons.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No lost lead data yet — reasons are captured when leads are marked lost.</p>
          ) : (
            <div className="space-y-3">
              {lostReasons.map((r) => (
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
          )}
        </Card>

        <Card>
          <SectionTitle icon={Building2} title="Growth by Location" sub="Deal activity and ROI by city (closed won)" />
          {locationRoi.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No closed deals with linked properties yet.</p>
          ) : (
            <div className="space-y-2.5">
              {locationRoi.map((l, i) => (
                <div key={l.location} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: COLORS[i] }}>
                    {l.location.slice(0,2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{l.location}</p>
                    <p className="text-xs text-muted-foreground">{l.deals} deal{l.deals !== 1 ? "s" : ""} · {l.avgROI}% ROI</p>
                  </div>
                  <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap",
                    l.avgROI > 0 ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50")}>
                    {l.avgROI >= 0 ? "+" : ""}{l.avgROI}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Demand Intelligence */}
      {demandData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card>
            <SectionTitle icon={BarChart3} title="BHK Demand" sub={`From ${demandData.totalActiveLeads} active leads`} />
            {demandData.bhkDemand.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No property type data yet.</p>
            ) : (
              <div className="space-y-2.5">
                {demandData.bhkDemand.map((d, i) => {
                  const maxCount = demandData.bhkDemand[0].count;
                  const pct = maxCount > 0 ? Math.round((d.count / maxCount) * 100) : 0;
                  return (
                    <div key={d.type}>
                      <div className="flex justify-between mb-1 text-xs">
                        <span className="font-medium text-foreground">{d.type}</span>
                        <span className="text-muted-foreground">{d.count} leads</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
          <Card>
            <SectionTitle icon={DollarSign} title="Budget Distribution" sub="Active leads by budget range" />
            {demandData.budgetDemand.every(b => b.count === 0) ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No budget data recorded yet.</p>
            ) : (
              <div className="space-y-2.5">
                {demandData.budgetDemand.filter(b => b.count > 0).map((b, i) => {
                  const maxCount = Math.max(...demandData.budgetDemand.map(x => x.count));
                  const pct = maxCount > 0 ? Math.round((b.count / maxCount) * 100) : 0;
                  return (
                    <div key={b.range}>
                      <div className="flex justify-between mb-1 text-xs">
                        <span className="font-medium text-foreground">{b.range}</span>
                        <span className="text-muted-foreground">{b.count} leads</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: COLORS[(i + 2) % COLORS.length] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
          <Card>
            <SectionTitle icon={XCircle} title="Top Objections" sub="Why leads go cold" />
            {demandData.topObjections.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No objection data yet — captures from lost leads.</p>
            ) : (
              <div className="space-y-2">
                {demandData.topObjections.map((o, i) => (
                  <div key={o.reason} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                    <span className="flex-1 text-xs text-foreground">{o.reason}</span>
                    <span className="text-xs font-semibold text-foreground">{o.count}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Visit → Booking Conversion */}
      {visitConv && (
        <Card>
          <SectionTitle icon={TrendingUp} title="Site Visit → Booking Conversion" sub="Last 30 days — the most important metric in real estate sales" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            {[
              { label: "Visits Scheduled", value: visitConv.totalVisitsScheduled, cls: "text-blue-600" },
              { label: "Completed", value: visitConv.completedVisits, cls: "text-amber-600" },
              { label: "Bookings", value: visitConv.bookingsFromVisits, cls: "text-green-600" },
              { label: "Conversion Rate", value: `${visitConv.conversionRate}%`, cls: visitConv.conversionRate >= 30 ? "text-green-600" : visitConv.conversionRate >= 15 ? "text-amber-600" : "text-red-600" },
            ].map(({ label, value, cls }) => (
              <div key={label} className="bg-muted/30 rounded-lg p-3 text-center">
                <p className={cn("text-2xl font-bold", cls)}>{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          {visitConv.conversionRate < 15 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-xs text-red-700">
              <strong>Below target:</strong> Conversion rate under 15% signals follow-up gaps or property-lead mismatches. Review agent follow-up speed post-visit.
            </div>
          )}
          {visitConv.byAgent.length > 0 && (
            <ScrollTable minWidth={420}>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-[10px] font-semibold text-muted-foreground uppercase">
                  <th className="text-left pb-2">Agent</th><th className="text-left pb-2">Visits</th><th className="text-left pb-2">Completed</th><th className="text-left pb-2">Rate</th>
                </tr></thead>
                <tbody className="divide-y divide-border">
                  {visitConv.byAgent.map(a => (
                    <tr key={a.agentId} className="hover:bg-muted/20">
                      <td className="py-2 text-sm font-medium">{a.agentName}</td>
                      <td className="py-2 text-sm">{a.visits}</td>
                      <td className="py-2 text-sm">{a.completed}</td>
                      <td className="py-2"><span className={cn("text-xs font-semibold px-1.5 py-0.5 rounded", a.conversionRate >= 30 ? "bg-green-100 text-green-700" : a.conversionRate >= 15 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700")}>{a.conversionRate}%</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollTable>
          )}
        </Card>
      )}
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
function getGreeting(name: string) {
  const h = new Date().getHours();
  const tod = h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening";
  return `Good ${tod}, ${name.split(" ")[0]}!`;
}

function EmployeeDashboard({ activity }: {
  activity: ActivityItem[] | undefined;
}) {
  const [quickLeadOpen, setQuickLeadOpen] = useState(false);
  const { profile } = useRole();
  const { user, token } = useAuth();
  const { data: allLeads } = useGetLeads({}, { query: { queryKey: getGetLeadsQueryKey({}) } });

  const myAgentId = user?.agentId ?? null;
  const myLeads   = useMemo(() => (allLeads ?? []).filter(l => l.assignedTo === myAgentId), [allLeads, myAgentId]);

  const { data: todayData } = useQuery<TodayData>({
    queryKey: ["dashboard-today"],
    queryFn: async () => {
      const r = await fetch("/api/dashboard/today", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    enabled: !!token,
    refetchInterval: 60_000,
    retry: 1,
  });
  const myTodayVisits = useMemo(
    () => (todayData?.todayViewings ?? []).filter(v => myAgentId == null || v.agentId === myAgentId),
    [todayData, myAgentId],
  );
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
        {myTodayVisits.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No site visits scheduled for today.</p>
        ) : (
          <div className="space-y-2">
            {myTodayVisits.map((v) => (
              <div key={v.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <p className="text-xs font-bold text-primary whitespace-nowrap flex-shrink-0">{v.time}</p>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{v.leadName ?? "—"}</p>
                    <p className="text-xs text-muted-foreground truncate">{v.propertyTitle ?? "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full",
                    v.status === "confirmed" ? "bg-green-100 text-green-700"
                    : v.status === "completed" ? "bg-blue-100 text-blue-700"
                    : "bg-amber-100 text-amber-700")}>
                    {v.status.charAt(0).toUpperCase() + v.status.slice(1)}
                  </span>
                </div>
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

/* ─── BROKER DASHBOARD ────────────────────────────────────────────────── */
function BrokerDashboard({ activity }: { activity: ActivityItem[] | undefined }) {
  const [quickLeadOpen, setQuickLeadOpen] = useState(false);
  const { token } = useAuth();
  const { data: allLeads } = useGetLeads({}, { query: { queryKey: getGetLeadsQueryKey({}) } });
  const { data: brokerPerf = [] } = useQuery<AgentPerf[]>({
    queryKey: ["dashboard-agents-performance"],
    queryFn: async () => {
      const r = await fetch("/api/dashboard/agents-performance", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    enabled: !!token,
    refetchInterval: 60_000,
  });
  const brokerAgents = brokerPerf.filter(a => a.role === "broker");
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
        <SectionTitle icon={BarChart2} title="Broker Performance" sub="All registered brokers — leads sourced and deals closed this month" />
        {brokerAgents.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No broker agents found. Add brokers in team management.</p>
        ) : (
          <ScrollTable minWidth={480}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Channel Partner","Leads","Closed","Site Visits","Est. Commission"].map(h => (
                    <th key={h} className="text-left pb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider pr-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {brokerAgents.map((b) => (
                  <tr key={b.id} className="hover:bg-muted/20">
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                          {b.name.split(" ").map(w=>w[0]).join("")}
                        </div>
                        <span className="font-medium text-foreground text-xs whitespace-nowrap">{b.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 text-sm">{b.leadsThisMonth}</td>
                    <td className="py-2.5 pr-3 text-green-600 font-semibold text-sm">{b.bookingsThisMonth}</td>
                    <td className="py-2.5 pr-3 text-muted-foreground text-sm">{b.visitsThisMonth}</td>
                    <td className="py-2.5 font-semibold text-xs whitespace-nowrap">{formatCurrency(b.bookingsThisMonth * 1_90_000)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
        )}
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

const OWNER_TABS: { id: OwnerTab; label: string; shortLabel: string; desc: string; icon: React.ElementType }[] = [
  { id: "inventory", label: "Inventory",       shortLabel: "Inventory", desc: "Units, availability & blocking",  icon: Layers    },
  { id: "cashflow",  label: "Cash Flow",        shortLabel: "Cash Flow", desc: "Revenue, collections & projections", icon: DollarSign },
  { id: "leads",     label: "Leads & Marketing",shortLabel: "Leads",     desc: "Funnel, sources & ad spend",     icon: Users     },
  { id: "analysis",  label: "Team Analysis",    shortLabel: "Analysis",  desc: "Performance, visits & insights", icon: BarChart3 },
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
  const isEmployee       = role === "agent" || role === "broker";
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
            {OWNER_TABS.map(({ id, label, shortLabel, desc, icon: Icon }) => (
              <button key={id} onClick={() => setTab(id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap group",
                  tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <div className="text-left">
                  <span className="sm:hidden">{shortLabel}</span>
                  <span className="hidden sm:block">{label}</span>
                  {tab === id && <p className="hidden sm:block text-[9px] font-normal opacity-70 leading-none mt-0.5">{desc}</p>}
                </div>
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
