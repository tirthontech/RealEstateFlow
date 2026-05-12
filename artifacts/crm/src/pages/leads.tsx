import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  useGetLeads, useCreateLead, useDeleteLead,
  getGetLeadsQueryKey, getGetDashboardStatsQueryKey, getGetLeadSourcesQueryKey,
  useGetAgents,
} from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus, Search, Trash2, Phone, MessageCircle, Users, Calendar,
  Clock, Home, TrendingUp, CheckCircle2, X, Download, Filter,
  RefreshCw, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { statusColor, stageLabel, formatCurrency, formatDate, LEAD_STATUSES, LEAD_SOURCES, PROPERTY_TYPES, scoreColor, cn } from "@/lib/utils";
import { useRole } from "@/lib/role-context";

/* ─── Config ───────────────────────────────────────────────────────── */
const SOURCE_COLORS: Record<string, string> = {
  "99acres":    "bg-red-50 text-red-700 border-red-200",
  magicbricks:  "bg-orange-50 text-orange-700 border-orange-200",
  housing:      "bg-blue-50 text-blue-700 border-blue-200",
  facebook:     "bg-indigo-50 text-indigo-700 border-indigo-200",
  google:       "bg-yellow-50 text-yellow-700 border-yellow-200",
  whatsapp:     "bg-green-50 text-green-700 border-green-200",
  referral:     "bg-purple-50 text-purple-700 border-purple-200",
  walk_in:      "bg-teal-50 text-teal-700 border-teal-200",
  website:      "bg-cyan-50 text-cyan-700 border-cyan-200",
  phone:        "bg-slate-50 text-slate-700 border-slate-200",
  email:        "bg-pink-50 text-pink-700 border-pink-200",
  ivr:          "bg-amber-50 text-amber-700 border-amber-200",
};

const PROJECTS = ["Prestige Lakeside", "Godrej Summit", "DLF Cybercity", "Sobha Royal Crest"];

/* Tab config — maps to lead statuses */
const LEAD_TABS = [
  { id: "all",         label: "New Leads",   statuses: ["new"],                            color: "text-blue-600" },
  { id: "upcoming",    label: "Upcoming",    statuses: ["contacted", "qualified"],          color: "text-purple-600" },
  { id: "site_visits", label: "Site Visits", statuses: ["proposal"],                        color: "text-teal-600" },
  { id: "expected",    label: "Expected",    statuses: ["negotiation"],                     color: "text-amber-600" },
  { id: "reengage",    label: "Re-Engage",   statuses: ["closed_lost"],                     color: "text-red-600" },
  { id: "closed",      label: "Closed Won",  statuses: ["closed_won"],                      color: "text-green-600" },
] as const;

/* Quick filters */
const QUICK_FILTERS = [
  { id: "fresh",   label: "Fresh Leads",  icon: Plus },
  { id: "today",   label: "Today Leads",  icon: Calendar },
  { id: "latest",  label: "Latest Leads", icon: Clock },
] as const;

/* Activity types for scheduling */
const ACT_TYPES = [
  { id: "phone",             label: "Phone",             color: "bg-purple-100 text-purple-700" },
  { id: "site_visit_follow", label: "Site Visit Follow", color: "bg-cyan-100 text-cyan-700" },
  { id: "site_visit",        label: "Site Visit",        color: "bg-teal-100 text-teal-700" },
  { id: "nego_followup",     label: "Nego Followup",     color: "bg-orange-100 text-orange-700" },
  { id: "negotiation",       label: "Negotiation",       color: "bg-amber-100 text-amber-700" },
  { id: "sale",              label: "Sale",              color: "bg-green-100 text-green-700" },
];

/* ─── Create Lead Schema ─────────────────────────────────────────── */
const createLeadSchema = z.object({
  name:         z.string().min(1, "Name is required"),
  email:        z.string().email("Valid email required"),
  phone:        z.string().optional(),
  source:       z.string().min(1),
  status:       z.string().min(1),
  score:        z.coerce.number().min(0).max(100),
  budget:       z.coerce.number().optional(),
  propertyType: z.string().optional(),
  notes:        z.string().optional(),
  assignedTo:   z.coerce.number().optional(),
});
type FormValues = z.infer<typeof createLeadSchema>;

/* ─── Schedule Activity Dialog ───────────────────────────────────── */
function ScheduleActivityDialog({ leadName, open, onClose }: {
  leadName: string; open: boolean; onClose: () => void;
}) {
  const { profile } = useRole();
  const { toast } = useToast();
  const [form, setForm] = useState({
    activityType: "phone", project: PROJECTS[0], date: new Date().toISOString().slice(0, 10),
    time: "10:00", remark: "", employee: profile.name,
  });

  function save() {
    toast({ title: `Activity scheduled for ${leadName}` });
    onClose();
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-card rounded-xl border border-border shadow-xl w-full max-w-sm p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />Schedule Activity
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-muted-foreground">For: <span className="font-semibold text-foreground">{leadName}</span></p>

        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Activity Type</label>
          <div className="grid grid-cols-2 gap-1.5">
            {ACT_TYPES.map(t => (
              <button key={t.id} onClick={() => setForm(p => ({ ...p, activityType: t.id }))}
                className={cn("px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all",
                  form.activityType === t.id ? t.color + " border-transparent ring-2 ring-offset-1 ring-primary/30" : "border-border text-muted-foreground hover:border-primary/40")}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Project</label>
          <select value={form.project} onChange={e => setForm(p => ({ ...p, project: e.target.value }))}
            className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
            {PROJECTS.map(pr => <option key={pr} value={pr}>{pr}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Date</label>
            <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Time</label>
            <input type="time" value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Employee</label>
          <input value={form.employee} onChange={e => setForm(p => ({ ...p, employee: e.target.value }))}
            className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Remark</label>
          <textarea value={form.remark} onChange={e => setForm(p => ({ ...p, remark: e.target.value }))} rows={2}
            placeholder="Add a note..."
            className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={save} className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
            Schedule
          </button>
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted/50 transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Avatar ──────────────────────────────────────────────────────── */
function LeadAvatar({ name, score }: { name: string; score: number }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const bg = score >= 80 ? "bg-green-100 text-green-700 ring-green-300"
           : score >= 60 ? "bg-amber-100 text-amber-700 ring-amber-300"
           : "bg-slate-100 text-slate-600 ring-slate-200";
  return (
    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ring-2 flex-shrink-0", bg)}>
      {initials}
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────────────── */
export default function LeadsPage() {
  const [search, setSearch]             = useState("");
  const [activeTab, setActiveTab]       = useState<string>("all");
  const [quickFilter, setQuickFilter]   = useState<string | null>(null);
  const [showCreate, setShowCreate]     = useState(false);
  const [scheduleLead, setScheduleLead] = useState<{ id: number; name: string } | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();
  const { profile, role } = useRole();
  const isSales = role === "sales";
  const [, setLocation] = useLocation();

  const { data: leads, isLoading } = useGetLeads({}, { query: { queryKey: getGetLeadsQueryKey({}) } });
  const { data: agents } = useGetAgents();

  const createLead = useCreateLead({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetLeadsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetLeadSourcesQueryKey() });
        setShowCreate(false);
        toast({ title: "Lead created ✓" });
        form.reset();
      },
      onError: () => toast({ title: "Error creating lead", variant: "destructive" }),
    },
  });

  const deleteLead = useDeleteLead({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetLeadsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
        toast({ title: "Lead deleted" });
      },
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(createLeadSchema),
    defaultValues: { name: "", email: "", phone: "", source: "phone", status: "new", score: 50 },
  });

  function onSubmit(values: FormValues) {
    createLead.mutate({ data: { ...values, budget: values.budget ?? null, propertyType: values.propertyType ?? null, notes: values.notes ?? null, assignedTo: values.assignedTo ?? null } });
  }

  const allLeads = (leads ?? []).filter(l => isSales ? l.agentName === profile.name : true);
  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  /* Tab counts */
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    LEAD_TABS.forEach(tab => {
      counts[tab.id] = allLeads.filter(l => (tab.statuses as readonly string[]).includes(l.status)).length;
    });
    counts.all = allLeads.filter(l => l.status === "new").length;
    return counts;
  }, [allLeads]);

  /* Apply tab filter */
  const tabFiltered = useMemo(() => {
    const tab = LEAD_TABS.find(t => t.id === activeTab);
    if (!tab) return allLeads;
    return allLeads.filter(l => (tab.statuses as readonly string[]).includes(l.status));
  }, [allLeads, activeTab]);

  /* Apply quick filter + search on top of tab */
  const displayed = useMemo(() => {
    let list = tabFiltered;

    if (quickFilter === "fresh") list = list.filter(l => l.status === "new");
    else if (quickFilter === "today") list = list.filter(l => l.createdAt.slice(0, 10) === today);
    else if (quickFilter === "latest") list = list.filter(l => l.createdAt >= sevenDaysAgo);

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(l =>
        l.name.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        (l.phone ?? "").includes(q) ||
        l.source.toLowerCase().includes(q)
      );
    }
    return list;
  }, [tabFiltered, quickFilter, search, today, sevenDaysAgo]);

  /* Derive a "project" label from propertyType for display */
  function projectLabel(lead: typeof allLeads[0]) {
    const map: Record<string, string> = {
      residential: "Prestige Lakeside",
      commercial:  "DLF Cybercity",
      land:        "Sobha Royal Crest",
      rental:      "Godrej Summit",
    };
    return lead.propertyType ? map[lead.propertyType] ?? "Prestige Lakeside" : "—";
  }

  /* Scheduled date mock — show createdAt as "scheduled" date */
  function scheduledLabel(lead: typeof allLeads[0]) {
    return lead.createdAt.slice(0, 10);
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Schedule Activity Dialog */}
      {scheduleLead && (
        <ScheduleActivityDialog
          leadName={scheduleLead.name}
          open={!!scheduleLead}
          onClose={() => setScheduleLead(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-tight">{greeting}, {profile.name.split(" ")[0]}!</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Manage your leads — <span className="font-medium text-foreground">{allLeads.length} total</span> · {allLeads.filter(l => l.status === "new").length} fresh leads this session
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button data-testid="button-create-lead" onClick={() => setShowCreate(true)} className="gap-1.5 text-xs h-8">
            <Plus className="w-3.5 h-3.5" />Add Lead
          </Button>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
        <div className="flex gap-0.5 border-b border-border min-w-max">
          {LEAD_TABS.map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setQuickFilter(null); }}
              className={cn("flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
                activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
              {tab.label}
              {tabCounts[tab.id] > 0 && (
                <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                  activeTab === tab.id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                  {tabCounts[tab.id]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Quick filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {QUICK_FILTERS.map(qf => (
          <button key={qf.id} onClick={() => setQuickFilter(quickFilter === qf.id ? null : qf.id)}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
              quickFilter === qf.id ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground")}>
            <qf.icon className="w-3 h-3" />{qf.label}
          </button>
        ))}
        {quickFilter && (
          <button onClick={() => setQuickFilter(null)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <X className="w-3 h-3" />Clear filter
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input data-testid="input-search" className="pl-9 bg-card h-9 text-sm"
          placeholder="Search customer, mobile, source..."
          value={search} onChange={e => setSearch(e.target.value)} />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(8)].map((_, i) => (
          <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />
        ))}</div>
      ) : displayed.length === 0 ? (
        <div className="bg-card border border-card-border rounded-xl py-16 text-center">
          <Users className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-foreground">No leads found</p>
          <p className="text-xs text-muted-foreground mt-1">{search ? "Try a different search" : "Add your first lead to get started"}</p>
          {!search && <Button className="mt-4 gap-2 text-xs h-8" onClick={() => setShowCreate(true)}><Plus className="w-3.5 h-3.5" />Add Lead</Button>}
        </div>
      ) : (
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          {/* Table header summary */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/20">
            <p className="text-xs text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{displayed.length}</span> leads
              {quickFilter && <span className="ml-1">· <span className="text-primary capitalize">{quickFilter} filter active</span></span>}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground hidden sm:block">
                {allLeads.filter(l => l.status === "closed_won").length} closed won
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 700 }}>
              <thead className="border-b border-border bg-muted/10">
                <tr>
                  {["Customers", "Mobile", "Source", "Project", "Scheduled", "Employee", "Status", ""].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {displayed.map((lead) => (
                  <tr key={lead.id} data-testid={`row-lead-${lead.id}`}
                    className="hover:bg-muted/20 cursor-pointer group transition-colors"
                    onClick={() => setLocation(`/leads/${lead.id}`)}>

                    {/* Customers */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <LeadAvatar name={lead.name} score={lead.score} />
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground text-sm truncate">{lead.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{lead.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Mobile */}
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      {lead.phone ? (
                        <a href={`tel:${lead.phone}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors whitespace-nowrap">
                          <Phone className="w-3 h-3 flex-shrink-0" />{lead.phone}
                        </a>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>

                    {/* Source */}
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border capitalize whitespace-nowrap", SOURCE_COLORS[lead.source] ?? "bg-muted text-muted-foreground border-border")}>
                        {lead.source.replace(/_/g, " ")}
                      </span>
                    </td>

                    {/* Project */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-foreground font-medium truncate max-w-[120px] block">
                        {projectLabel(lead)}
                      </span>
                    </td>

                    {/* Scheduled */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{scheduledLabel(lead)}</span>
                    </td>

                    {/* Employee */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-foreground whitespace-nowrap">{lead.agentName ?? "Unassigned"}</span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap", statusColor(lead.status))}>
                        {stageLabel(lead.status)}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button title="Schedule Activity"
                          onClick={() => setScheduleLead({ id: lead.id, name: lead.name })}
                          className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors">
                          <Calendar className="w-3.5 h-3.5" />
                        </button>
                        {lead.phone && (
                          <button title="Call" onClick={() => window.open(`tel:${lead.phone}`)}
                            className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors">
                            <Phone className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button title="WhatsApp"
                          onClick={() => window.open(`https://wa.me/${(lead.phone ?? "").replace(/\D/g, "")}`)}
                          className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-colors">
                          <MessageCircle className="w-3.5 h-3.5" />
                        </button>
                        <button title="Delete" data-testid={`button-delete-lead-${lead.id}`}
                          onClick={() => { if (confirm("Delete this lead?")) deleteLead.mutate({ id: lead.id }); }}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-border bg-muted/10 flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground">TOTAL: {displayed.length} RECORDS · Click row to view details</p>
            <button onClick={() => setLocation("/activities")}
              className="flex items-center gap-1 text-xs text-primary hover:underline">
              View all activities <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Create Lead Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add New Lead</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Full Name</FormLabel>
                    <FormControl><Input data-testid="input-lead-name" placeholder="Rahul Sharma" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email</FormLabel>
                    <FormControl><Input data-testid="input-lead-email" type="email" placeholder="rahul@example.com" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem><FormLabel>Mobile</FormLabel>
                    <FormControl><Input data-testid="input-lead-phone" placeholder="+91 98765 43210" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="source" render={({ field }) => (
                  <FormItem><FormLabel>Source</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger data-testid="select-lead-source"><SelectValue /></SelectTrigger>
                      <SelectContent>{LEAD_SOURCES.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g," ")}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem><FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger data-testid="select-lead-status"><SelectValue /></SelectTrigger>
                      <SelectContent>{LEAD_STATUSES.map(s => <SelectItem key={s} value={s}>{stageLabel(s)}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="score" render={({ field }) => (
                  <FormItem><FormLabel>Lead Score (0–100)</FormLabel>
                    <FormControl><Input data-testid="input-lead-score" type="number" min={0} max={100} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="budget" render={({ field }) => (
                  <FormItem><FormLabel>Budget (₹)</FormLabel>
                    <FormControl><Input data-testid="input-lead-budget" type="number" placeholder="5000000" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="propertyType" render={({ field }) => (
                  <FormItem><FormLabel>Property Type</FormLabel>
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <SelectTrigger data-testid="select-lead-property-type"><SelectValue placeholder="Any" /></SelectTrigger>
                      <SelectContent>{PROPERTY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                {!isSales && (
                  <FormField control={form.control} name="assignedTo" render={({ field }) => (
                    <FormItem className="col-span-2"><FormLabel>Assign to Employee</FormLabel>
                      <Select value={field.value?.toString() ?? ""} onValueChange={v => field.onChange(Number(v))}>
                        <SelectTrigger data-testid="select-lead-agent"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                        <SelectContent>{(agents ?? []).map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}</SelectContent>
                      </Select><FormMessage />
                    </FormItem>
                  )} />
                )}
              </div>
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Notes / Last Remark</FormLabel>
                  <FormControl><Input data-testid="input-lead-notes" placeholder="Any additional context..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button type="submit" data-testid="button-submit-lead" disabled={createLead.isPending}>
                  {createLead.isPending ? "Creating..." : "Create Lead"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
