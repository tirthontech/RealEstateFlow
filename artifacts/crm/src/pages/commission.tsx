import { useState } from "react";
import { Calculator, IndianRupee, Users, TrendingUp, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function CurrencyInput({ label, value, onChange, hint }: {
  label: string; value: string; onChange: (v: string) => void; hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-foreground">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">₹</span>
        <Input
          type="number"
          className="pl-7"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
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
        <Input
          type="number"
          step="0.1"
          min="0"
          max="100"
          className="pr-7"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
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
  const colors = {
    primary: "text-primary",
    green: "text-green-600",
    amber: "text-amber-600",
    red: "text-red-500",
  };
  return (
    <div className={cn("flex items-center justify-between py-3 border-b border-border last:border-0", highlight && "bg-muted/20 -mx-4 px-4")}>
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
      <p className={cn("text-lg font-bold", highlight ? colors[highlight] : "text-foreground")}>
        {formatINR(value)}
      </p>
    </div>
  );
}

const QUICK_VALUES = [
  { label: "₹50L", value: "5000000" },
  { label: "₹1Cr", value: "10000000" },
  { label: "₹2Cr", value: "20000000" },
  { label: "₹5Cr", value: "50000000" },
  { label: "₹10Cr", value: "100000000" },
];

export default function CommissionPage() {
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
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Calculator className="w-6 h-6 text-primary" />
          Commission Calculator
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Compute agent splits, referral fees, franchise deductions, and GST</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Inputs */}
        <div className="space-y-5">
          <div className="bg-card border border-card-border rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <IndianRupee className="w-4 h-4 text-primary" />Deal Details
            </h3>

            <div>
              <CurrencyInput label="Sale / Transaction Price" value={salePrice} onChange={setSalePrice} />
              <div className="flex gap-2 mt-2 flex-wrap">
                {QUICK_VALUES.map(({ label, value }) => (
                  <button
                    key={value}
                    onClick={() => setSalePrice(value)}
                    className={cn(
                      "px-2.5 py-1 rounded text-xs font-medium border transition-colors",
                      salePrice === value ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary hover:text-primary"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <PercentInput label="Brokerage Commission %" value={grossCommPct} onChange={setGrossCommPct} hint="Typical: 1–2% for residential, 2–3% for commercial" />
          </div>

          <div className="bg-card border border-card-border rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Users className="w-4 h-4 text-primary" />Agent Split
            </h3>
            <PercentInput label="Agent Share %" value={agentSplitPct} onChange={setAgentSplitPct} hint="60–70% is typical for senior agents" />
            <PercentInput label="Referral Fee %" value={referralPct} onChange={setReferralPct} hint="Paid to referring agent/channel partner before split" />
          </div>

          <div className="bg-card border border-card-border rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-primary" />Deductions
            </h3>
            <PercentInput label="Franchise / Network Fee %" value={franchisePct} onChange={setFranchisePct} hint="e.g. 5% for RE/MAX, Century21" />

            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-medium text-foreground">Co-mediation (Co-broke)</label>
                <button
                  onClick={() => setEnableCoMediation(!enableCoMediation)}
                  className={cn("relative w-9 h-5 rounded-full transition-colors", enableCoMediation ? "bg-primary" : "bg-muted")}
                >
                  <span className={cn("absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform", enableCoMediation ? "translate-x-4" : "translate-x-0")} />
                </button>
              </div>
              {enableCoMediation && (
                <PercentInput label="Co-mediation Split %" value={coMediationPct} onChange={setCoMediationPct} hint="Share given to other brokerage in co-broke deals" />
              )}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-5">
          <div className="bg-card border border-card-border rounded-lg p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Commission Breakdown</h3>
            <div>
              <ResultRow label="Transaction Value" value={price} />
              <ResultRow label="Gross Commission" value={grossCommission} sub={`${grossPct}% of transaction`} highlight="primary" />
              {referralFee > 0 && <ResultRow label="— Referral Fee" value={referralFee} sub={`${refPct}% of gross commission`} highlight="amber" />}
              {franchiseFee > 0 && <ResultRow label="— Franchise Fee" value={franchiseFee} sub={`${franPct}% after referral`} highlight="amber" />}
              {coMediationShare > 0 && <ResultRow label="— Co-mediation Share" value={coMediationShare} sub={`${coMedPct}% to co-broke agent`} highlight="amber" />}
              <ResultRow label="Net Commission Pool" value={netToOffice} />
            </div>
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
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-1.5">
              GST & Client Outflow
              <span className="text-xs text-muted-foreground font-normal">(18% GST on brokerage)</span>
            </h3>
            <ResultRow label="Commission (ex-GST)" value={grossCommission} />
            <ResultRow label="GST @ 18%" value={gstOnCommission} highlight="amber" />
            <ResultRow label="Total Client Payment" value={totalClientOutflow} highlight="primary" sub="Commission + GST" />
          </div>

          <div className="bg-muted/50 border border-border rounded-lg p-4">
            <div className="flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                This calculator is for estimation only. Actual commission may vary based on negotiated terms, state regulations, and your agency agreement. Always confirm splits in writing before deal closure.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
