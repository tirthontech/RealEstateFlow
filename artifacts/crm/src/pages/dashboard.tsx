import { useGetDashboardStats, useGetDashboardPipeline, useGetRecentActivity, useGetLeadSources } from "@workspace/api-client-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { TrendingUp, Users, GitBranch, Building2, DollarSign, Activity } from "lucide-react";
import { formatCurrency, stageLabel, timeAgo } from "@/lib/utils";

const COLORS = ["#f59e0b", "#1e3a5f", "#10b981", "#8b5cf6", "#ef4444", "#3b82f6", "#f97316"];

function StatCard({ label, value, sub, icon: Icon, accent = false }: {
  label: string; value: string; sub?: string; icon: React.ElementType; accent?: boolean;
}) {
  return (
    <div data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}
      className="bg-card border border-card-border rounded-lg p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-md ${accent ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-foreground mt-0.5">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: pipeline } = useGetDashboardPipeline();
  const { data: activity } = useGetRecentActivity();
  const { data: sources } = useGetLeadSources();

  if (statsLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const pipelineData = (pipeline ?? []).filter(p => !["closed_won", "closed_lost"].includes(p.stage));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your real estate portfolio at a glance</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Leads" value={String(stats?.totalLeads ?? 0)} sub={`+${stats?.newLeadsThisMonth ?? 0} this month`} icon={Users} />
        <StatCard label="Pipeline Value" value={formatCurrency(stats?.pipelineValue ?? 0)} sub={`${stats?.activeDeals ?? 0} active deals`} icon={DollarSign} accent />
        <StatCard label="Closed Revenue" value={formatCurrency(stats?.closedRevenue ?? 0)} sub={`${stats?.conversionRate ?? 0}% close rate`} icon={TrendingUp} />
        <StatCard label="Properties" value={String(stats?.totalProperties ?? 0)} sub={`${stats?.availableProperties ?? 0} available`} icon={Building2} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline Chart */}
        <div className="bg-card border border-card-border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-primary" />
            Active Pipeline by Stage
          </h2>
          {pipelineData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={pipelineData} barSize={28}>
                <XAxis dataKey="stage" tickFormatter={stageLabel} tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11 }} width={60} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} labelFormatter={stageLabel} />
                <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No active deals</div>
          )}
        </div>

        {/* Lead Sources */}
        <div className="bg-card border border-card-border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Lead Sources
          </h2>
          {(sources ?? []).length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={sources} dataKey="count" nameKey="source" cx="50%" cy="50%" innerRadius={45} outerRadius={70}>
                    {(sources ?? []).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <ul className="space-y-1.5 flex-1">
                {(sources ?? []).map((s, i) => (
                  <li key={s.source} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-foreground capitalize">{s.source}</span>
                    </div>
                    <span className="font-medium text-muted-foreground">{s.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No lead data</div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-card border border-card-border rounded-lg p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          Recent Activity
        </h2>
        {(activity ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No recent activity</p>
        ) : (
          <ul className="space-y-3">
            {(activity ?? []).slice(0, 8).map((item) => (
              <li key={item.id} className="flex items-start gap-3 text-sm" data-testid={`activity-item-${item.id}`}>
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-foreground font-medium">{item.entityName}</span>
                  <span className="text-muted-foreground"> — {item.description}</span>
                  {item.agentName && <span className="text-muted-foreground"> by {item.agentName}</span>}
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">{timeAgo(item.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
