import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetDeals, useCreateDeal, useUpdateDeal, useDeleteDeal,
  getGetDealsQueryKey, getGetDashboardStatsQueryKey, getGetDashboardPipelineQueryKey,
  useGetLeads, useGetProperties, useGetAgents
} from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Pencil, Search, Download, Calendar, User, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/lib/role-context";
import { useAuth } from "@/lib/auth-context";
import { statusColor, stageLabel, formatCurrency, DEAL_STAGES } from "@/lib/utils";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";

const STAGES = DEAL_STAGES as unknown as string[];

const STAGE_META: Record<string, { color: string; border: string; desc: string; emptyHint: string }> = {
  prospect:    { color: "bg-blue-50 text-blue-700",    border: "border-l-blue-400",    desc: "Initial interest",        emptyHint: "Drag deals here or add a new prospect" },
  qualified:   { color: "bg-indigo-50 text-indigo-700", border: "border-l-indigo-400",  desc: "Budget & needs verified", emptyHint: "Move qualified prospects here" },
  proposal:    { color: "bg-teal-50 text-teal-700",    border: "border-l-teal-400",    desc: "Site visit / proposal out", emptyHint: "Deals with proposals sent" },
  negotiation: { color: "bg-amber-50 text-amber-700",  border: "border-l-amber-400",   desc: "Price discussion",        emptyHint: "Active price negotiations" },
  closed_won:  { color: "bg-green-50 text-green-700",  border: "border-l-green-500",   desc: "Booked & signed",         emptyHint: "Closed deals appear here" },
  closed_lost: { color: "bg-red-50 text-red-600",      border: "border-l-red-400",     desc: "Not proceeding",          emptyHint: "Lost deals tracked here" },
};

const createDealSchema = z.object({
  title: z.string().min(1, "Title required"),
  value: z.coerce.number().min(1, "Value required"),
  stage: z.string().min(1),
  leadId: z.coerce.number().optional(),
  propertyId: z.coerce.number().optional(),
  agentId: z.coerce.number().optional(),
  closingDate: z.string().optional(),
  notes: z.string().optional(),
});
type FormValues = z.infer<typeof createDealSchema>;

type Deal = {
  id: number;
  title: string;
  value: number;
  stage: string;
  leadName?: string | null;
  propertyTitle?: string | null;
  agentName?: string | null;
  closingDate?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};

function DealCard({ deal, onDelete, onEdit, onStageChange, canDelete }: { deal: Deal; onDelete: () => void; onEdit: () => void; onStageChange: (stage: string) => void; canDelete?: boolean }) {
  const [dragging, setDragging] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const closingDate = deal.closingDate ? deal.closingDate.slice(0, 10) : null;
  const isOverdue = closingDate && closingDate < today && !["closed_won","closed_lost"].includes(deal.stage);
  const isDueSoon = closingDate && !isOverdue && closingDate <= new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  return (
    <div
      draggable
      data-testid={`card-deal-${deal.id}`}
      onDragStart={(e) => { e.dataTransfer.setData("dealId", String(deal.id)); setDragging(true); }}
      onDragEnd={() => setDragging(false)}
      className={`bg-card border border-card-border rounded-lg p-3 cursor-grab active:cursor-grabbing select-none transition-all hover:shadow-sm ${dragging ? "opacity-50" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-sm text-foreground leading-snug flex-1">{deal.title}</p>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-primary"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}>
            <Pencil className="w-3 h-3" />
          </Button>
          {canDelete && (
            <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive"
              data-testid={`button-delete-deal-${deal.id}`}
              onClick={(e) => { e.stopPropagation(); onDelete(); }}>
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>
      <p className="text-base font-bold text-primary mt-1">{formatCurrency(deal.value)}</p>
      <div className="mt-2 space-y-1">
        {deal.leadName && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <User className="w-3 h-3 flex-shrink-0" /><span className="truncate">{deal.leadName}</span>
          </div>
        )}
        {deal.propertyTitle && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Building2 className="w-3 h-3 flex-shrink-0" /><span className="truncate">{deal.propertyTitle}</span>
          </div>
        )}
        {deal.agentName && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <span className="truncate">by {deal.agentName}</span>
          </div>
        )}
        {closingDate && (
          <div className={`flex items-center gap-1 text-[11px] font-medium ${isOverdue ? "text-red-600" : isDueSoon ? "text-amber-600" : "text-muted-foreground"}`}>
            <Calendar className="w-3 h-3 flex-shrink-0" />
            <span>{isOverdue ? "Overdue: " : "Close: "}{new Date(closingDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function KanbanColumn({ stage, deals, onDelete, onEdit, onDrop, canDelete }: {
  stage: string;
  deals: Deal[];
  onDelete: (id: number) => void;
  onEdit: (deal: Deal) => void;
  onDrop: (dealId: number, stage: string) => void;
  canDelete?: boolean;
}) {
  const [over, setOver] = useState(false);
  const total = deals.reduce((s, d) => s + d.value, 0);
  const meta = STAGE_META[stage] ?? { color: "bg-muted text-muted-foreground", border: "border-l-slate-300", desc: "", emptyHint: "No deals" };

  return (
    <div
      className={`flex-shrink-0 w-64 flex flex-col rounded-lg border-l-4 transition-all ${meta.border} ${over ? "bg-primary/5 ring-1 ring-primary/20" : "bg-muted/40"}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const dealId = Number(e.dataTransfer.getData("dealId"));
        if (dealId) onDrop(dealId, stage);
      }}
    >
      <div className="px-3.5 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${meta.color}`}>{stageLabel(stage)}</span>
          <span className="text-xs font-bold text-muted-foreground bg-background border border-border rounded-full px-2 py-0.5">{deals.length}</span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1 leading-snug">{meta.desc}</p>
        {deals.length > 0 && <p className="text-xs font-semibold text-foreground mt-1">{formatCurrency(total)}</p>}
      </div>
      <div className="p-2 space-y-2 flex-1 min-h-20 overflow-y-auto max-h-[calc(100vh-240px)]">
        {deals.map((deal) => (
          <DealCard key={deal.id} deal={deal} onDelete={() => onDelete(deal.id)} onEdit={() => onEdit(deal)} onStageChange={(s) => onDrop(deal.id, s)} canDelete={canDelete} />
        ))}
        {deals.length === 0 && (
          <div className="flex flex-col items-center justify-center h-20 gap-1.5 border-2 border-dashed border-border rounded-lg m-1">
            <p className="text-[10px] text-muted-foreground/60 text-center px-2">{meta.emptyHint}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function EditDealDialog({ deal, leads, properties, agents, isSales, isPending, onSave, onClose }: {
  deal: Deal;
  leads: { id: number; name: string }[] | undefined;
  properties: { id: number; title: string }[] | undefined;
  agents: { id: number; name: string }[] | undefined;
  isSales: boolean;
  isPending: boolean;
  onSave: (id: number, data: FormValues) => void;
  onClose: () => void;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(createDealSchema),
    defaultValues: {
      title: deal.title,
      value: deal.value,
      stage: deal.stage,
      leadId: (deal as any).leadId ?? undefined,
      propertyId: (deal as any).propertyId ?? undefined,
      agentId: (deal as any).agentId ?? undefined,
      closingDate: deal.closingDate ? deal.closingDate.slice(0, 10) : undefined,
      notes: deal.notes ?? undefined,
    },
  });

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Edit Deal — {deal.title}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(v => onSave(deal.id, v))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem className="col-span-2"><FormLabel>Deal Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="value" render={({ field }) => (
                <FormItem><FormLabel>Value (₹)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="stage" render={({ field }) => (
                <FormItem><FormLabel>Stage</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STAGES.map(s => <SelectItem key={s} value={s}>{stageLabel(s)}</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="leadId" render={({ field }) => (
                <FormItem><FormLabel>Lead</FormLabel>
                  <Select value={field.value?.toString() ?? ""} onValueChange={(v) => field.onChange(v ? Number(v) : undefined)}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>{(leads ?? []).map(l => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="propertyId" render={({ field }) => (
                <FormItem><FormLabel>Property</FormLabel>
                  <Select value={field.value?.toString() ?? ""} onValueChange={(v) => field.onChange(v ? Number(v) : undefined)}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>{(properties ?? []).map(p => <SelectItem key={p.id} value={String(p.id)}>{p.title}</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              {!isSales && (
                <FormField control={form.control} name="agentId" render={({ field }) => (
                  <FormItem><FormLabel>Agent</FormLabel>
                    <Select value={field.value?.toString() ?? ""} onValueChange={(v) => field.onChange(v ? Number(v) : undefined)}>
                      <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>{(agents ?? []).map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
              )}
              <FormField control={form.control} name="closingDate" render={({ field }) => (
                <FormItem><FormLabel>Expected Close</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem><FormLabel>Notes</FormLabel><FormControl><Input placeholder="Additional notes..." {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Save Changes"}</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function DealsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [editDeal, setEditDeal] = useState<Deal | null>(null);
  const [deleteDealId, setDeleteDealId] = useState<number | null>(null);
  const [deleteDealTitle, setDeleteDealTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const qc = useQueryClient();
  const { toast } = useToast();
  const { role } = useRole();
  const { user } = useAuth();
  const isSales = role === "agent" || role === "broker";
  const isOwner = role === "owner";

  // API already filters by agentId for field roles — use response directly
  const { data: deals, isLoading } = useGetDeals({}, { query: { queryKey: getGetDealsQueryKey(), refetchInterval: 30_000 } });
  const { data: leads } = useGetLeads({}, { query: { queryKey: ["leads"] } });
  const { data: properties } = useGetProperties({}, { query: { queryKey: ["properties"] } });
  const { data: agents } = useGetAgents();

  const createDeal = useCreateDeal({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetDealsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetDashboardPipelineQueryKey() });
        setShowCreate(false);
        toast({ title: "Deal created" });
      },
      onError: () => toast({ title: "Error creating deal", variant: "destructive" }),
    },
  });

  const updateDeal = useUpdateDeal({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetDealsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetDashboardPipelineQueryKey() });
      },
    },
  });

  const editDealMutation = useUpdateDeal({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetDealsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetDashboardPipelineQueryKey() });
        setEditDeal(null);
        toast({ title: "Deal updated ✓" });
      },
      onError: () => toast({ title: "Failed to update deal", variant: "destructive" }),
    },
  });

  const deleteDeal = useDeleteDeal({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetDealsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetDashboardPipelineQueryKey() });
        setDeleteDealId(null);
        toast({ title: "Deal deleted" });
      },
      onError: () => toast({ title: "Failed to delete deal", variant: "destructive" }),
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(createDealSchema),
    defaultValues: { title: "", value: 0, stage: "prospect" },
  });

  function onSubmit(values: FormValues) {
    const selfAgentId = isSales ? (user?.agentId ?? null) : (values.agentId ?? null);

    createDeal.mutate({
      data: {
        ...values,
        leadId: values.leadId ?? null,
        propertyId: values.propertyId ?? null,
        agentId: selfAgentId,
        closingDate: values.closingDate ?? null,
        notes: values.notes ?? null,
      },
    });
  }

  function handleDrop(dealId: number, stage: string) {
    const deal = (deals ?? []).find((d) => d.id === dealId);
    if (!deal || deal.stage === stage) return;
    updateDeal.mutate({ id: dealId, data: { stage } });
  }

  const q = searchQuery.trim().toLowerCase();
  const visibleDeals = q
    ? (deals ?? []).filter(d =>
        d.title.toLowerCase().includes(q) ||
        (d.leadName ?? "").toLowerCase().includes(q) ||
        (d.agentName ?? "").toLowerCase().includes(q) ||
        (d.propertyTitle ?? "").toLowerCase().includes(q)
      )
    : (deals ?? []);

  function downloadDealsCsv() {
    const headers = ["Title", "Value", "Stage", "Lead", "Property", "Sales Agent", "ClosingDate", "Notes", "Created"];
    const rows = visibleDeals.map(d => [
      d.title, String(d.value), d.stage,
      d.leadName ?? "", d.propertyTitle ?? "", d.agentName ?? "",
      d.closingDate ? d.closingDate.slice(0, 10) : "", d.notes ?? "", d.createdAt.slice(0, 10),
    ].map(v => `"${v.replace(/"/g, '""')}"`));
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `deals_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const dealsByStage = (stage: string) => visibleDeals.filter((d) => d.stage === stage) as Deal[];
  const totalPipeline = visibleDeals.filter(d => !["closed_won", "closed_lost"].includes(d.stage)).reduce((s, d) => s + d.value, 0);

  return (
    <div className="p-6 space-y-5">
      {editDeal && (
        <EditDealDialog
          deal={editDeal}
          leads={leads}
          properties={properties}
          agents={agents}
          isSales={isSales}
          isPending={editDealMutation.isPending}
          onSave={(id, values) => editDealMutation.mutate({ id, data: { ...values, leadId: values.leadId ?? null, propertyId: values.propertyId ?? null, agentId: values.agentId ?? null, closingDate: values.closingDate ?? null, notes: values.notes ?? null } })}
          onClose={() => setEditDeal(null)}
        />
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isSales ? "My Deal Pipeline" : "Deal Pipeline"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            <span className="font-medium text-foreground">{visibleDeals.length}</span> deals · <span className="font-medium text-foreground">{formatCurrency(totalPipeline)}</span> active pipeline · <span className="text-green-600 font-medium">{visibleDeals.filter(d => d.stage === "closed_won").length} won</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search deals…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 h-9 w-52 text-sm"
            />
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={downloadDealsCsv}>
            <Download className="w-3.5 h-3.5" />CSV
          </Button>
          <Button data-testid="button-create-deal" onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Add Deal
          </Button>
        </div>
      </div>

      {!isLoading && visibleDeals.length > 0 && (
        <p className="text-[11px] text-muted-foreground/70 flex items-center gap-1">
          <span>Drag cards between columns to update stage · Click pencil to edit · Total pipeline excludes closed deals</span>
        </p>
      )}

      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[...Array(5)].map((_, i) => <div key={i} className="w-64 h-96 flex-shrink-0 bg-muted rounded-lg animate-pulse" />)}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4" data-testid="kanban-board">
          {STAGES.map((stage) => (
            <KanbanColumn
              key={stage}
              stage={stage}
              deals={dealsByStage(stage)}
              onDelete={(id) => {
                const deal = (deals ?? []).find(d => d.id === id);
                setDeleteDealTitle(deal?.title ?? "this deal");
                setDeleteDealId(id);
              }}
              onEdit={(deal) => setEditDeal(deal)}
              onDrop={handleDrop}
              canDelete={isOwner}
            />
          ))}
        </div>
      )}

      <ConfirmDeleteDialog
        open={deleteDealId !== null}
        onOpenChange={(open) => { if (!open) setDeleteDealId(null); }}
        onConfirm={() => deleteDealId && deleteDeal.mutate({ id: deleteDealId })}
        title="Delete Deal"
        description={`Are you sure you want to delete "${deleteDealTitle}"? This action cannot be undone.`}
        loading={deleteDeal.isPending}
      />

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Deal</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem className="col-span-2"><FormLabel>Deal Title</FormLabel><FormControl><Input data-testid="input-deal-title" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="value" render={({ field }) => (
                  <FormItem><FormLabel>Value (₹)</FormLabel><FormControl><Input data-testid="input-deal-value" type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="stage" render={({ field }) => (
                  <FormItem><FormLabel>Stage</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger data-testid="select-deal-stage"><SelectValue /></SelectTrigger>
                      <SelectContent>{STAGES.map(s => <SelectItem key={s} value={s}>{stageLabel(s)}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="leadId" render={({ field }) => (
                  <FormItem><FormLabel>Lead</FormLabel>
                    <Select value={field.value?.toString() ?? ""} onValueChange={(v) => field.onChange(v ? Number(v) : undefined)}>
                      <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>{(leads ?? []).map(l => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="propertyId" render={({ field }) => (
                  <FormItem><FormLabel>Property</FormLabel>
                    <Select value={field.value?.toString() ?? ""} onValueChange={(v) => field.onChange(v ? Number(v) : undefined)}>
                      <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>{(properties ?? []).map(p => <SelectItem key={p.id} value={String(p.id)}>{p.title}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                {!isSales && (
                  <FormField control={form.control} name="agentId" render={({ field }) => (
                    <FormItem><FormLabel>Assign Agent</FormLabel>
                      <Select value={field.value?.toString() ?? ""} onValueChange={(v) => field.onChange(Number(v))}>
                        <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                        <SelectContent>{(agents ?? []).map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}</SelectContent>
                      </Select><FormMessage />
                    </FormItem>
                  )} />
                )}
                <FormField control={form.control} name="closingDate" render={({ field }) => (
                  <FormItem><FormLabel>Expected Close</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Notes</FormLabel><FormControl><Input data-testid="input-deal-notes" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button type="submit" data-testid="button-submit-deal" disabled={createDeal.isPending}>
                  {createDeal.isPending ? "Creating..." : "Create Deal"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
