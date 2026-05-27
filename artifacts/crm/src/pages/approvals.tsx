import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2, XCircle, Clock, AlertTriangle, Building2, Users,
  DollarSign, FileText,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";

type ApprovalRecord = {
  id: number; type: string; requestedBy: number | null; requestedByName: string;
  entityId: number | null; entityName: string; details: string; status: string;
  reviewedBy: number | null; reviewedByName: string | null; reviewNote: string | null;
  createdAt: string; updatedAt: string;
};

const TYPE_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  unit_block:    { icon: Building2,  label: "Unit Block",    color: "text-blue-600 bg-blue-50"    },
  price_discount:{ icon: DollarSign, label: "Price Discount",color: "text-amber-600 bg-amber-50"  },
  payment_plan:  { icon: FileText,   label: "Payment Plan",  color: "text-purple-600 bg-purple-50" },
  other:         { icon: FileText,   label: "Other",         color: "text-slate-600 bg-slate-50"  },
};

function ApprovalCard({ item, canReview, onApprove, onReject }: {
  item: ApprovalRecord; canReview: boolean;
  onApprove: (id: number) => void; onReject: (id: number, reason: string) => void;
}) {
  const [rejectMode, setRejectMode] = useState(false);
  const [reason, setReason] = useState("");

  const typeConf = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.other;
  const Icon = typeConf.icon;

  let detailsObj: Record<string, unknown> = {};
  try { detailsObj = JSON.parse(item.details); } catch { /* plain string */ }

  const isReviewed = item.status !== "pending";

  return (
    <div className={cn("bg-card border rounded-xl overflow-hidden", isReviewed ? "opacity-70" : "hover:shadow-md transition-shadow")}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn("p-2 rounded-lg flex-shrink-0 mt-0.5", typeConf.color)}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-foreground text-sm leading-snug">{item.entityName}</p>
              <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0",
                item.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                item.status === "approved" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              )}>{item.status}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{typeConf.label} · {item.details.startsWith("{") ? JSON.stringify(detailsObj) : item.details}</p>
            <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Users className="w-3 h-3" />{item.requestedByName}</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDate(item.createdAt)}</span>
            </div>
            {isReviewed && item.reviewedByName && (
              <p className="text-xs text-muted-foreground mt-1">
                Reviewed by {item.reviewedByName}{item.reviewNote ? ` — "${item.reviewNote}"` : ""}
              </p>
            )}
          </div>
        </div>

        {rejectMode && (
          <div className="mt-3 pt-3 border-t border-border">
            <label className="text-xs font-medium text-foreground block mb-1">Reason for rejection (required)</label>
            <textarea className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" rows={2} placeholder="Enter reason..." value={reason} onChange={e => setReason(e.target.value)} />
            <div className="flex gap-2 mt-2">
              <button onClick={() => { if (reason.trim()) { onReject(item.id, reason); setRejectMode(false); } }} disabled={!reason.trim()} className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40 transition-colors">Confirm Rejection</button>
              <button onClick={() => setRejectMode(false)} className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-muted transition-colors">Cancel</button>
            </div>
          </div>
        )}

        {!rejectMode && !isReviewed && canReview && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
            <button onClick={() => onApprove(item.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
              <CheckCircle2 className="w-3.5 h-3.5" />Approve
            </button>
            <button onClick={() => setRejectMode(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors">
              <XCircle className="w-3.5 h-3.5" />Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ApprovalsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showReviewed, setShowReviewed] = useState(false);
  const canReview = ["owner", "cfo", "manager"].includes(user?.role ?? "");

  const { data: allApprovals = [], isLoading } = useQuery<ApprovalRecord[]>({
    queryKey: ["approvals"],
    queryFn: () => customFetch<ApprovalRecord[]>("/api/approvals"),
    refetchInterval: 30000,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status, reviewNote }: { id: number; status: string; reviewNote?: string }) =>
      customFetch(`/api/approvals/${id}`, { method: "PUT", body: JSON.stringify({ status, reviewNote }) }),
    onSuccess: (_, { status }) => {
      qc.invalidateQueries({ queryKey: ["approvals"] });
      toast({ title: status === "approved" ? "Approved ✓" : "Rejected", description: status === "approved" ? "Change is now live." : "Approval rejected." });
    },
    onError: () => toast({ title: "Action failed", variant: "destructive" }),
  });

  const pending = allApprovals.filter(a => a.status === "pending");
  const reviewed = allApprovals.filter(a => a.status !== "pending");

  function approve(id: number) { reviewMutation.mutate({ id, status: "approved" }); }
  function reject(id: number, reason: string) { reviewMutation.mutate({ id, status: "rejected", reviewNote: reason }); }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2 flex-wrap">
            Approvals
            {pending.length > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                <Clock className="w-3 h-3" />{pending.length} pending
              </span>
            )}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Approvals are created when agents block units, request discounts, or create special payment plans.
          </p>
        </div>
        <button onClick={() => setShowReviewed(!showReviewed)} className="text-xs sm:text-sm text-primary hover:underline whitespace-nowrap flex-shrink-0">
          {showReviewed ? "Hide" : "Show"} reviewed
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Pending",  value: pending.length,                               icon: Clock,        cls: "text-amber-600 bg-amber-50  border-amber-200"  },
          { label: "Unit Block",value: pending.filter(a => a.type === "unit_block").length, icon: Building2, cls: "text-blue-600 bg-blue-50 border-blue-200"   },
          { label: "Discounts",value: pending.filter(a => a.type === "price_discount").length, icon: DollarSign, cls: "text-purple-600 bg-purple-50 border-purple-200" },
          { label: "Approved", value: reviewed.filter(a => a.status === "approved").length, icon: CheckCircle2, cls: "text-green-600 bg-green-50 border-green-200" },
        ].map(({ label, value, icon: Icon, cls }) => (
          <div key={label} className="bg-card border border-card-border rounded-xl p-3 sm:p-4 flex items-center gap-3">
            <div className={cn("p-2 rounded-lg flex-shrink-0", cls)}><Icon className="w-4 h-4" /></div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-foreground">{value}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : pending.length === 0 && !showReviewed ? (
        <div className="bg-card border border-card-border rounded-xl py-14 text-center">
          <CheckCircle2 className="w-10 h-10 mx-auto text-green-400 mb-3" />
          <p className="text-base font-semibold text-foreground">All clear!</p>
          <p className="text-sm text-muted-foreground mt-1">No pending approvals. They appear here when agents block units or request discounts.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map(item => (
            <ApprovalCard key={item.id} item={item} canReview={canReview} onApprove={approve} onReject={reject} />
          ))}
          {showReviewed && reviewed.length > 0 && (
            <>
              <h3 className="text-sm font-medium text-muted-foreground pt-2">Reviewed</h3>
              {reviewed.map(item => (
                <ApprovalCard key={item.id} item={item} canReview={false} onApprove={approve} onReject={reject} />
              ))}
            </>
          )}
        </div>
      )}

      {!isLoading && !canReview && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-2">
          <AlertTriangle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-700">Only managers and owners can approve or reject requests. Your requests submitted for approval will appear here.</p>
        </div>
      )}
    </div>
  );
}
