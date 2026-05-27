import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calculator, IndianRupee, Users, TrendingUp, Info, BookOpen, Plus, CheckCircle, Clock, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import { customFetch } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";

// ─────────────────────── helpers ────────────────────────

function CurrencyInput({ label, value, onChange, hint }: {
  label: string; value: string; onChange: (v: string) => void; hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-foreground">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">₹</span>
        <Input type="number" className="pl-7" value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function PercentInput({ label, value, onChange, hint }: {
  label: string; value: string; onChange: (v: string) => void; hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-foreground">{label}</label>
      <div className="relative">
        <Input type="number" step="0.1" min="0" max="100" className="pr-7" value={value} onChange={(e) => onChange(e.target.value)} />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">%</span>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function formatINR(value: number): string {
  if (value >= 10_000_000) return `₹${(value / 10_000_000).toFixed(2)} Cr`;
  if (value >= 100_000) return `₹${(value / 100_000).toFixed(2)} L`;
  if (value >= 1_000) return `₹${(value / 1_000).toFixed(1)}k`;
  return `₹${value.toFixed(0)}`;
}

function ResultRow({ label, value, highlight, sub }: {
  label: string; value: number; highlight?: "primary" | "green" | "amber" | "red"; sub?: string;
}) {
  const colors = { primary: "text-primary", green: "text-green-600", amber: "text-amber-600", red: "text-red-500" };
  return (
    <div className={cn("flex items-center justify-between py-3 border-b border-border last:border-0", highlight && "bg-muted/20 -mx-4 px-4")}>
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
      <p className={cn("text-lg font-bold", highlight ? colors[highlight] : "text-foreground")}>{formatINR(value)}</p>
    </div>
  );
}

const QUICK_VALUES = [
  { label: "₹50L", value: "5000000" }, { label: "₹1Cr", value: "10000000" },
  { label: "₹2Cr", value: "20000000" }, { label: "₹5Cr", value: "50000000" },
  { label: "₹10Cr", value: "100000000" },
];

// ─────────────────────── Ledger ────────────────────────

type CommissionRecord = {
  id: number; dealId: number | null; agentId: number | null;
  agentName: string; dealTitle: string; dealValue: number;
  commissionRate: number; commissionEarned: number;
  status: string; type: string; createdAt: string; updatedAt: string;
};

function AddCommissionModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ agentName: "", dealTitle: "", dealValue: "", commissionRate: "2", type: "agent" });

  async function handleSave() {
    if (!form.agentName || !form.dealTitle || !form.dealValue) {
      toast({ title: "Please fill all required fields", variant: "destructive" }); return;
    }
    try {
      await customFetch("/api/commissions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, dealValue: Number(form.dealValue), commissionRate: Number(form.commissionRate) }) });
      onSaved();
    } catch {
      toast({ title: "Failed to save commission record", variant: "destructive" });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border border-border rounded-lg p-6 w-full max-w-md space-y-4">
        <h3 className="font-semibold">Add Commission Record</h3>
        <div className="space-y-3">
          <div className="space-y-1"><label className="text-xs font-medium">Sales Agent / Channel Partner Name *</label><Input value={form.agentName} onChange={e => setForm(f => ({ ...f, agentName: e.target.value }))} /></div>
          <div className="space-y-1"><label className="text-xs font-medium">Deal Title *</label><Input value={form.dealTitle} onChange={e => setForm(f => ({ ...f, dealTitle: e.target.value }))} /></div>
          <div className="space-y-1"><label className="text-xs font-medium">Deal Value (₹) *</label><Input type="number" value={form.dealValue} onChange={e => setForm(f => ({ ...f, dealValue: e.target.value }))} /></div>
          <div className="space-y-1"><label className="text-xs font-medium">Commission Rate (%)</label><Input type="number" step="0.1" value={form.commissionRate} onChange={e => setForm(f => ({ ...f, commissionRate: e.target.value }))} /></div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Type</label>
            <select className="w-full border border-input bg-background rounded-md px-3 py-2 text-sm" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              <option value="agent">In-House Sales Agent</option><option value="broker">External Channel Partner</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </div>
      </div>
    </div>
  );
}

function LedgerTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteTitle, setDeleteTitle] = useState("");
  const canManage = ["owner", "cfo", "manager"].includes(user?.role ?? "");

  const { data: records = [], isLoading } = useQuery<CommissionRecord[]>({
    queryKey: ["commissions"],
    queryFn: () => customFetch<CommissionRecord[]>("/api/commissions"),
  });

  const markPaid = useMutation({
    mutationFn: (id: number) => customFetch(`/api/commissions/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "paid" }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["commissions"] }),
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });

  const deleteRecord = useMutation({
    mutationFn: (id: number) => customFetch(`/api/commissions/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["commissions"] }),
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });

  const totalPending = records.filter(r => r.status === "pending").reduce((s, r) => s + r.commissionEarned, 0);
  const totalPaid = records.filter(r => r.status === "paid").reduce((s, r) => s + r.commissionEarned, 0);

  if (isLoading) return <div className="h-32 bg-muted rounded animate-pulse" />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-xs text-yellow-700 font-medium">Outstanding Liability</p>
          <p className="text-2xl font-bold text-yellow-700">{formatINR(totalPending)}</p>
          <p className="text-xs text-yellow-600">{records.filter(r => r.status === "pending").length} pending records</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-xs text-green-700 font-medium">Total Paid</p>
          <p className="text-2xl font-bold text-green-700">{formatINR(totalPaid)}</p>
          <p className="text-xs text-green-600">{records.filter(r => r.status === "paid").length} paid records</p>
        </div>
      </div>

      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-1" />Add Record</Button>
        </div>
      )}

      {records.length === 0 ? (
        <div className="bg-card border border-card-border rounded-lg p-8 text-center text-sm text-muted-foreground">
          No commission records yet. Add records when deals close.
        </div>
      ) : (
        <div className="bg-card border border-card-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr className="text-xs text-muted-foreground font-medium">
                <th className="text-left p-3">Sales Agent / Partner</th>
                <th className="text-left p-3">Deal</th>
                <th className="text-left p-3 hidden md:table-cell">Deal Value</th>
                <th className="text-left p-3 hidden md:table-cell">Rate</th>
                <th className="text-left p-3">Earned</th>
                <th className="text-left p-3">Status</th>
                {canManage && <th className="text-left p-3">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="p-3">
                    <p className="font-medium">{r.agentName}</p>
                    <p className="text-xs text-muted-foreground capitalize">{r.type}</p>
                  </td>
                  <td className="p-3 text-muted-foreground">{r.dealTitle}</td>
                  <td className="p-3 hidden md:table-cell text-muted-foreground">{formatINR(r.dealValue)}</td>
                  <td className="p-3 hidden md:table-cell text-muted-foreground">{r.commissionRate}%</td>
                  <td className="p-3 font-semibold">{formatINR(r.commissionEarned)}</td>
                  <td className="p-3">
                    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium", r.status === "paid" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700")}>
                      {r.status === "paid" ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {r.status}
                    </span>
                  </td>
                  {canManage && (
                    <td className="p-3">
                      <div className="flex gap-1">
                        {r.status === "pending" && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => markPaid.mutate(r.id)} disabled={markPaid.isPending}>Mark Paid</Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500" onClick={() => { setDeleteTitle(r.dealTitle); setDeleteId(r.id); }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDeleteDialog
        open={deleteId !== null}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        onConfirm={() => {
          if (deleteId) {
            deleteRecord.mutate(deleteId, {
              onSuccess: () => { setDeleteId(null); toast({ title: "Commission record deleted" }); },
              onError: () => toast({ title: "Delete failed", variant: "destructive" }),
            });
          }
        }}
        title="Delete Commission Record"
        description={`Are you sure you want to delete the commission record for "${deleteTitle}"? This action cannot be undone.`}
        loading={deleteRecord.isPending}
      />

      {showAdd && (
        <AddCommissionModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); qc.invalidateQueries({ queryKey: ["commissions"] }); }} />
      )}
    </div>
  );
}

// ─────────────────────── Calculator ────────────────────────

function CalculatorTab() {
  const [salePrice, setSalePrice] = useState("10000000");
  const [grossCommPct, setGrossCommPct] = useState("2");
  const [agentSplitPct, setAgentSplitPct] = useState("60");
  const [referralPct, setReferralPct] = useState("0");
  const [franchisePct, setFranchisePct] = useState("0");
  const [enableCoMediation, setEnableCoMediation] = useState(false);
  const [coMediationPct, setCoMediationPct] = useState("50");

  const price = parseFloat(salePrice) || 0;
  const grossPct = parseFloat(grossCommPct) || 0;
  const agentPct = parseFloat(agentSplitPct) || 0;
  const refPct = parseFloat(referralPct) || 0;
  const franPct = parseFloat(franchisePct) || 0;
  const coMedPct = parseFloat(coMediationPct) || 0;

  const grossCommission = (price * grossPct) / 100;
  const referralFee = (grossCommission * refPct) / 100;
  const afterReferral = grossCommission - referralFee;
  const franchiseFee = (afterReferral * franPct) / 100;
  const afterFranchise = afterReferral - franchiseFee;
  const coMediationShare = enableCoMediation ? (afterFranchise * coMedPct) / 100 : 0;
  const netToOffice = afterFranchise - coMediationShare;
  const agentCommission = (netToOffice * agentPct) / 100;
  const brokerageNet = netToOffice - agentCommission;
  const gstOnCommission = grossCommission * 0.18;
  const totalClientOutflow = grossCommission + gstOnCommission;
  const effectiveAgentPct = price > 0 ? (agentCommission / price) * 100 : 0;
  const effectiveBrokeragePct = price > 0 ? (brokerageNet / price) * 100 : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-5">
        <div className="bg-card border border-card-border rounded-lg p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5"><IndianRupee className="w-4 h-4 text-primary" />Deal Details</h3>
          <div>
            <CurrencyInput label="Sale / Transaction Price" value={salePrice} onChange={setSalePrice} />
            <div className="flex gap-2 mt-2 flex-wrap">
              {QUICK_VALUES.map(({ label, value }) => (
                <button key={value} onClick={() => setSalePrice(value)} className={cn("px-2.5 py-1 rounded text-xs font-medium border transition-colors", salePrice === value ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary hover:text-primary")}>{label}</button>
              ))}
            </div>
          </div>
          <PercentInput label="Brokerage Commission %" value={grossCommPct} onChange={setGrossCommPct} hint="Typical: 1–2% for residential, 2–3% for commercial" />
        </div>

        <div className="bg-card border border-card-border rounded-lg p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5"><Users className="w-4 h-4 text-primary" />Agent Split</h3>
          <PercentInput label="Agent Share %" value={agentSplitPct} onChange={setAgentSplitPct} hint="60–70% is typical for senior agents" />
          <PercentInput label="Referral Fee %" value={referralPct} onChange={setReferralPct} hint="Paid to referring agent/channel partner before split" />
        </div>

        <div className="bg-card border border-card-border rounded-lg p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-primary" />Deductions</h3>
          <PercentInput label="Franchise / Network Fee %" value={franchisePct} onChange={setFranchisePct} hint="e.g. 5% for RE/MAX, Century21" />
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-medium text-foreground">Co-mediation (Co-broke)</label>
              <button onClick={() => setEnableCoMediation(!enableCoMediation)} className={cn("relative w-9 h-5 rounded-full transition-colors", enableCoMediation ? "bg-primary" : "bg-muted")}>
                <span className={cn("absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform", enableCoMediation ? "translate-x-4" : "translate-x-0")} />
              </button>
            </div>
            {enableCoMediation && <PercentInput label="Co-mediation Split %" value={coMediationPct} onChange={setCoMediationPct} hint="Share given to other brokerage in co-broke deals" />}
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <div className="bg-card border border-card-border rounded-lg p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Commission Breakdown</h3>
          <ResultRow label="Transaction Value" value={price} />
          <ResultRow label="Gross Commission" value={grossCommission} sub={`${grossPct}% of transaction`} highlight="primary" />
          {referralFee > 0 && <ResultRow label="— Referral Fee" value={referralFee} sub={`${refPct}% of gross commission`} highlight="amber" />}
          {franchiseFee > 0 && <ResultRow label="— Franchise Fee" value={franchiseFee} sub={`${franPct}% after referral`} highlight="amber" />}
          {coMediationShare > 0 && <ResultRow label="— Co-mediation Share" value={coMediationShare} sub={`${coMedPct}% to co-broke agent`} highlight="amber" />}
          <ResultRow label="Net Commission Pool" value={netToOffice} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <p className="text-xs font-medium text-green-700 mb-1">Agent Take-Home</p>
            <p className="text-2xl font-bold text-green-700">{formatINR(agentCommission)}</p>
            <p className="text-xs text-green-600 mt-1">{effectiveAgentPct.toFixed(2)}% of sale · {agentPct}% split</p>
          </div>
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-center">
            <p className="text-xs font-medium text-primary mb-1">Brokerage Net</p>
            <p className="text-2xl font-bold text-primary">{formatINR(brokerageNet)}</p>
            <p className="text-xs text-primary/70 mt-1">{effectiveBrokeragePct.toFixed(2)}% of sale</p>
          </div>
        </div>

        <div className="bg-card border border-card-border rounded-lg p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-1.5">GST & Client Outflow<span className="text-xs text-muted-foreground font-normal">(18% GST on brokerage)</span></h3>
          <ResultRow label="Commission (ex-GST)" value={grossCommission} />
          <ResultRow label="GST @ 18%" value={gstOnCommission} highlight="amber" />
          <ResultRow label="Total Client Payment" value={totalClientOutflow} highlight="primary" sub="Commission + GST" />
        </div>

        <div className="bg-muted/50 border border-border rounded-lg p-4">
          <div className="flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">This calculator is for estimation only. Actual commission may vary based on negotiated terms, state regulations, and your agency agreement.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────── Main Page ────────────────────────

export default function CommissionPage() {
  const [tab, setTab] = useState<"ledger" | "calculator">("ledger");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <IndianRupee className="w-6 h-6 text-primary" />Commission
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Track commission records per deal and calculate splits</p>
      </div>

      <div className="flex gap-1 border-b border-border">
        {([
          { key: "ledger", label: "Commission Ledger", desc: "Track per-deal payouts", icon: <BookOpen className="w-4 h-4" /> },
          { key: "calculator", label: "Split Calculator", desc: "Compute agent vs office splits", icon: <Calculator className="w-4 h-4" /> },
        ] as const).map(({ key, label, desc, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn("flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors text-left", tab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {icon}
            <div>
              <span className="block">{label}</span>
              {tab === key && <span className="block text-[10px] opacity-60 font-normal">{desc}</span>}
            </div>
          </button>
        ))}
      </div>

      {tab === "ledger" ? <LedgerTab /> : <CalculatorTab />}
    </div>
  );
}
