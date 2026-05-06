import { useGetDashboardStats, useGetDashboardPipeline, useGetRecentActivity, useGetLeadSources } from "@workspace/api-client-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { TrendingUp, Users, GitBranch, Building2, Activity, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatCurrency, stageLabel, timeAgo } from "@/lib/utils";
import { cn } from "@/lib/utils";

const COLORS = ["#f59e0b", "#1e3a5f", "#10b981", "#8b5cf6", "#ef4444", "#3b82f6", "#f97316", "#06b6d4"];

const CARD_THEMES = [
  { border: "border-l-blue-500",  icon: "bg-blue-50 text-blue-600",  trend: "+8%",  up: true  },
  { border: "border-l-amber-500", icon: "bg-amber-50 text-amber-600", trend: "+15%", up: true  },
  { border: "border-l-green-500", icon: "bg-green-50 text-green-600", trend: "+23%", up: true  },
  { border: "border-l-purple-500",icon: "bg-purple-50 text-purple-600",trend: "-2%", up: false },
];

function StatCard({ label, value, sub, icon: Icon, theme }: {
  label: string; value: string; sub?: string; icon: React.ElementType;
  theme: typeof CARD_THEMES[number];
}) {
  return (
    <div className={cn("bg-card border border-card-border border-l-4 rounded-lg p-5 flex items-start gap-4 hover:shadow-md transition-shadow", theme.border)}>
      <div className={cn("p-2.5 rounded-lg flex-shrink-0", theme.icon)}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-foreground mt-0.5 leading-none">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
      <div className={cn("flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full", theme.up ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600")}>
        {theme.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
        {theme.trend}
      </div>
    </div>
  );
}

function ActivityAvatar({ name }: { name?: string }) {
  const initials = (name ?? "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const colors = ["bg-amber-100 text-amber-700", "bg-blue-100 text-blue-700", "bg-green-100 text-green-700", "bg-purple-100 text-purple-700", "bg-rose-100 text-rose-700"];
  const color = colors[(name?.charCodeAt(0) ?? 0) % colors.length];
  return (
    <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0", color)}>
      {initials}
    </div>
  );
}

function SkeletonCard() {
  return <div className="h-28 bg-muted rounded-lg animate-pulse border-l-4 border-l-muted-foreground/20" />;
}

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: pipeline } = useGetDashboardPipeline();
  const { data: activity } = useGetRecentActivity();
  const { data: sources } = useGetLeadSources();

  const pipelineData = (pipeline ?? []).filter(p => !["closed_won", "closed_lost"].includes(p.stage));
  const totalSourceCount = (sources ?? []).reduce((s, x) => s + x.count, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your real estate portfolio at a glance</p>
        </div>
        <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
          {new Date().toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading ? (
          [...Array(4)].map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard label="Total Leads" value={String(stats?.totalLeads ?? 0)} sub={`+${stats?.newLeadsThisMonth ?? 0} this month`} icon={Users} theme={CARD_THEMES[0]} />
            <StatCard label="Pipeline Value" value={formatCurrency(stats?.pipelineValue ?? 0)} sub={`${stats?.activeDeals ?? 0} active deals`} icon={GitBranch} theme={CARD_THEMES[1]} />
            <StatCard label="Closed Revenue" value={formatCurrency(stats?.closedRevenue ?? 0)} sub={`${stats?.conversionRate ?? 0}% close rate`} icon={TrendingUp} theme={CARD_THEMES[2]} />
            <StatCard label="Properties" value={String(stats?.totalProperties ?? 0)} sub={`${stats?.availableProperties ?? 0} available`} icon={Building2} theme={CARD_THEMES[3]} />
          </>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Pipeline Chart — takes 3/5 */}
        <div className="lg:col-span-3 bg-card border border-card-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-primary" />Active Pipeline by Stage
            </h2>
            <span className="text-xs text-muted-foreground">{pipelineData.reduce((s, p) => s + p.count, 0)} active deals</span>
          </div>
          {pipelineData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={pipelineData} barSize={28}>
                <XAxis dataKey="stage" tickFormatter={stageLabel} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 10 }} width={58} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => [formatCurrency(v), "Value"]} labelFormatter={stageLabel} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                <Bar dataKey="value" fill="#f59e0b" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <GitBranch className="w-8 h-8 opacity-20" />
              <p className="text-sm">No active deals yet</p>
            </div>
          )}
        </div>

        {/* Lead Sources — takes 2/5 */}
        <div className="lg:col-span-2 bg-card border border-card-border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />Lead Sources
          </h2>
          {(sources ?? []).length > 0 ? (
            <div className="space-y-2.5">
              {(sources ?? []).map((s, i) => {
                const pct = totalSourceCount > 0 ? Math.round((s.count / totalSourceCount) * 100) : 0;
                return (
                  <div key={s.source}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-foreground capitalize font-medium">{s.source}</span>
                      <span className="text-xs text-muted-foreground">{s.count} · {pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No lead data</div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-card border border-card-border rounded-lg p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />Recent Activity
        </h2>
        {(activity ?? []).length === 0 ? (
          <div className="py-10 text-center">
            <Activity className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No recent activity</p>
          </div>
        ) : (
          <ul className="space-y-0 divide-y divide-border">
            {(activity ?? []).slice(0, 8).map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-2.5 group" data-testid={`activity-item-${item.id}`}>
                <ActivityAvatar name={item.agentName ?? undefined} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground leading-snug">
                    <span className="font-semibold">{item.entityName}</span>
                    <span className="text-muted-foreground"> — {item.description}</span>
                    {item.agentName && <span className="text-muted-foreground"> by <span className="font-medium text-foreground">{item.agentName}</span></span>}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0 whitespace-nowrap">{timeAgo(item.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
