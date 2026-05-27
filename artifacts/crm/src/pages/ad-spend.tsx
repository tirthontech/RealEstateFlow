import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, TrendingUp, IndianRupee, Users, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useRole } from "@/lib/role-context";

type AdSpendRow = {
  id: number;
  channel: string;
  month: number;
  year: number;
  spend: number;
  leadsGenerated: number;
  cpl: number | null;
  createdAt: string;
  updatedAt: string;
};

const CHANNELS = ["99acres", "facebook", "google", "housing", "magicbricks", "other"] as const;
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const CHANNEL_COLORS: Record<string, string> = {
  "99acres": "#f97316", facebook: "#3b82f6", google: "#22c55e",
  housing: "#a855f7", magicbricks: "#ec4899", other: "#6b7280",
};

const AD_SPEND_KEY = ["ad-spend"];

function useAdSpend() {
  return useQuery<AdSpendRow[]>({
    queryKey: AD_SPEND_KEY,
    queryFn: () => customFetch("/api/ad-spend"),
  });
}

function fmt(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

type FormState = { channel: string; month: string; year: string; spend: string; leadsGenerated: string };
const emptyForm = (): FormState => ({ channel: "99acres", month: String(new Date().getMonth() + 1), year: String(CURRENT_YEAR), spend: "", leadsGenerated: "" });

export default function AdSpendPage() {
  const { role } = useRole();
  const canEdit = ["owner", "cfo", "manager"].includes(role);
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: rows = [], isLoading } = useAdSpend();

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [filterYear, setFilterYear] = useState(String(CURRENT_YEAR));

  const createMutation = useMutation({
    mutationFn: (body: object) => customFetch("/api/ad-spend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: AD_SPEND_KEY }); toast({ title: "Record added" }); setShowForm(false); setForm(emptyForm()); },
    onError: () => toast({ title: "Failed to add record", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: object }) => customFetch(`/api/ad-spend/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: AD_SPEND_KEY }); toast({ title: "Record updated" }); setEditId(null); setForm(emptyForm()); },
    onError: () => toast({ title: "Failed to update record", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => customFetch(`/api/ad-spend/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: AD_SPEND_KEY }); toast({ title: "Record deleted" }); },
    onError: () => toast({ title: "Failed to delete record", variant: "destructive" }),
  });

  const filtered = rows.filter(r => String(r.year) === filterYear);

  // Summary stats
  const totalSpend = filtered.reduce((s, r) => s + r.spend, 0);
  const totalLeads = filtered.reduce((s, r) => s + r.leadsGenerated, 0);
  const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;

  // Monthly chart data
  const monthlyData = MONTHS.map((name, i) => {
    const monthRows = filtered.filter(r => r.month === i + 1);
    const spend = monthRows.reduce((s, r) => s + r.spend, 0);
    const leads = monthRows.reduce((s, r) => s + r.leadsGenerated, 0);
    return { name, spend, leads, cpl: leads > 0 ? spend / leads : 0 };
  }).filter(d => d.spend > 0);

  // Channel breakdown
  const channelData = CHANNELS.map(ch => {
    const chRows = filtered.filter(r => r.channel === ch);
    const spend = chRows.reduce((s, r) => s + r.spend, 0);
    const leads = chRows.reduce((s, r) => s + r.leadsGenerated, 0);
    return { channel: ch, spend, leads, cpl: leads > 0 ? spend / leads : 0 };
  }).filter(d => d.spend > 0).sort((a, b) => b.spend - a.spend);

  function handleSubmit() {
    const body = {
      channel: form.channel,
      month: Number(form.month),
      year: Number(form.year),
      spend: Number(form.spend),
      leadsGenerated: Number(form.leadsGenerated || 0),
    };
    if (!form.spend || isNaN(body.spend)) { toast({ title: "Enter a valid spend amount", variant: "destructive" }); return; }
    if (editId !== null) updateMutation.mutate({ id: editId, body });
    else createMutation.mutate(body);
  }

  function startEdit(row: AdSpendRow) {
    setEditId(row.id);
    setForm({ channel: row.channel, month: String(row.month), year: String(row.year), spend: String(row.spend), leadsGenerated: String(row.leadsGenerated) });
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditId(null);
    setForm(emptyForm());
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Marketing & Ad Spend</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track spend, leads generated, and cost per lead by channel</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-28 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
          {canEdit && (
            <Button size="sm" onClick={() => { setShowForm(true); setEditId(null); setForm(emptyForm()); }}>
              <Plus className="w-4 h-4 mr-1" />Add Record
            </Button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Ad Spend", value: fmt(totalSpend), icon: IndianRupee, color: "text-blue-600" },
          { label: "Leads Generated", value: String(totalLeads), icon: Users, color: "text-green-600" },
          { label: "Avg Cost Per Lead", value: avgCpl > 0 ? fmt(avgCpl) : "—", icon: Target, color: "text-purple-600" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card border border-card-border rounded-xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">{label}</p>
              <p className="text-xl font-bold text-foreground">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Form */}
      {showForm && canEdit && (
        <div className="bg-card border border-card-border rounded-xl p-5 space-y-4">
          <p className="text-sm font-semibold text-foreground">{editId !== null ? "Edit Record" : "Add Ad Spend Record"}</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Channel</label>
              <Select value={form.channel} onValueChange={v => setForm(f => ({ ...f, channel: v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{CHANNELS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Month</label>
              <Select value={form.month} onValueChange={v => setForm(f => ({ ...f, month: v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Year</label>
              <Select value={form.year} onValueChange={v => setForm(f => ({ ...f, year: v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Spend (₹)</label>
              <Input className="h-9" type="number" placeholder="0" value={form.spend} onChange={e => setForm(f => ({ ...f, spend: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Leads Generated</label>
              <Input className="h-9" type="number" placeholder="0" value={form.leadsGenerated} onChange={e => setForm(f => ({ ...f, leadsGenerated: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSubmit} disabled={isSaving}>{isSaving ? "Saving..." : editId !== null ? "Update" : "Add"}</Button>
            <Button size="sm" variant="outline" onClick={cancelForm}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Charts */}
      {monthlyData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card border border-card-border rounded-xl p-5">
            <p className="text-sm font-semibold text-foreground mb-4">Monthly Spend</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: number) => [fmt(v), "Spend"]} />
                <Bar dataKey="spend" fill="#3b82f6" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-card border border-card-border rounded-xl p-5">
            <p className="text-sm font-semibold text-foreground mb-4">Channel Breakdown</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={channelData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="channel" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: number) => [fmt(v), "Spend"]} />
                <Bar dataKey="spend" radius={[4,4,0,0]}>
                  {channelData.map(entry => (
                    <Cell key={entry.channel} fill={CHANNEL_COLORS[entry.channel] ?? "#6b7280"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-card border border-card-border rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-card-border">
          <p className="text-sm font-semibold text-foreground">Records — {filterYear}</p>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <TrendingUp className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No records for {filterYear}. Add one to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  {["Channel","Month","Spend","Leads","CPL", canEdit ? "Actions" : ""].filter(Boolean).map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border">
                {filtered.sort((a,b) => b.month - a.month).map(row => (
                  <tr key={row.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CHANNEL_COLORS[row.channel] ?? "#6b7280" }} />
                        <span className="font-medium capitalize">{row.channel}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{MONTHS[row.month - 1]} {row.year}</td>
                    <td className="px-4 py-3 font-medium">{fmt(row.spend)}</td>
                    <td className="px-4 py-3">{row.leadsGenerated}</td>
                    <td className="px-4 py-3">{row.cpl != null ? fmt(row.cpl) : "—"}</td>
                    {canEdit && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => startEdit(row)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteMutation.mutate(row.id)} className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
