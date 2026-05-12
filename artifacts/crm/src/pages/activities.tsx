import { useState, useMemo } from "react";
import { useGetLeads, useGetAgents, getGetLeadsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Phone, Home, TrendingUp, CheckCircle2, Clock, Search, Plus, Download,
  Calendar, MessageSquare, ChevronRight, X, ArrowUpDown, MessageCircle,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { useRole } from "@/lib/role-context";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

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
}

/* ─── Config ──────────────────────────────────────────────────────────── */
const ACTIVITY_TYPES: { id: ActivityType; label: string; color: string; icon: React.ElementType }[] = [
  { id: "fresh_lead",       label: "Fresh Leads",       color: "bg-blue-100 text-blue-700 border-blue-200",     icon: Plus },
  { id: "phone",            label: "Phone",             color: "bg-purple-100 text-purple-700 border-purple-200", icon: Phone },
  { id: "site_visit_follow",label: "Site Visit Follow", color: "bg-cyan-100 text-cyan-700 border-cyan-200",      icon: MessageSquare },
  { id: "site_visit",       label: "Site Visit",        color: "bg-teal-100 text-teal-700 border-teal-200",      icon: Home },
  { id: "nego_followup",    label: "Nego Followup",     color: "bg-orange-100 text-orange-700 border-orange-200",icon: Clock },
  { id: "negotiation",      label: "Negotiation",       color: "bg-amber-100 text-amber-700 border-amber-200",   icon: TrendingUp },
  { id: "sale",             label: "Sale",              color: "bg-green-100 text-green-700 border-green-200",   icon: CheckCircle2 },
  { id: "sale_done",        label: "Sale Done",         color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
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

/* ─── Mock data ───────────────────────────────────────────────────────── */
function todayStr() { return new Date().toISOString().slice(0, 10); }
function tomorrowStr() { return new Date(Date.now() + 86400000).toISOString().slice(0, 10); }
function daysAgo(n: number) { return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10); }
function daysAhead(n: number) { return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10); }

const INITIAL_ACTIVITIES: Activity[] = [
  { id: 1,  customer: "Amit Jain",          phone: "9831...",  employee: "Riya Sharma",  createdDate: daysAgo(10), activityType: "site_visit",        source: "99acres",    project: "Godrej Summit",       activityDate: todayStr(),      activityTime: "10:00 AM", lastRemark: "Interested in 3BHK", status: "pending",   budget: 85_00_000 },
  { id: 2,  customer: "Sunita Sharma",       phone: "7304...",  employee: "Arjun Mehta",  createdDate: daysAgo(5),  activityType: "sale",              source: "Google",     project: "Prestige Lakeside",   activityDate: todayStr(),      activityTime: "12:30 PM", lastRemark: "Ready to finalize",  status: "pending",   budget: 1_20_00_000 },
  { id: 3,  customer: "Vikram Singh",        phone: "9820...",  employee: "Pooja Nair",   createdDate: daysAgo(3),  activityType: "fresh_lead",        source: "Facebook",   project: "Sobha Royal Crest",   activityDate: todayStr(),      activityTime: "02:00 PM", lastRemark: "New inquiry",        status: "pending",   budget: 65_00_000 },
  { id: 4,  customer: "Deepa Nair",          phone: "9695...",  employee: "Rahul Gupta",  createdDate: daysAgo(8),  activityType: "negotiation",       source: "Website",    project: "DLF Cybercity",       activityDate: todayStr(),      activityTime: "04:00 PM", lastRemark: "Price negotiation",  status: "pending",   budget: 2_50_00_000 },
  { id: 5,  customer: "Meera Patel",         phone: "9154...",  employee: "Sneha Joshi",  createdDate: daysAgo(2),  activityType: "phone",             source: "MagicBricks",project: "Prestige Lakeside",   activityDate: todayStr(),      activityTime: "11:00 AM", lastRemark: "Call back requested",status: "pending",   budget: 90_00_000 },
  { id: 6,  customer: "Sanjay Verma",        phone: "9441...",  employee: "Riya Sharma",  createdDate: daysAgo(1),  activityType: "site_visit",        source: "Google",     project: "Godrej Summit",       activityDate: tomorrowStr(),   activityTime: "09:30 AM", lastRemark: "Site visit confirmed",status:"pending",   budget: 1_10_00_000 },
  { id: 7,  customer: "Priya Kapoor",        phone: "9290...",  employee: "Arjun Mehta",  createdDate: daysAgo(4),  activityType: "site_visit_follow", source: "Housing",    project: "Sobha Royal Crest",   activityDate: tomorrowStr(),   activityTime: "11:00 AM", lastRemark: "Follow-up call done",status: "pending",   budget: 78_00_000 },
  { id: 8,  customer: "Ravi Kumar",          phone: "8073...",  employee: "Pooja Nair",   createdDate: daysAgo(15), activityType: "negotiation",       source: "Referral",   project: "DLF Cybercity",       activityDate: tomorrowStr(),   activityTime: "03:00 PM", lastRemark: "Final offer made",   status: "pending",   budget: 3_00_00_000 },
  { id: 9,  customer: "Kavitha Reddy",       phone: "7757...",  employee: "Rahul Gupta",  createdDate: daysAgo(6),  activityType: "nego_followup",     source: "Website",    project: "Prestige Lakeside",   activityDate: daysAhead(3),    activityTime: "10:00 AM", lastRemark: "Needs time to decide",status:"pending",   budget: 95_00_000 },
  { id: 10, customer: "Harish Babu",         phone: "9666...",  employee: "Riya Sharma",  createdDate: daysAgo(20), activityType: "sale_done",         source: "99acres",    project: "Godrej Summit",       activityDate: daysAgo(2),      activityTime: "02:00 PM", lastRemark: "Deal closed! ₹1.1Cr",status: "completed", budget: 1_10_00_000 },
  { id: 11, customer: "Anil Sharma",         phone: "9820...",  employee: "Sneha Joshi",  createdDate: daysAgo(25), activityType: "sale_done",         source: "Google",     project: "Prestige Lakeside",   activityDate: daysAgo(5),      activityTime: "11:00 AM", lastRemark: "Registry done",      status: "completed", budget: 85_00_000 },
  { id: 12, customer: "Fatima Sheikh",       phone: "8459...",  employee: "Pooja Nair",   createdDate: daysAgo(7),  activityType: "phone",             source: "Facebook",   project: "Sobha Royal Crest",   activityDate: daysAgo(3),      activityTime: "12:00 PM", lastRemark: "Not answering",      status: "pending",   budget: 60_00_000 },
  { id: 13, customer: "Gopal Rao",           phone: "9781...",  employee: "Arjun Mehta",  createdDate: daysAgo(12), activityType: "site_visit",        source: "Walk-in",    project: "DLF Cybercity",       activityDate: daysAgo(4),      activityTime: "03:30 PM", lastRemark: "Will decide this week",status:"pending",  budget: 2_00_00_000 },
  { id: 14, customer: "Latha Krishnan",      phone: "9346...",  employee: "Rahul Gupta",  createdDate: daysAgo(9),  activityType: "fresh_lead",        source: "IVR",        project: "Prestige Lakeside",   activityDate: daysAhead(5),    activityTime: "10:30 AM", lastRemark: "IVR lead - new",     status: "pending",   budget: 70_00_000 },
  { id: 15, customer: "Mohan Das",           phone: "8026...",  employee: "Riya Sharma",  createdDate: daysAgo(18), activityType: "sale",              source: "Google",     project: "Godrej Summit",       activityDate: daysAhead(2),    activityTime: "01:00 PM", lastRemark: "Loan approved, ready",status:"pending",  budget: 1_30_00_000 },
  { id: 16, customer: "Radha Menon",         phone: "9966...",  employee: "Sneha Joshi",  createdDate: daysAgo(3),  activityType: "site_visit_follow", source: "WhatsApp",   project: "Sobha Royal Crest",   activityDate: daysAhead(7),    activityTime: "11:30 AM", lastRemark: "Wants sea-facing unit",status:"pending",  budget: 1_50_00_000 },
  { id: 17, customer: "Suresh Nair",         phone: "9845...",  employee: "Arjun Mehta",  createdDate: daysAgo(30), activityType: "nego_followup",     source: "Referral",   project: "DLF Cybercity",       activityDate: daysAgo(10),     activityTime: "02:30 PM", lastRemark: "Dropped — budget issue",status:"pending", budget: 1_80_00_000 },
  { id: 18, customer: "Poonam Gupta",        phone: "9123...",  employee: "Pooja Nair",   createdDate: daysAgo(1),  activityType: "phone",             source: "99acres",    project: "Prestige Lakeside",   activityDate: daysAhead(1),    activityTime: "09:00 AM", lastRemark: "Scheduled callback",  status: "pending",  budget: 88_00_000 },
  { id: 19, customer: "Kiran Bhat",          phone: "9234...",  employee: "Rahul Gupta",  createdDate: daysAgo(22), activityType: "sale_done",         source: "MagicBricks",project: "Sobha Royal Crest",   activityDate: daysAgo(8),      activityTime: "03:00 PM", lastRemark: "Payment received",    status: "completed", budget: 95_00_000 },
  { id: 20, customer: "Am Builders Dev",     phone: "8026...",  employee: "Riya Sharma",  createdDate: daysAgo(14), activityType: "sale",              source: "Google",     project: "Godrej Summit",       activityDate: todayStr(),      activityTime: "12:19 PM", lastRemark: "Commercial deal pending",status:"pending", budget: 5_00_00_000 },
];

/* ─── Helper functions ───────────────────────────────────────────────── */
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
  onSave: (act: Omit<Activity, "id">) => void;
  customers: string[];
}) {
  const { profile } = useRole();
  const [form, setForm] = useState({
    customer: "", phone: "", employee: profile.name, activityType: "phone" as ActivityType,
    source: "Website", project: PROJECT_OPTIONS[0], activityDate: todayStr(),
    activityTime: "10:00 AM", lastRemark: "", budget: "",
  });

  function handleSave() {
    if (!form.customer) return;
    onSave({
      customer: form.customer, phone: form.phone, employee: form.employee,
      createdDate: todayStr(), activityType: form.activityType, source: form.source,
      project: form.project, activityDate: form.activityDate, activityTime: form.activityTime,
      lastRemark: form.lastRemark, status: "pending", budget: form.budget ? Number(form.budget) : undefined,
    });
    setForm({ customer: "", phone: "", employee: profile.name, activityType: "phone", source: "Website", project: PROJECT_OPTIONS[0], activityDate: todayStr(), activityTime: "10:00 AM", lastRemark: "", budget: "" });
    onClose();
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
            <label className="text-xs font-medium text-muted-foreground block mb-1">Assigned To</label>
            <input value={form.employee} onChange={e => setForm(p => ({ ...p, employee: e.target.value }))}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
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
            <label className="text-xs font-medium text-muted-foreground block mb-1">Project</label>
            <select value={form.project} onChange={e => setForm(p => ({ ...p, project: e.target.value }))}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
              {PROJECT_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
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
          <button disabled={!form.customer} onClick={handleSave}
            className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
            Schedule Activity
          </button>
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted/50 transition-colors">Cancel</button>
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
  { value: "pending",   label: "Pending",     color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "completed", label: "Done",        color: "bg-green-100 text-green-700 border-green-200" },
  { value: "cancelled", label: "Cancelled",   color: "bg-red-100 text-red-600 border-red-200" },
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

/* ─── Main Page ──────────────────────────────────────────────────────── */
export default function ActivitiesPage() {
  const { profile, role } = useRole();
  const isSales = role === "sales";
  const canSendWhatsApp = role === "owner" || role === "manager";
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [activities, setActivities] = useState<Activity[]>(INITIAL_ACTIVITIES);
  const [timeTab, setTimeTab] = useState<string>(isSales ? "assignee" : "overall");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [sortAsc, setSortAsc] = useState(true);

  const { data: leads } = useGetLeads({}, { query: { queryKey: getGetLeadsQueryKey({}) } });
  const customerNames = useMemo(() => (leads ?? []).map(l => l.name), [leads]);

  /* Filter by time tab — sales role always sees own activities only */
  const timeFiltered = useMemo(() => {
    const base = isSales ? activities.filter(a => a.employee === profile.name) : activities;
    if (timeTab === "overall" || timeTab === "assignee") return base;
    return base.filter(a => getTimeCategory(a) === timeTab);
  }, [activities, timeTab, profile.name, isSales]);

  /* Counts per type (from time-filtered set) */
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
      list = list.filter(a => a.customer.toLowerCase().includes(q) || a.phone.includes(q) || a.employee.toLowerCase().includes(q) || a.source.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      const diff = a.activityDate.localeCompare(b.activityDate);
      return sortAsc ? diff : -diff;
    });
  }, [timeFiltered, typeFilter, search, sortAsc]);

  function addActivity(act: Omit<Activity, "id">) {
    setActivities(prev => [{ ...act, id: Math.max(0, ...prev.map(a => a.id)) + 1 }, ...prev]);
    toast({ title: "Activity scheduled" });
  }

  function updateActivity(id: number, remark: string, status: ActivityStatus) {
    const act = activities.find(a => a.id === id);
    setActivities(prev => prev.map(a => a.id === id ? { ...a, lastRemark: remark, status } : a));
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

  /* Time-of-day greeting */
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <ScheduleDialog open={scheduleOpen} onClose={() => setScheduleOpen(false)} onSave={addActivity} customers={customerNames} />

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
                  { label: "Customer",           key: "customer" },
                  { label: "Phone",              key: "phone" },
                  { label: "Employee",           key: "employee" },
                  { label: "Created Date",       key: "createdDate" },
                  { label: "Scheduled Activity", key: "activityType" },
                  { label: "Source Name",        key: "source" },
                  { label: "Activity Date",      key: "activityDate" },
                  { label: "Activity Time",      key: "activityTime" },
                  { label: "Last Remark",        key: "lastRemark" },
                  { label: "Status",             key: "status" },
                ].map(({ label, key }) => (
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
              {displayed.length === 0 ? (
                <tr><td colSpan={10} className="py-12 text-center text-sm text-muted-foreground">No activities found</td></tr>
              ) : displayed.map((act) => {
                const typeConf = activityTypeConfig(act.activityType);
                const isToday = act.activityDate === todayStr();
                const isPast = act.activityDate < todayStr() && act.status !== "completed";
                return (
                  <tr key={act.id} className={cn("hover:bg-muted/20 transition-colors", isPast && act.status !== "completed" && "bg-red-50/30")}>
                    {/* Customer */}
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
                    {/* Phone */}
                    <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      <a href={`tel:${act.phone}`} className="hover:text-primary transition-colors flex items-center gap-1">
                        <Phone className="w-3 h-3" />{act.phone}
                      </a>
                    </td>
                    {/* Employee */}
                    <td className="px-3 py-3 text-xs font-medium text-foreground whitespace-nowrap">{act.employee}</td>
                    {/* Created Date */}
                    <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">{act.createdDate}</td>
                    {/* Scheduled Activity */}
                    <td className="px-3 py-3">
                      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap", typeConf.color)}>
                        <typeConf.icon className="w-2.5 h-2.5" />{typeConf.label}
                      </span>
                    </td>
                    {/* Source */}
                    <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">{act.source}</td>
                    {/* Activity Date */}
                    <td className="px-3 py-3">
                      <span className={cn("text-xs font-medium whitespace-nowrap",
                        isToday ? "text-primary font-semibold" : isPast && act.status !== "completed" ? "text-red-600" : "text-foreground")}>
                        {act.activityDate}
                        {isToday && <span className="ml-1 text-[9px] bg-primary/10 text-primary px-1 rounded">Today</span>}
                        {isPast && act.status !== "completed" && <span className="ml-1 text-[9px] bg-red-100 text-red-600 px-1 rounded">Overdue</span>}
                      </span>
                    </td>
                    {/* Activity Time */}
                    <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{act.activityTime}</span>
                    </td>
                    {/* Last Remark */}
                    <td className="px-3 py-3">
                      <RemarkCell activity={act} onUpdate={updateActivity} />
                    </td>
                    {/* Status */}
                    <td className="px-3 py-3">
                      <StatusToggle activity={act} onUpdate={updateActivity} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Table footer */}
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
