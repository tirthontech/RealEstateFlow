import { useState } from "react";
import {
  CheckCircle2, XCircle, Clock, AlertTriangle, Building2, Users,
  DollarSign, FileText, ChevronDown, ChevronUp,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type ApprovalType = "unit_status" | "lead_conversion" | "price_change" | "expense" | "document";
type Priority = "urgent" | "high" | "normal";
type ApprovalStatus = "pending" | "approved" | "rejected";

interface Approval {
  id: number; type: ApprovalType; title: string; description: string;
  submittedBy: string; submittedRole: string; submittedAt: string;
  priority: Priority; project?: string; unit?: string; amount?: number;
  fromValue?: string; toValue?: string; status: ApprovalStatus;
}

const INITIAL_APPROVALS: Approval[] = [
  { id: 1, type: "lead_conversion", priority: "urgent",  title: "Lead → Customer: Meera Patel",          description: "Booking amount ₹5L received. Agreement to be signed. Unit A-504, Prestige Lakeside.",     submittedBy: "Arjun Mehta",  submittedRole: "Salesperson", submittedAt: "30 min ago", project: "Prestige Lakeside",       unit: "A-504", amount: 5_00_000, status: "pending" },
  { id: 2, type: "price_change",    priority: "high",    title: "Price Revision: DLF Cybercity A-wing",  description: "Revising base price from ₹13,500/sqft to ₹14,200/sqft based on market appreciation.",       submittedBy: "Sneha Joshi",  submittedRole: "Manager",     submittedAt: "2h ago",     project: "DLF Cybercity Residences",           fromValue: "₹13,500/sqft", toValue: "₹14,200/sqft", status: "pending" },
  { id: 3, type: "unit_status",     priority: "high",    title: "Block Unit B-302: Sanjay Verma",        description: "Blocking B-302 at Godrej Summit for prospect Sanjay Verma. Expected conversion in 5 days.", submittedBy: "Riya Sharma",  submittedRole: "Salesperson", submittedAt: "3h ago",     project: "Godrej Summit",           unit: "B-302", status: "pending" },
  { id: 4, type: "expense",         priority: "normal",  title: "Construction Cost Entry: Phase 3 Slab", description: "Phase 3 slab work completion payment for Prestige Lakeside. Total bill: ₹48.5L",           submittedBy: "Rakesh Kumar", submittedRole: "CFO",         submittedAt: "5h ago",     project: "Prestige Lakeside",                  amount: 48_50_000, status: "pending" },
  { id: 5, type: "unit_status",     priority: "normal",  title: "Mark Unit C-108 as Available",          description: "Prospect cancelled, unblocking C-108. Releasing hold placed on Apr 29.",                   submittedBy: "Arjun Mehta",  submittedRole: "Salesperson", submittedAt: "1d ago",     project: "DLF Cybercity Residences", unit: "C-108", status: "pending" },
  { id: 6, type: "document",        priority: "normal",  title: "Sale Agreement: Vikram Singh",          description: "Sale agreement for unit D-201 at Sobha Royal Crest needs verification before marking sold.", submittedBy: "Riya Sharma",  submittedRole: "Salesperson", submittedAt: "1d ago",     project: "Sobha Royal Crest",        unit: "D-201", status: "pending" },
  { id: 7, type: "lead_conversion", priority: "normal",  title: "Lead → Customer: Deepa Krishnan",       description: "Booking amount ₹3L received for unit B-405 at Sobha Royal Crest.",                         submittedBy: "Rahul Gupta",  submittedRole: "Salesperson", submittedAt: "2d ago",     project: "Sobha Royal Crest",        unit: "B-405", amount: 3_00_000, status: "pending" },
];

const AUDIT_LOG = [
  { id: 101, action: "approved", title: "Price Revision: Prestige A-wing", by: "Owner Harsh Jain",      at: "May 5 · 2:15 PM",  detail: "₹8,000 → ₹8,500/sqft"           },
  { id: 102, action: "approved", title: "Lead Conversion: Amit Jain",      by: "Manager Sneha Joshi",   at: "May 4 · 11:30 AM", detail: "Unit B-105, Godrej Summit"        },
  { id: 103, action: "rejected", title: "Block Unit A-202",                 by: "Manager Sneha Joshi",   at: "May 3 · 4:00 PM",  detail: "Reason: Insufficient info"       },
  { id: 104, action: "approved", title: "Expense: Marketing Spend Q1",     by: "Owner Harsh Jain",      at: "May 2 · 9:00 AM",  detail: "₹12L — Instagram + Google Ads"   },
];

const TYPE_CONFIG: Record<ApprovalType, { icon: React.ElementType; label: string; color: string }> = {
  unit_status:     { icon: Building2,  label: "Unit Status",     color: "text-blue-600 bg-blue-50"    },
  lead_conversion: { icon: Users,      label: "Lead Conversion", color: "text-green-600 bg-green-50"  },
  price_change:    { icon: DollarSign, label: "Price Change",    color: "text-amber-600 bg-amber-50"  },
  expense:         { icon: FileText,   label: "Expense Entry",   color: "text-purple-600 bg-purple-50" },
  document:        { icon: FileText,   label: "Document",        color: "text-slate-600 bg-slate-50"  },
};

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; ring: string }> = {
  urgent: { label: "Urgent", color: "bg-red-100 text-red-700",    ring: "border-red-200 ring-1 ring-red-100" },
  high:   { label: "High",   color: "bg-amber-100 text-amber-700", ring: "border-amber-200"                  },
  normal: { label: "Normal", color: "bg-slate-100 text-slate-600", ring: "border-card-border"                },
};

function ApprovalCard({ item, onApprove, onReject }: {
  item: Approval; onApprove: (id: number) => void; onReject: (id: number, reason: string) => void;
}) {
  const [expanded, setExpanded]     = useState(false);
  const [rejectMode, setRejectMode] = useState(false);
  const [reason, setReason]         = useState("");
  const typeConf = TYPE_CONFIG[item.type];
  const Icon     = typeConf.icon;
  const pConf    = PRIORITY_CONFIG[item.priority];

  return (
    <div className={cn("bg-card border rounded-xl overflow-hidden transition-all hover:shadow-md", pConf.ring)}>
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <div className={cn("p-2 rounded-lg flex-shrink-0 mt-0.5", typeConf.color)}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-foreground text-sm leading-snug">{item.title}</p>
              <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap", pConf.color)}>{pConf.label}</span>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground whitespace-nowrap hidden sm:inline">{typeConf.label}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-snug">{item.description}</p>

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px] sm:text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Users className="w-3 h-3 flex-shrink-0" />{item.submittedBy} · {item.submittedRole}</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3 flex-shrink-0" />{item.submittedAt}</span>
              {item.project && (
                <span className="flex items-center gap-1"><Building2 className="w-3 h-3 flex-shrink-0" />{item.project}{item.unit ? ` · ${item.unit}` : ""}</span>
              )}
              {item.amount   && <span className="font-semibold text-foreground">{formatCurrency(item.amount)}</span>}
              {item.fromValue && <span className="whitespace-nowrap">{item.fromValue} → <span className="font-semibold text-foreground">{item.toValue}</span></span>}
            </div>
          </div>
        </div>

        {/* Reject reason */}
        {rejectMode && (
          <div className="mt-3 pt-3 border-t border-border">
            <label className="text-xs font-medium text-foreground block mb-1">Reason for rejection (required)</label>
            <textarea
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              rows={2} placeholder="Enter reason..." value={reason} onChange={(e) => setReason(e.target.value)}
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => { if (reason.trim()) { onReject(item.id, reason); setRejectMode(false); } }}
                disabled={!reason.trim()}
                className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40 transition-colors"
              >Confirm Rejection</button>
              <button onClick={() => setRejectMode(false)}
                className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-muted transition-colors">Cancel</button>
            </div>
          </div>
        )}

        {/* Actions */}
        {!rejectMode && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
            <button onClick={() => onApprove(item.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
              <CheckCircle2 className="w-3.5 h-3.5" />Approve
            </button>
            <button onClick={() => setRejectMode(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors">
              <XCircle className="w-3.5 h-3.5" />Reject
            </button>
            <button onClick={() => setExpanded(!expanded)}
              className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              {expanded ? "Less" : "Details"}
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        )}

        {expanded && (
          <p className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground leading-relaxed">
            Submitted by <strong>{item.submittedBy}</strong> ({item.submittedRole}) {item.submittedAt}.
            {item.project && ` Project: ${item.project}.`}
            {item.unit    && ` Unit: ${item.unit}.`}
            {item.amount  && ` Financial impact: ${formatCurrency(item.amount)}.`}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── PAGE ────────────────────────────────────────────────────────────── */
export default function ApprovalsPage() {
  const [items, setItems]         = useState<Approval[]>(INITIAL_APPROVALS);
  const [filterType, setFilterType] = useState<ApprovalType | "all">("all");
  const [showAudit, setShowAudit] = useState(false);
  const { toast } = useToast();

  const pending      = items.filter(i => i.status === "pending");
  const filtered     = filterType === "all" ? pending : pending.filter(i => i.type === filterType);
  const urgentCount  = pending.filter(i => i.priority === "urgent").length;

  function approve(id: number) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, status: "approved" } : i));
    toast({ title: "Approved ✓", description: "Change is now live." });
  }
  function reject(id: number, reason: string) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, status: "rejected" } : i));
    toast({ title: "Rejected", description: `Reason: "${reason}"`, variant: "destructive" });
  }

  const typeOptions: { value: ApprovalType | "all"; label: string }[] = [
    { value: "all",             label: "All Types" },
    { value: "lead_conversion", label: "Conversions" },
    { value: "unit_status",     label: "Unit Status" },
    { value: "price_change",    label: "Price Changes" },
    { value: "expense",         label: "Expenses" },
    { value: "document",        label: "Documents" },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2 flex-wrap">
            Approvals
            {urgentCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                <AlertTriangle className="w-3 h-3" />{urgentCount} urgent
              </span>
            )}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Review and action pending change requests from your team</p>
        </div>
        <button onClick={() => setShowAudit(!showAudit)}
          className="text-xs sm:text-sm text-primary hover:underline whitespace-nowrap flex-shrink-0">
          {showAudit ? "Hide" : "View"} audit trail
        </button>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Pending",     value: pending.length,                                           icon: Clock,        cls: "border-l-amber-500  bg-amber-50  text-amber-600"  },
          { label: "Urgent",      value: pending.filter(i => i.priority === "urgent").length,      icon: AlertTriangle, cls: "border-l-red-500    bg-red-50    text-red-600"    },
          { label: "Conversions", value: pending.filter(i => i.type === "lead_conversion").length, icon: Users,        cls: "border-l-green-500  bg-green-50  text-green-600"  },
          { label: "Price Chg",   value: pending.filter(i => i.type === "price_change").length,    icon: DollarSign,   cls: "border-l-blue-500   bg-blue-50   text-blue-600"   },
        ].map(({ label, value, icon: Icon, cls }) => {
          const [border, bg, text] = cls.split(/\s+/);
          return (
            <div key={label} className={cn("bg-card border border-card-border border-l-4 rounded-xl p-3 sm:p-4 flex items-center gap-3", border)}>
              <div className={cn("p-2 rounded-lg flex-shrink-0", bg, text)}><Icon className="w-4 h-4" /></div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-foreground">{value}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter tabs */}
      <div className="overflow-x-auto scrollbar-hide -mx-1 px-1 scroll-touch">
        <div className="flex gap-1.5 min-w-max pb-1">
          {typeOptions.map(opt => {
            const count = opt.value === "all" ? pending.length : pending.filter(i => i.type === opt.value).length;
            return (
              <button key={opt.value} onClick={() => setFilterType(opt.value as ApprovalType | "all")}
                className={cn("px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap",
                  filterType === opt.value ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary hover:text-primary")}>
                {opt.label}
                {count > 0 && <span className="ml-1.5 opacity-70">({count})</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Approval cards */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-card-border rounded-xl py-14 text-center">
          <CheckCircle2 className="w-10 h-10 mx-auto text-green-400 mb-3" />
          <p className="text-base font-semibold text-foreground">All clear!</p>
          <p className="text-sm text-muted-foreground mt-1">No pending approvals in this category.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => <ApprovalCard key={item.id} item={item} onApprove={approve} onReject={reject} />)}
        </div>
      )}

      {/* Audit Trail */}
      {showAudit && (
        <div className="bg-card border border-card-border rounded-xl p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />Audit Trail — Recent Actions
          </h2>
          <ul className="divide-y divide-border">
            {AUDIT_LOG.map(log => (
              <li key={log.id} className="py-3 flex items-start gap-3">
                <span className={cn("w-2 h-2 rounded-full mt-1.5 flex-shrink-0", log.action === "approved" ? "bg-green-500" : "bg-red-500")} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">
                    <span className={cn("font-semibold", log.action === "approved" ? "text-green-600" : "text-red-600")}>
                      {log.action === "approved" ? "Approved" : "Rejected"}
                    </span>{" · "}{log.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{log.detail} · {log.by}</p>
                </div>
                <span className="text-[10px] text-muted-foreground flex-shrink-0 whitespace-nowrap">{log.at}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
