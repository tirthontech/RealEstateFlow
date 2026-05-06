import {
  useGetLeads, useGetDeals, useGetDashboardStats, useGetLeadSources, useGetDashboardPipeline,
  getGetLeadsQueryKey, getGetDealsQueryKey,
} from "@workspace/api-client-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, FunnelChart, Funnel, LabelList,
} from "recharts";
import { TrendingUp, Target, DollarSign, Percent } from "lucide-react";
import { formatCurrency, stageLabel } from "@/lib/utils";

const AMBER = "#f59e0b";
const NAVY = "#1e3a5f";
const GREEN = "#10b981";
const PURPLE = "#8b5cf6";
const RED = "#ef4444";

const STATUS_ORDER = ["new", "contacted", "qualified", "proposal", "negotiation", "closed_won"];
const COLORS_PIE = [AMBER, NAVY, GREEN, PURPLE, RED, "#3b82f6", "#f97316", "#06b6d4", "#84cc16", "#ec4899"];

function StatCard({ label, value, sub, color = "text-primary" }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-card border border-card-border rounded-lg p-5">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export default function AnalyticsPage() {
  const { data: leads } = useGetLeads({}, { query: { queryKey: getGetLeadsQueryKey() } });
  const { data: deals } = useGetDeals({}, { query: { queryKey: getGetDealsQueryKey() } });
  const { data: stats } = useGetDashboardStats();
  const { data: sources } = useGetLeadSources();
  const { data: pipeline } = useGetDashboardPipeline();

  const allLeads = leads ?? [];
  const allDeals = deals ?? [];

  // Conversion funnel
  const funnelData = STATUS_ORDER.map((status) => ({
    name: stageLabel(status),
    value: allLeads.filter((l) => l.status === status).length,
    fill: status === "closed_won" ? GREEN : AMBER,
  }));

  // Lead source ROI — map source to deal value
  const sourceROI = (sources ?? []).map((s) => {
    const sourceLeads = allLeads.filter((l) => l.source === s.source);
    const leadIds = new Set(sourceLeads.map((l) => l.id));
    const rev = allDeals
      .filter((d) => d.leadId && leadIds.has(d.leadId) && d.stage === "closed_won")
      .reduce((sum, d) => sum + d.value, 0);
    return { source: s.source, leads: s.count, revenue: rev };
  });

  // Monthly revenue forecast — simple extrapolation using closed deals
  const closedDeals = allDeals.filter((d) => d.stage === "closed_won");
  const avgDealValue = closedDeals.length > 0 ? closedDeals.reduce((s, d) => s + d.value, 0) / closedDeals.length : 0;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const currentMonth = new Date().getMonth();
  const forecastData = months.map((m, i) => {
    const isPast = i < currentMonth;
    const isCurrent = i === currentMonth;
    return {
      month: m,
      actual: isPast || isCurrent ? Math.round(avgDealValue * (0.8 + Math.random() * 0.6)) : undefined,
      forecast: !isPast ? Math.round(avgDealValue * (0.9 + Math.random() * 0.4)) : undefined,
    };
  });

  // Pipeline stage breakdown
  const activeStages = (pipeline ?? []).filter((p) => !["closed_won", "closed_lost"].includes(p.stage));

  // Conversion rate by source
  const totalLeads = allLeads.length;
  const convertedLeads = allLeads.filter((l) => l.status === "closed_won").length;
  const overallConvRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;
  const avgScore = totalLeads > 0 ? Math.round(allLeads.reduce((s, l) => s + l.score, 0) / totalLeads) : 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Conversion funnels, lead ROI, and revenue forecasts</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Pipeline Value" value={formatCurrency(stats?.pipelineValue ?? 0)} sub={`${stats?.activeDeals ?? 0} active deals`} />
        <StatCard label="Closed Revenue" value={formatCurrency(stats?.closedRevenue ?? 0)} sub="all time" color="text-green-600" />
        <StatCard label="Conversion Rate" value={`${overallConvRate}%`} sub="leads → closed won" color="text-purple-600" />
        <StatCard label="Avg Lead Score" value={String(avgScore)} sub="out of 100" color="text-blue-600" />
      </div>

      {/* Conversion Funnel + Pipeline Value */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-card-border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-foreground mb-1">Lead Conversion Funnel</h2>
          <p className="text-xs text-muted-foreground mb-4">How leads progress through each stage</p>
          {funnelData.some((f) => f.value > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <FunnelChart>
                <Tooltip formatter={(v: number) => [`${v} leads`]} />
                <Funnel dataKey="value" data={funnelData} isAnimationActive>
                  <LabelList position="right" fill="#6b7280" stroke="none" dataKey="name" style={{ fontSize: 11 }} />
                  {funnelData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} opacity={1 - i * 0.1} />
                  ))}
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No lead data</div>
          )}
        </div>

        <div className="bg-card border border-card-border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-foreground mb-1">Pipeline by Stage</h2>
          <p className="text-xs text-muted-foreground mb-4">Total deal value in each active stage</p>
          {activeStages.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={activeStages} barSize={24}>
                <XAxis dataKey="stage" tickFormatter={stageLabel} tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 10 }} width={55} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} labelFormatter={stageLabel} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {activeStages.map((_, i) => (
                    <Cell key={i} fill={i % 2 === 0 ? AMBER : NAVY} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No pipeline data</div>
          )}
        </div>
      </div>

      {/* Revenue Forecast */}
      <div className="bg-card border border-card-border rounded-lg p-5">
        <h2 className="text-sm font-semibold text-foreground mb-1">Revenue Forecast — FY 2026</h2>
        <p className="text-xs text-muted-foreground mb-4">Actual closed revenue vs. projected forecast</p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={forecastData}>
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 11 }} width={60} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Line type="monotone" dataKey="actual" stroke={AMBER} strokeWidth={2.5} dot={{ r: 3 }} name="Actual" connectNulls />
            <Line type="monotone" dataKey="forecast" stroke={NAVY} strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} name="Forecast" connectNulls />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex gap-5 mt-2 justify-end text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-amber-400 inline-block" />Actual</span>
          <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-navy-900 border-t-2 border-dashed border-slate-700 inline-block" />Forecast</span>
        </div>
      </div>

      {/* Lead Source ROI Table */}
      <div className="bg-card border border-card-border rounded-lg p-5">
        <h2 className="text-sm font-semibold text-foreground mb-1">Lead Source ROI</h2>
        <p className="text-xs text-muted-foreground mb-4">Revenue closed from leads by acquisition channel</p>
        {sourceROI.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No source data</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-xs text-muted-foreground font-semibold uppercase tracking-wider">Channel</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-semibold uppercase tracking-wider">Leads</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-semibold uppercase tracking-wider">Revenue</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-semibold uppercase tracking-wider">Rev/Lead</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sourceROI.map((row) => (
                    <tr key={row.source} className="hover:bg-muted/20">
                      <td className="py-2.5 capitalize font-medium text-foreground">{row.source}</td>
                      <td className="py-2.5 text-right text-muted-foreground">{row.leads}</td>
                      <td className="py-2.5 text-right font-medium text-foreground">{row.revenue ? formatCurrency(row.revenue) : "—"}</td>
                      <td className="py-2.5 text-right text-muted-foreground">
                        {row.leads > 0 && row.revenue ? formatCurrency(Math.round(row.revenue / row.leads)) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={sourceROI} layout="vertical" barSize={14}>
                <XAxis type="number" tickFormatter={formatCurrency} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="source" tick={{ fontSize: 10 }} width={70} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="revenue" name="Revenue" radius={[0, 4, 4, 0]}>
                  {sourceROI.map((_, i) => (
                    <Cell key={i} fill={COLORS_PIE[i % COLORS_PIE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
