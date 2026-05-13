import { useState, useMemo } from "react";
import { useGetLeads, useGetAgents, useGetProperties, getGetLeadsQueryKey, getGetPropertiesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Phone, Home, TrendingUp, CheckCircle2, Clock, Search, Plus, Download,
  Calendar, MessageSquare, ChevronRight, X, ArrowUpDown, MessageCircle, Loader2, Trash2,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { useRole } from "@/lib/role-context";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useActivities, type ScheduledActivity, type CreateActivityInput, type UpdateActivityInput } from "@/lib/use-activities";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";

/* ─── Types ───────────────────────────────────────────────────────────── */
type ActivityType =
  | "fresh_lead" | "phone" | "site_visit_follow" | "site_visit"
  | "nego_followup" | "negotiation" | "sale" | "sale_done";

type ActivityStatus = "pending" | "completed" | "cancelled";

interface Activity {
  id: number;
  customer: string;
  phone: string;
  employee: string;
  createdDate: string;
  activityType: ActivityType;
  source: string;
  project: string;
  activityDate: string;
  activityTime: string;
  lastRemark: string;
  status: ActivityStatus;
  budget?: number;
  agentId?: number | null;
}

/* ─── Config ──────────────────────────────────────────────────────────── */
const ACTIVITY_TYPES: { id: ActivityType; label: string; color: string; icon: React.ElementType }[] = [
  { id: "fresh_lead",        label: "Fresh Leads",       color: "bg-blue-100 text-blue-700 border-blue-200",      icon: Plus },
  { id: "phone",             label: "Phone",             color: "bg-purple-100 text-purple-700 border-purple-200", icon: Phone },
  { id: "site_visit_follow", label: "Site Visit Follow", color: "bg-cyan-100 text-cyan-700 border-cyan-200",       icon: MessageSquare },
  { id: "site_visit",        label: "Site Visit",        color: "bg-teal-100 text-teal-700 border-teal-200",       icon: Home },
  { id: "nego_followup",     label: "Nego Followup",     color: "bg-orange-100 text-orange-700 border-orange-200", icon: Clock },
  { id: "negotiation",       label: "Negotiation",       color: "bg-amber-100 text-amber-700 border-amber-200",    icon: TrendingUp },
  { id: "sale",              label: "Sale",              color: "bg-green-100 text-green-700 border-green-200",    icon: CheckCircle2 },
  { id: "sale_done",         label: "Sale Done",         color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
];

const TIME_TABS = [
  { id: "overall",   label: "Overall activities" },
  { id: "today",     label: "Today activities" },
  { id: "tomorrow",  label: "Tomorrow activities" },
  { id: "pending",   label: "Pending activities" },
  { id: "future",    label: "Future activities" },
  { id: "completed", label: "Completed activities" },
  { id: "assignee",  label: "Assignee by me" },
];

const SOURCE_OPTIONS = ["Website", "Google", "99acres", "MagicBricks", "Housing", "Facebook", "Referral", "Phone", "Walk-in", "WhatsApp", "IVR", "Other"];
const PROJECT_OPTIONS = ["Prestige Lakeside", "Godrej Summit", "DLF Cybercity", "Sobha Royal Crest"];

/* ─── Helpers ─────────────────────────────────────────────────────────── */
function todayStr() { return new Date().toISOString().slice(0, 10); }
function tomorrowStr() { return new Date(Date.now() + 86400000).toISOString().slice(0, 10); }

function toActivity(a: ScheduledActivity): Activity {
  return {
    id: a.id,
    customer: a.customer,
    phone: a.phone ?? "",
    employee: a.employeeName ?? "",
    createdDate: a.createdAt.slice(0, 10),
    activityType: (a.activityType as ActivityType) ?? "phone",
    source: a.source ?? "",
    project: a.project ?? "",
    activityDate: a.activityDate,
    activityTime: a.activityTime ?? "",
    lastRemark: a.lastRemark ?? "",
    status: (a.status as ActivityStatus) ?? "pending",
    budget: a.budget != null ? Number(a.budget) : undefined,
    agentId: a.agentId,
  };
}

function getTimeCategory(act: Activity): string {
  const today = todayStr();
  const tomorrow = tomorrowStr();
  if (act.status === "completed") return "completed";
  if (act.activityDate < today) return "pending";
  if (act.activityDate === today) return "today";
  if (act.activityDate === tomorrow) return "tomorrow";
  return "future";
}

function activityTypeConfig(type: ActivityType) {
  return ACTIVITY_TYPES.find(t => t.id === type) ?? ACTIVITY_TYPES[0];
}

function exportCSV(activities: Activity[]) {
  const headers = ["Customer", "Phone", "Employee", "Created Date", "Activity Type", "Source", "Project", "Activity Date", "Activity Time", "Last Remark", "Status"];
  const rows = activities.map(a => [
    a.customer, a.phone, a.employee, a.createdDate, activityTypeConfig(a.activityType).label,
    a.source, a.project, a.activityDate, a.activityTime, a.lastRemark, a.status,
  ]);
  const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "activities.csv"; a.click();
  URL.revokeObjectURL(url);
}

/* ─── Schedule Activity Dialog ───────────────────────────────────────── */
function ScheduleDialog({ open, onClose, onSave, customers }: {
  open: boolean; onClose: () => void;
  onSave: (input: CreateActivityInput) => Promise<void>;
  customers: string[];
}) {
  const { profile, role } = useRole();
  const isSales = role === "agent" || role === "broker";
  const canAssignOthers = role === "owner" || role === "manager";

  const { data: agents } = useGetAgents();
  const { data: properties } = useGetProperties({}, { query: { queryKey: getGetPropertiesQueryKey({}) } });
  const propertyTitles = (properties ?? []).map(p => p.title);
  const firstProperty = propertyTitles[0] ?? PROJECT_OPTIONS[0];

  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    customer: "", phone: "", agentId: "" as string,
    activityType: "phone" as ActivityType,
    source: "Website", project: firstProperty, activityDate: todayStr(),
    activityTime: "10:00 AM", lastRemark: "", budget: "",
  });

  async function handleSave() {
    if (!form.customer || submitting) return;
    setSubmitting(true);
    try {
      const selectedAgent = form.agentId ? (agents ?? []).find(a => a.id === Number(form.agentId)) : null;
      await onSave({
        activityType: form.activityType,
        customer: form.customer,
        phone: form.phone || null,
        employeeName: selectedAgent?.name ?? (isSales ? profile.name : null),
        agentId: form.agentId ? Number(form.agentId) : null,
        source: form.source || null,
        project: form.project || null,
        activityDate: form.activityDate,
        activityTime: form.activityTime || null,
        lastRemark: form.lastRemark || null,
        budget: form.budget ? Number(form.budget) : null,
      });
      setForm({ customer: "", phone: "", agentId: "", activityType: "phone", source: "Website", project: firstProperty, activityDate: todayStr(), activityTime: "10:00 AM", lastRemark: "", budget: "" });
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-card rounded-xl border border-border shadow-xl w-full max-w-md p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground flex items-center gap-2"><Calendar className="w-4 h-4 text-primary" />Schedule Activity</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs font-medium text-muted-foreground block mb-1">Customer Name *</label>
            <input value={form.customer} onChange={e => setForm(p => ({ ...p, customer: e.target.value }))}
              placeholder="Enter customer name" list="customer-list"
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
            <datalist id="customer-list">{customers.map(c => <option key={c} value={c} />)}</datalist>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Phone</label>
            <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+91 xxxxx xxxxx"
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Assigned To {isSales && <span className="text-primary">(you)</span>}
            </label>
            {canAssignOthers ? (
              <select value={form.agentId} onChange={e => setForm(p => ({ ...p, agentId: e.target.value }))}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="">— Select agent —</option>
                {(agents ?? []).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            ) : (
              <input value={profile.name} readOnly
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-muted/50 text-muted-foreground cursor-not-allowed" />
            )}
          </div>

          <div className="col-span-2">
            <label className="text-xs font-medium text-muted-foreground block mb-1">Activity Type *</label>
            <div className="grid grid-cols-2 gap-1.5">
              {ACTIVITY_TYPES.filter(t => t.id !== "sale_done").map(t => (
                <button key={t.id} onClick={() => setForm(p => ({ ...p, activityType: t.id }))}
                  className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all",
                    form.activityType === t.id ? t.color + " ring-2 ring-offset-1 ring-primary/40" : "border-border text-muted-foreground hover:border-primary/40")}>
                  <t.icon className="w-3 h-3" />{t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Source</label>
            <select value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
              {SOURCE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Property / Project</label>
            <select value={form.project} onChange={e => setForm(p => ({ ...p, project: e.target.value }))}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
              {(propertyTitles.length > 0 ? propertyTitles : PROJECT_OPTIONS).map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Activity Date *</label>
            <input type="date" value={form.activityDate} onChange={e => setForm(p => ({ ...p, activityDate: e.target.value }))}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Activity Time</label>
            <input type="time" value={form.activityTime.replace(" AM","").replace(" PM","")} onChange={e => {
              const [h, m] = e.target.value.split(":"); const hr = Number(h);
              setForm(p => ({ ...p, activityTime: `${hr > 12 ? hr - 12 : hr || 12}:${m} ${hr >= 12 ? "PM" : "AM"}` }));
            }} className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Budget (₹)</label>
            <input type="number" value={form.budget} onChange={e => setForm(p => ({ ...p, budget: e.target.value }))} placeholder="e.g. 8500000"
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>

          <div className="col-span-2">
            <label className="text-xs font-medium text-muted-foreground block mb-1">Remark / Note</label>
            <textarea value={form.lastRemark} onChange={e => setForm(p => ({ ...p, lastRemark: e.target.value }))} rows={2}
              placeholder="Add a note about this activity..."
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button disabled={!form.customer || submitting} onClick={handleSave}
            className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Schedule Activity
          </button>
          <button onClick={onClose} disabled={submitting} className="flex-1 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted/50 transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Remark Edit Popover ────────────────────────────────────────────── */
function RemarkCell({ activity, onUpdate }: { activity: Activity; onUpdate: (id: number, remark: string, status: ActivityStatus) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(activity.lastRemark);

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input value={val} onChange={e => setVal(e.target.value)} autoFocus
          className="text-xs border border-border rounded px-2 py-1 bg-background w-36 focus:outline-none focus:ring-1 focus:ring-primary/30"
          onKeyDown={e => { if (e.key === "Enter") { onUpdate(activity.id, val, activity.status); setEditing(false); } if (e.key === "Escape") setEditing(false); }}
        />
        <button onClick={() => { onUpdate(activity.id, val, activity.status); setEditing(false); }} className="text-green-600 hover:text-green-700"><CheckCircle2 className="w-3.5 h-3.5" /></button>
        <button onClick={() => { setVal(activity.lastRemark); setEditing(false); }} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
      </div>
    );
  }
  return (
    <button onClick={() => setEditing(true)} className="text-left text-xs text-muted-foreground hover:text-foreground group flex items-center gap-1 max-w-[160px]">
      <span className="truncate">{activity.lastRemark || "Add remark..."}</span>
      <MessageSquare className="w-3 h-3 opacity-0 group-hover:opacity-100 flex-shrink-0 text-primary" />
    </button>
  );
}

/* ─── Status Dropdown ────────────────────────────────────────────────── */
const STATUS_OPTIONS: { value: ActivityStatus; label: string; color: string }[] = [
  { value: "pending",   label: "Pending",   color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "completed", label: "Done",      color: "bg-green-100 text-green-700 border-green-200" },
  { value: "cancelled", label: "Cancelled", color: "bg-red-100 text-red-600 border-red-200" },
];

function StatusToggle({ activity, onUpdate }: { activity: Activity; onUpdate: (id: number, remark: string, status: ActivityStatus) => void }) {
  const [open, setOpen] = useState(false);
  const current = STATUS_OPTIONS.find(s => s.value === activity.status) ?? STATUS_OPTIONS[0];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap transition-colors hover:opacity-80", current.color)}
      >
        {activity.status === "completed" ? <CheckCircle2 className="w-2.5 h-2.5" /> : activity.status === "cancelled" ? <X className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
        {current.label}
        <ChevronRight className="w-2.5 h-2.5 rotate-90 -mr-0.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 bg-card border border-border rounded-lg shadow-xl overflow-hidden min-w-[110px]">
            {STATUS_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => { onUpdate(activity.id, activity.lastRemark, opt.value); setOpen(false); }}
                className={cn("w-full flex items-center gap-2 px-3 py-2 text-[11px] font-medium hover:bg-muted/50 transition-colors text-left",
                  activity.status === opt.value && "bg-muted/40")}
              >
                <span className={cn("w-2 h-2 rounded-full flex-shrink-0",
                  opt.value === "completed" ? "bg-green-500" : opt.value === "cancelled" ? "bg-red-400" : "bg-amber-400")} />
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Skeleton row ───────────────────────────────────────────────────── */
function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: 11 }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <div className="h-3 bg-muted rounded w-full max-w-[80px]" />
        </td>
      ))}
    </tr>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────── */
export default function ActivitiesPage() {
  const { profile, role } = useRole();
  const isSales = role === "agent" || role === "broker";
  const canSendWhatsApp = role === "owner" || role === "manager";
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: rawActivities, isLoading, create, update, remove } = useActivities();
  const activities = useMemo(() => rawActivities.map(toActivity), [rawActivities]);

  const [timeTab, setTimeTab] = useState<string>(isSales ? "assignee" : "overall");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [sortAsc, setSortAsc] = useState(true);
  const [deleteActivityId, setDeleteActivityId] = useState<number | null>(null);
  const [deleteActivityCustomer, setDeleteActivityCustomer] = useState("");

  const { data: leads } = useGetLeads({}, { query: { queryKey: getGetLeadsQueryKey({}) } });
  const customerNames = useMemo(() => (leads ?? []).map(l => l.name), [leads]);

  /* Filter by time tab */
  const timeFiltered = useMemo(() => {
    const base = activities;
    if (timeTab === "overall" || timeTab === "assignee") return base;
    return base.filter(a => getTimeCategory(a) === timeTab);
  }, [activities, timeTab]);

  /* Counts per type */
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: timeFiltered.length };
    ACTIVITY_TYPES.forEach(t => { counts[t.id] = timeFiltered.filter(a => a.activityType === t.id).length; });
    return counts;
  }, [timeFiltered]);

  /* Apply type filter + search + sort */
  const displayed = useMemo(() => {
    let list = typeFilter === "all" ? timeFiltered : timeFiltered.filter(a => a.activityType === typeFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        a.customer.toLowerCase().includes(q) ||
        a.phone.includes(q) ||
        a.employee.toLowerCase().includes(q) ||
        a.source.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      const diff = a.activityDate.localeCompare(b.activityDate);
      return sortAsc ? diff : -diff;
    });
  }, [timeFiltered, typeFilter, search, sortAsc]);

  async function handleAddActivity(input: CreateActivityInput) {
    const result = await create.mutateAsync(input);
    if (result) {
      toast({ title: "Activity scheduled" });
    } else {
      toast({ title: "Failed to schedule activity", variant: "destructive" });
    }
  }

  function updateActivity(id: number, remark: string, status: ActivityStatus) {
    const act = activities.find(a => a.id === id);
    update.mutate({ id, lastRemark: remark, status });
    if (status === "cancelled") {
      toast({ title: "Activity cancelled" });
    } else if (status === "completed") {
      if (canSendWhatsApp && act?.activityType === "phone") {
        toast({
          title: `Call with ${act.customer} completed`,
          description: "Send a WhatsApp welcome message?",
          action: (
            <button
              onClick={() => setLocation("/whatsapp")}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg font-medium hover:bg-green-700 transition-colors whitespace-nowrap"
            >
              <MessageCircle className="w-3.5 h-3.5" />Send Welcome
            </button>
          ) as any,
        });
      } else {
        toast({ title: "Activity marked as done" });
      }
    }
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <ScheduleDialog open={scheduleOpen} onClose={() => setScheduleOpen(false)} onSave={handleAddActivity} customers={customerNames} />
      <ConfirmDeleteDialog
        open={deleteActivityId !== null}
        onOpenChange={(open) => { if (!open) setDeleteActivityId(null); }}
        onConfirm={() => {
          if (deleteActivityId) {
            remove.mutate(deleteActivityId, {
              onSuccess: () => { setDeleteActivityId(null); toast({ title: "Activity deleted" }); },
              onError: () => toast({ title: "Failed to delete activity", variant: "destructive" }),
            });
          }
        }}
        title="Delete Activity"
        description={`Are you sure you want to delete the activity for "${deleteActivityCustomer}"? This action cannot be undone.`}
        loading={remove.isPending}
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">{greeting}, {profile.name.split(" ")[0]}!</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{isSales ? "Your assigned activities — calls, visits, and follow-ups." : "Track and manage all customer activities — calls, visits, negotiations, and closings."}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => exportCSV(displayed)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-border rounded-lg font-medium hover:bg-muted/50 transition-colors text-muted-foreground">
            <Download className="w-3.5 h-3.5" />Export
          </button>
          <button onClick={() => setScheduleOpen(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity">
            <Plus className="w-3.5 h-3.5" />Schedule Activity
          </button>
        </div>
      </div>

      {/* Time tabs */}
      <div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
        <div className="flex gap-0.5 border-b border-border min-w-max">
          {TIME_TABS.filter(tab => isSales ? tab.id !== "assignee" : true).map(tab => (
            <button key={tab.id} onClick={() => { setTimeTab(tab.id); setTypeFilter("all"); }}
              className={cn("px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
                timeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
              {isSales && tab.id === "overall" ? "My Activities" : tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Type filter pills */}
      <div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
        <div className="flex gap-2 min-w-max pb-1">
          <button onClick={() => setTypeFilter("all")}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
              typeFilter === "all" ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:border-foreground/40")}>
            ALL<span className="ml-1 font-bold">{typeCounts.all}</span>
          </button>
          {ACTIVITY_TYPES.map(t => (
            <button key={t.id} onClick={() => setTypeFilter(t.id)}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                typeFilter === t.id ? t.color + " border-transparent" : "border-border text-muted-foreground hover:border-foreground/30")}>
              <t.icon className="w-3 h-3" />
              {t.label}
              {typeCounts[t.id] > 0 && <span className="font-bold">{typeCounts[t.id]}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Search + summary */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-xs border border-border rounded-lg px-3 py-1.5 bg-background">
          <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customer, employee, source..."
            className="text-sm bg-transparent flex-1 outline-none text-foreground placeholder:text-muted-foreground" />
          {search && <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>}
        </div>
        <p className="text-xs text-muted-foreground whitespace-nowrap">TOTAL: <span className="font-semibold text-foreground">{displayed.length} RECORDS</span></p>
      </div>

      {/* Activity table */}
      <div className="bg-card border border-card-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 900 }}>
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                {[
                  "Customer", "Phone", "Employee", "Created Date",
                  "Scheduled Activity", "Source Name", "Activity Date",
                  "Activity Time", "Last Remark", "Status", "",
                ].map(label => (
                  <th key={label} className="text-left px-3 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                    {label === "Activity Date" ? (
                      <button onClick={() => setSortAsc(p => !p)} className="flex items-center gap-1 hover:text-foreground transition-colors">
                        {label}<ArrowUpDown className="w-3 h-3" />
                      </button>
                    ) : label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              ) : displayed.length === 0 ? (
                <tr><td colSpan={11} className="py-12 text-center text-sm text-muted-foreground">No activities found</td></tr>
              ) : displayed.map(act => {
                const typeConf = activityTypeConfig(act.activityType);
                const isToday = act.activityDate === todayStr();
                const isPast = act.activityDate < todayStr() && act.status !== "completed";
                return (
                  <tr key={act.id} className={cn("hover:bg-muted/20 transition-colors", isPast && act.status !== "completed" && "bg-red-50/30")}>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                          {act.customer.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground text-xs whitespace-nowrap">{act.customer}</p>
                          {act.budget && <p className="text-[10px] text-muted-foreground">{formatCurrency(act.budget)}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      <a href={`tel:${act.phone}`} className="hover:text-primary transition-colors flex items-center gap-1">
                        <Phone className="w-3 h-3" />{act.phone}
                      </a>
                    </td>
                    <td className="px-3 py-3 text-xs font-medium text-foreground whitespace-nowrap">{act.employee}</td>
                    <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">{act.createdDate}</td>
                    <td className="px-3 py-3">
                      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap", typeConf.color)}>
                        <typeConf.icon className="w-2.5 h-2.5" />{typeConf.label}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">{act.source}</td>
                    <td className="px-3 py-3">
                      <span className={cn("text-xs font-medium whitespace-nowrap",
                        isToday ? "text-primary font-semibold" : isPast && act.status !== "completed" ? "text-red-600" : "text-foreground")}>
                        {act.activityDate}
                        {isToday && <span className="ml-1 text-[9px] bg-primary/10 text-primary px-1 rounded">Today</span>}
                        {isPast && act.status !== "completed" && <span className="ml-1 text-[9px] bg-red-100 text-red-600 px-1 rounded">Overdue</span>}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{act.activityTime}</span>
                    </td>
                    <td className="px-3 py-3">
                      <RemarkCell activity={act} onUpdate={updateActivity} />
                    </td>
                    <td className="px-3 py-3">
                      <StatusToggle activity={act} onUpdate={updateActivity} />
                    </td>
                    <td className="px-3 py-3">
                      {(role === "owner" || isSales) && (
                        <button
                          onClick={() => { setDeleteActivityCustomer(act.customer); setDeleteActivityId(act.id); }}
                          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          title="Delete activity"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
          <p className="text-xs text-muted-foreground">
            activity_date — {sortAsc ? "ASC" : "DESC"}
          </p>
          <button onClick={() => exportCSV(displayed)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity">
            <Download className="w-3 h-3" />Click To Download
          </button>
        </div>
      </div>
    </div>
  );
}
