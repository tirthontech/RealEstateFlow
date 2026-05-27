import { useState } from "react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useGetLeads, useGetProperties } from "@workspace/api-client-react";
import { getGetLeadsQueryKey, getGetPropertiesQueryKey } from "@workspace/api-client-react";
import { Plus, Trash2, CheckCircle2, Clock, IndianRupee, ChevronDown, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/lib/role-context";
import { cn, formatCurrency } from "@/lib/utils";

type Installment = {
  id: number;
  planId: number;
  label: string;
  dueDate: string | null;
  amount: number;
  status: string;
  paidAt: string | null;
  createdAt: string;
};

type Plan = {
  id: number;
  clientName: string;
  totalAmount: number;
  downPayment: number;
  dealId: number | null;
  leadId: number | null;
  propertyId: number | null;
  notes: string | null;
  installments: Installment[];
  createdAt: string;
  updatedAt: string;
};

const PLAN_KEY = ["payment-plans"];

const MILESTONE_PRESETS = [
  "On Booking",
  "On Agreement",
  "On Foundation",
  "On Plinth",
  "On Slab (1st Floor)",
  "On Slab (2nd Floor)",
  "On Brickwork",
  "On Plaster",
  "On Flooring",
  "On Possession",
];

function usePlans() {
  return useQuery<Plan[]>({ queryKey: PLAN_KEY, queryFn: () => customFetch("/api/payment-plans") });
}

function fmt(n: number) {
  return formatCurrency(n);
}

function paidPct(plan: Plan) {
  if (!plan.installments.length) return 0;
  const paid = plan.installments.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0);
  return Math.round((paid / plan.totalAmount) * 100);
}

type InstRow = { label: string; amount: string; dueDate: string };
const emptyRow = (): InstRow => ({ label: "", amount: "", dueDate: "" });

export default function PaymentPlansPage() {
  const { role } = useRole();
  const canEdit = ["owner", "cfo", "manager"].includes(role);
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: plans = [], isLoading } = usePlans();
  const { data: leads } = useGetLeads({}, { query: { queryKey: getGetLeadsQueryKey() } });
  const { data: properties } = useGetProperties({}, { query: { queryKey: getGetPropertiesQueryKey() } });

  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [form, setForm] = useState({ clientName: "", totalAmount: "", downPayment: "", leadId: "", propertyId: "", notes: "" });
  const [rows, setRows] = useState<InstRow[]>([emptyRow()]);

  const createMutation = useMutation({
    mutationFn: (body: object) => customFetch("/api/payment-plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: PLAN_KEY }); toast({ title: "Payment plan created" }); setShowCreate(false); resetForm(); },
    onError: () => toast({ title: "Failed to create plan", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => customFetch(`/api/payment-plans/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: PLAN_KEY }); toast({ title: "Plan deleted" }); },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  const markPaidMutation = useMutation({
    mutationFn: ({ planId, instId, status }: { planId: number; instId: number; status: string }) =>
      customFetch(`/api/payment-plans/${planId}/installments/${instId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: PLAN_KEY }),
    onError: () => toast({ title: "Failed to update installment", variant: "destructive" }),
  });

  function resetForm() {
    setForm({ clientName: "", totalAmount: "", downPayment: "", leadId: "", propertyId: "", notes: "" });
    setRows([emptyRow()]);
  }

  function handleCreate() {
    if (!form.clientName || !form.totalAmount) {
      toast({ title: "Client name and total amount are required", variant: "destructive" }); return;
    }
    const validRows = rows.filter(r => r.label && r.amount && Number(r.amount) > 0);
    createMutation.mutate({
      clientName: form.clientName,
      totalAmount: Number(form.totalAmount),
      downPayment: Number(form.downPayment || 0),
      leadId: form.leadId ? Number(form.leadId) : null,
      propertyId: form.propertyId ? Number(form.propertyId) : null,
      notes: form.notes || null,
      installments: validRows.map(r => ({ label: r.label, amount: Number(r.amount), dueDate: r.dueDate || null })),
    });
  }

  function toggleExpand(id: number) {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const totalCollected = plans.reduce((s, p) => s + p.installments.filter(i => i.status === "paid").reduce((a, i) => a + i.amount, 0), 0);
  const totalOutstanding = plans.reduce((s, p) => s + p.installments.filter(i => i.status !== "paid").reduce((a, i) => a + i.amount, 0), 0);

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payment Plans</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Create instalment schedules and track collections</p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => { setShowCreate(true); resetForm(); }}>
            <Plus className="w-4 h-4 mr-1" />New Plan
          </Button>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Plans", value: String(plans.length), icon: IndianRupee, color: "text-blue-600" },
          { label: "Collected", value: fmt(totalCollected), icon: CheckCircle2, color: "text-green-600" },
          { label: "Outstanding", value: fmt(totalOutstanding), icon: Clock, color: "text-amber-600" },
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

      {/* Create form */}
      {showCreate && canEdit && (
        <div className="bg-card border border-card-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">New Payment Plan</p>
            <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="md:col-span-1">
              <label className="text-xs text-muted-foreground mb-1 block">Client Name *</label>
              <Input className="h-9" placeholder="Rahul Sharma" value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Total Amount (₹) *</label>
              <Input className="h-9" type="number" placeholder="5000000" value={form.totalAmount} onChange={e => setForm(f => ({ ...f, totalAmount: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Down Payment (₹)</label>
              <Input className="h-9" type="number" placeholder="500000" value={form.downPayment} onChange={e => setForm(f => ({ ...f, downPayment: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Link to Lead</label>
              <Select value={form.leadId} onValueChange={v => setForm(f => ({ ...f, leadId: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select lead" /></SelectTrigger>
                <SelectContent>{(leads ?? []).map(l => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Link to Property</label>
              <Select value={form.propertyId} onValueChange={v => setForm(f => ({ ...f, propertyId: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select property" /></SelectTrigger>
                <SelectContent>{(properties ?? []).map(p => <SelectItem key={p.id} value={String(p.id)}>{p.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
              <Input className="h-9" placeholder="Optional notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>

          {/* Installments */}
          <div>
            <p className="text-xs font-semibold text-foreground mb-2">Instalment Schedule</p>
            <div className="space-y-2">
              {rows.map((row, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-4">
                    <Select value={row.label} onValueChange={v => setRows(rs => rs.map((r, i) => i === idx ? { ...r, label: v } : r))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Milestone" /></SelectTrigger>
                      <SelectContent>{MILESTONE_PRESETS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <Input className="h-8 text-xs" type="number" placeholder="Amount ₹" value={row.amount} onChange={e => setRows(rs => rs.map((r, i) => i === idx ? { ...r, amount: e.target.value } : r))} />
                  </div>
                  <div className="col-span-4">
                    <Input className="h-8 text-xs" type="date" value={row.dueDate} onChange={e => setRows(rs => rs.map((r, i) => i === idx ? { ...r, dueDate: e.target.value } : r))} />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    {rows.length > 1 && (
                      <button onClick={() => setRows(rs => rs.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-destructive transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setRows(rs => [...rs, emptyRow()])} className="mt-2 text-xs text-primary hover:underline flex items-center gap-1">
              <Plus className="w-3 h-3" />Add instalment
            </button>
          </div>

          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={handleCreate} disabled={createMutation.isPending}>{createMutation.isPending ? "Creating..." : "Create Plan"}</Button>
            <Button size="sm" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Plans list */}
      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : plans.length === 0 ? (
        <div className="bg-card border border-card-border rounded-xl p-10 text-center">
          <IndianRupee className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">No payment plans yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map(plan => {
            const pct = paidPct(plan);
            const isExpanded = expanded.has(plan.id);
            const paidAmt = plan.installments.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0);
            const outstanding = plan.totalAmount - paidAmt;

            return (
              <div key={plan.id} className="bg-card border border-card-border rounded-xl overflow-hidden">
                <div className="p-4 flex items-center gap-4 cursor-pointer" onClick={() => toggleExpand(plan.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-foreground">{plan.clientName}</p>
                      {plan.leadId && (leads ?? []).find(l => l.id === plan.leadId) && (
                        <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded">
                          {(leads ?? []).find(l => l.id === plan.leadId)?.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>Total: <span className="font-medium text-foreground">{fmt(plan.totalAmount)}</span></span>
                      <span>Collected: <span className="font-medium text-green-600">{fmt(paidAmt)}</span></span>
                      <span>Outstanding: <span className="font-medium text-amber-600">{fmt(outstanding)}</span></span>
                    </div>
                    <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden w-full max-w-xs">
                      <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{pct}% collected · {plan.installments.length} instalments</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {canEdit && (
                      <button onClick={e => { e.stopPropagation(); deleteMutation.mutate(plan.id); }}
                        className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>

                {isExpanded && plan.installments.length > 0 && (
                  <div className="border-t border-card-border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40">
                        <tr>
                          {["Milestone", "Due Date", "Amount", "Status", ""].map(h => (
                            <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-card-border">
                        {plan.installments.map(inst => (
                          <tr key={inst.id} className="hover:bg-muted/20">
                            <td className="px-4 py-2.5 font-medium text-sm">{inst.label}</td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground">{inst.dueDate ?? "—"}</td>
                            <td className="px-4 py-2.5 font-medium">{fmt(inst.amount)}</td>
                            <td className="px-4 py-2.5">
                              <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                                inst.status === "paid" ? "bg-green-50 text-green-700 border-green-200"
                                : inst.status === "overdue" ? "bg-red-50 text-red-700 border-red-200"
                                : "bg-amber-50 text-amber-700 border-amber-200")}>
                                {inst.status === "paid" ? <CheckCircle2 className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
                                {inst.status.charAt(0).toUpperCase() + inst.status.slice(1)}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              {inst.status !== "paid" ? (
                                <button onClick={() => markPaidMutation.mutate({ planId: plan.id, instId: inst.id, status: "paid" })}
                                  className="text-xs text-primary hover:underline font-medium">
                                  Mark Paid
                                </button>
                              ) : (
                                <button onClick={() => markPaidMutation.mutate({ planId: plan.id, instId: inst.id, status: "pending" })}
                                  className="text-xs text-muted-foreground hover:text-foreground">
                                  Unmark
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {plan.notes && (
                      <p className="px-4 py-2 text-xs text-muted-foreground border-t border-card-border italic">{plan.notes}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
