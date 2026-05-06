import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  useGetLeads, useCreateLead, useDeleteLead,
  getGetLeadsQueryKey, getGetDashboardStatsQueryKey, getGetLeadSourcesQueryKey
} from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, Trash2, Phone, MessageCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { statusColor, stageLabel, formatCurrency, formatDate, LEAD_STATUSES, LEAD_SOURCES, PROPERTY_TYPES, scoreColor, cn } from "@/lib/utils";
import { useGetAgents } from "@workspace/api-client-react";

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
};

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

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? "bg-green-500" : score >= 60 ? "bg-amber-500" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${score}%` }} />
      </div>
      <span className={cn("text-xs font-bold tabular-nums", scoreColor(score))}>{score}</span>
    </div>
  );
}

const createLeadSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  source: z.string().min(1),
  status: z.string().min(1),
  score: z.coerce.number().min(0).max(100),
  budget: z.coerce.number().optional(),
  propertyType: z.string().optional(),
  notes: z.string().optional(),
  assignedTo: z.coerce.number().optional(),
});

type FormValues = z.infer<typeof createLeadSchema>;

export default function LeadsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const params = {
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
    ...(search ? { search } : {}),
  };
  const { data: leads, isLoading } = useGetLeads(params, { query: { queryKey: getGetLeadsQueryKey(params) } });
  const { data: agents } = useGetAgents();
  const createLead = useCreateLead({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetLeadsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetLeadSourcesQueryKey() });
        setShowCreate(false);
        toast({ title: "Lead created ✓" });
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
    defaultValues: { name: "", email: "", phone: "", source: "99acres", status: "new", score: 50 },
  });

  function onSubmit(values: FormValues) {
    createLead.mutate({ data: { ...values, budget: values.budget ?? null, propertyType: values.propertyType ?? null, notes: values.notes ?? null, assignedTo: values.assignedTo ?? null } });
  }

  const allLeads = leads ?? [];

  // Summary counts
  const statusCounts = LEAD_STATUSES.reduce((acc, s) => {
    acc[s] = allLeads.filter(l => l.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leads</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{allLeads.length} total leads</p>
        </div>
        <Button data-testid="button-create-lead" onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Add Lead
        </Button>
      </div>

      {/* Status quick-filter pills */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setStatusFilter("all")}
          className={cn("px-3 py-1 rounded-full text-xs font-medium border transition-colors", statusFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary hover:text-primary")}
        >
          All ({allLeads.length})
        </button>
        {LEAD_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s === statusFilter ? "all" : s)}
            className={cn("px-3 py-1 rounded-full text-xs font-medium border transition-colors", statusFilter === s ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary hover:text-primary")}
          >
            {stageLabel(s)} {statusCounts[s] > 0 && `(${statusCounts[s]})`}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input data-testid="input-search" className="pl-9 bg-card" placeholder="Search by name, email, or phone..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="h-16 bg-muted rounded animate-pulse" />)}</div>
      ) : allLeads.length === 0 ? (
        <div className="bg-card border border-card-border rounded-lg py-20 text-center">
          <Users className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-base font-medium text-foreground">No leads found</p>
          <p className="text-sm text-muted-foreground mt-1">{search ? "Try a different search term" : "Add your first lead to get started"}</p>
          {!search && (
            <Button className="mt-4 gap-2" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4" />Add Lead
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-card border border-card-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Source</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Score</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Budget</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden xl:table-cell">Agent</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden xl:table-cell">Added</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {allLeads.map((lead) => (
                <tr
                  key={lead.id}
                  data-testid={`row-lead-${lead.id}`}
                  className="hover:bg-muted/30 cursor-pointer group transition-colors"
                  onClick={() => setLocation(`/leads/${lead.id}`)}
                >
                  {/* Name + avatar */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <LeadAvatar name={lead.name} score={lead.score} />
                      <div className="min-w-0">
                        <div className="font-semibold text-foreground truncate">{lead.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{lead.email}</div>
                      </div>
                    </div>
                  </td>
                  {/* Source badge */}
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border capitalize", SOURCE_COLORS[lead.source] ?? "bg-muted text-muted-foreground border-border")}>
                      {lead.source}
                    </span>
                  </td>
                  {/* Status */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColor(lead.status)}`}>
                      {stageLabel(lead.status)}
                    </span>
                  </td>
                  {/* Score bar */}
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <ScoreBar score={lead.score} />
                  </td>
                  {/* Budget */}
                  <td className="px-4 py-3 hidden lg:table-cell text-foreground font-medium">
                    {lead.budget ? formatCurrency(lead.budget) : <span className="text-muted-foreground">—</span>}
                  </td>
                  {/* Agent */}
                  <td className="px-4 py-3 hidden xl:table-cell">
                    {lead.agentName ? (
                      <span className="text-foreground text-xs">{lead.agentName}</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">Unassigned</span>
                    )}
                  </td>
                  {/* Date */}
                  <td className="px-4 py-3 hidden xl:table-cell text-xs text-muted-foreground">
                    {formatDate(lead.createdAt)}
                  </td>
                  {/* Actions — visible on row hover */}
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {lead.phone && (
                        <Button
                          size="icon" variant="ghost" className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                          title="Call"
                          onClick={(e) => { e.stopPropagation(); window.open(`tel:${lead.phone}`); }}
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button
                        size="icon" variant="ghost" className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                        title="WhatsApp"
                        onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/${lead.phone?.replace(/\D/g, "") ?? ""}`); }}
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                        data-testid={`button-delete-lead-${lead.id}`}
                        title="Delete"
                        onClick={(e) => { e.stopPropagation(); if (confirm("Delete this lead?")) deleteLead.mutate({ id: lead.id }); }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add New Lead</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input data-testid="input-lead-name" placeholder="Rahul Sharma" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email</FormLabel><FormControl><Input data-testid="input-lead-email" type="email" placeholder="rahul@example.com" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem><FormLabel>Phone</FormLabel><FormControl><Input data-testid="input-lead-phone" placeholder="+91 98765 43210" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="source" render={({ field }) => (
                  <FormItem><FormLabel>Source</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger data-testid="select-lead-source"><SelectValue /></SelectTrigger>
                      <SelectContent>{LEAD_SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
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
                  <FormItem><FormLabel>Lead Score (0–100)</FormLabel><FormControl><Input data-testid="input-lead-score" type="number" min={0} max={100} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="budget" render={({ field }) => (
                  <FormItem><FormLabel>Budget (₹)</FormLabel><FormControl><Input data-testid="input-lead-budget" type="number" placeholder="5000000" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="propertyType" render={({ field }) => (
                  <FormItem><FormLabel>Property Type</FormLabel>
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <SelectTrigger data-testid="select-lead-property-type"><SelectValue placeholder="Any" /></SelectTrigger>
                      <SelectContent>{PROPERTY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="assignedTo" render={({ field }) => (
                  <FormItem className="col-span-2"><FormLabel>Assign to Agent</FormLabel>
                    <Select value={field.value?.toString() ?? ""} onValueChange={(v) => field.onChange(Number(v))}>
                      <SelectTrigger data-testid="select-lead-agent"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                      <SelectContent>{(agents ?? []).map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Notes</FormLabel><FormControl><Input data-testid="input-lead-notes" placeholder="Any additional context..." {...field} /></FormControl><FormMessage /></FormItem>
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
