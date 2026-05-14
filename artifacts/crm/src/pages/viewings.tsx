import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGetLeads, useGetProperties, useGetAgents, getGetLeadsQueryKey, getGetPropertiesQueryKey } from "@workspace/api-client-react";
import { customFetch } from "@workspace/api-client-react";
import { viewingKeys } from "@/lib/queryKeys";
import { Calendar, Clock, MapPin, User, Plus, CheckCircle2, XCircle, HelpCircle, Trash2, Phone, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn, formatCurrency } from "@/lib/utils";
import { useRole } from "@/lib/role-context";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";

type Status = "confirmed" | "pending" | "completed" | "no_show" | "cancelled";

type ViewingRecord = {
  id: number;
  leadId: number | null;
  propertyId: number | null;
  agentId: number | null;
  date: string;
  time: string;
  status: Status;
  notes?: string | null;
  leadName?: string | null;
  leadPhone?: string | null;
  propertyTitle?: string | null;
  propertyPrice?: number | null;
  agentName?: string | null;
};

const STATUS_CONFIG: Record<Status, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  confirmed:  { label: "Confirmed",  color: "text-green-700 bg-green-50 border-green-200",   icon: CheckCircle2 },
  pending:    { label: "Pending",    color: "text-amber-700 bg-amber-50 border-amber-200",    icon: HelpCircle },
  completed:  { label: "Completed",  color: "text-blue-700 bg-blue-50 border-blue-200",       icon: CheckCircle2 },
  no_show:    { label: "No Show",    color: "text-red-700 bg-red-50 border-red-200",          icon: XCircle },
  cancelled:  { label: "Cancelled",  color: "text-slate-600 bg-slate-50 border-slate-200",    icon: XCircle },
};

function useViewings() {
  return useQuery({
    queryKey: viewingKeys.all(),
    queryFn: () => customFetch<ViewingRecord[]>("/api/viewings"),
  });
}

function useCreateViewing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ViewingRecord>) =>
      customFetch<ViewingRecord>("/api/viewings", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: viewingKeys.all() }),
  });
}

function useUpdateViewing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ViewingRecord> }) =>
      customFetch<ViewingRecord>(`/api/viewings/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: viewingKeys.all() }),
  });
}

function useDeleteViewing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<void>(`/api/viewings/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: viewingKeys.all() }),
  });
}

export default function ViewingsPage() {
  const { toast } = useToast();
  const { role } = useRole();
  const isOwner = role === "owner";
  const canEdit = role === "owner" || role === "manager";
  const [showAdd, setShowAdd] = useState(false);
  const [filterStatus, setFilterStatus] = useState<Status | "all">("all");
  const [newViewing, setNewViewing] = useState({ leadId: "", propertyId: "", agentId: "", date: "", time: "10:00", notes: "" });
  const [deleteViewingId, setDeleteViewingId] = useState<number | null>(null);
  const [editViewing, setEditViewing] = useState<ViewingRecord | null>(null);

  const { data: viewings = [], isLoading } = useViewings();
  const { data: leads } = useGetLeads({}, { query: { queryKey: getGetLeadsQueryKey() } });
  const { data: properties } = useGetProperties({}, { query: { queryKey: getGetPropertiesQueryKey() } });
  const { data: agents } = useGetAgents();

  const createViewing = useCreateViewing();
  const updateViewing = useUpdateViewing();
  const deleteViewing = useDeleteViewing();

  function addViewing() {
    if (!newViewing.leadId || !newViewing.propertyId || !newViewing.date) {
      toast({ title: "Please fill in lead, property, and date", variant: "destructive" });
      return;
    }
    createViewing.mutate(
      {
        leadId: parseInt(newViewing.leadId),
        propertyId: parseInt(newViewing.propertyId),
        agentId: newViewing.agentId ? parseInt(newViewing.agentId) : null,
        date: newViewing.date,
        time: newViewing.time,
        notes: newViewing.notes || null,
        status: "pending",
      },
      {
        onSuccess: () => {
          setNewViewing({ leadId: "", propertyId: "", agentId: "", date: "", time: "10:00", notes: "" });
          setShowAdd(false);
          toast({ title: "Viewing scheduled" });
        },
        onError: () => toast({ title: "Failed to schedule viewing", variant: "destructive" }),
      }
    );
  }

  function changeStatus(id: number, status: Status) {
    updateViewing.mutate(
      { id, data: { status } },
      { onSuccess: () => toast({ title: `Viewing marked as ${STATUS_CONFIG[status].label}` }) }
    );
  }

  function handleDelete(id: number) {
    deleteViewing.mutate(id, {
      onSuccess: () => { setDeleteViewingId(null); toast({ title: "Viewing removed" }); },
      onError: () => toast({ title: "Failed to delete viewing", variant: "destructive" }),
    });
  }

  const filtered = viewings.filter((v) => filterStatus === "all" || v.status === filterStatus);
  const upcomingCount = viewings.filter((v) => v.status === "confirmed" || v.status === "pending").length;
  const completedCount = viewings.filter((v) => v.status === "completed").length;
  const noShowCount = viewings.filter((v) => v.status === "no_show").length;

  return (
    <div className="p-6 space-y-5">
      <ConfirmDeleteDialog
        open={deleteViewingId !== null}
        onOpenChange={(open) => { if (!open) setDeleteViewingId(null); }}
        onConfirm={() => deleteViewingId && handleDelete(deleteViewingId)}
        title="Delete Viewing"
        description="Are you sure you want to delete this viewing? This action cannot be undone."
        loading={deleteViewing.isPending}
      />
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Calendar className="w-6 h-6 text-primary" />
            Viewings & Open Homes
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Schedule and track property viewings with leads</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gap-2">
          <Plus className="w-4 h-4" />Schedule Viewing
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-card-border rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-primary">{upcomingCount}</p>
          <p className="text-xs text-muted-foreground">Upcoming</p>
        </div>
        <div className="bg-card border border-card-border rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{completedCount}</p>
          <p className="text-xs text-muted-foreground">Completed</p>
        </div>
        <div className="bg-card border border-card-border rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-red-500">{noShowCount}</p>
          <p className="text-xs text-muted-foreground">No Shows</p>
        </div>
      </div>

      {/* Add viewing form */}
      {showAdd && (
        <div className="bg-card border border-primary/30 rounded-lg p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Schedule New Viewing</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Lead *</label>
              <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={newViewing.leadId} onChange={(e) => setNewViewing({ ...newViewing, leadId: e.target.value })}>
                <option value="">Select lead...</option>
                {(leads ?? []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Property *</label>
              <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={newViewing.propertyId} onChange={(e) => setNewViewing({ ...newViewing, propertyId: e.target.value })}>
                <option value="">Select property...</option>
                {(properties ?? []).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Agent</label>
              <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={newViewing.agentId} onChange={(e) => setNewViewing({ ...newViewing, agentId: e.target.value })}>
                <option value="">Assign agent...</option>
                {(agents ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Date *</label>
              <Input type="date" value={newViewing.date} onChange={(e) => setNewViewing({ ...newViewing, date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Time</label>
              <Input type="time" value={newViewing.time} onChange={(e) => setNewViewing({ ...newViewing, time: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Notes</label>
              <Input placeholder="Optional notes..." value={newViewing.notes} onChange={(e) => setNewViewing({ ...newViewing, notes: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button size="sm" onClick={addViewing} disabled={createViewing.isPending}>
              {createViewing.isPending ? "Scheduling..." : "Confirm Viewing"}
            </Button>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "confirmed", "pending", "completed", "no_show", "cancelled"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize",
              filterStatus === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
            )}
          >
            {s === "all" ? `All (${viewings.length})` : s === "no_show" ? "No Show" : STATUS_CONFIG[s].label}
          </button>
        ))}
      </div>

      {/* Viewings list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="bg-card border border-card-border rounded-lg p-10 text-center text-muted-foreground text-sm">
              No viewings match the current filter
            </div>
          )}
          {filtered.map((v) => {
            const cfg = STATUS_CONFIG[v.status as Status] ?? STATUS_CONFIG.pending;
            const Icon = cfg.icon;
            const isUpcoming = v.status === "pending" || v.status === "confirmed";

            return (
              <div key={v.id} className="bg-card border border-card-border rounded-lg p-4">
                <div className="flex items-start gap-4 flex-wrap">
                  {/* Date block */}
                  <div className="flex-shrink-0 bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 text-center min-w-[64px]">
                    <p className="text-xs font-medium text-primary">
                      {new Date(v.date).toLocaleDateString("en-IN", { month: "short" }).toUpperCase()}
                    </p>
                    <p className="text-2xl font-bold text-primary leading-none">
                      {new Date(v.date).getDate()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(v.date).toLocaleDateString("en-IN", { weekday: "short" })}
                    </p>
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold text-foreground">{v.leadName ?? "Unknown Lead"}</h3>
                      <span className={cn("flex items-center gap-1 text-xs font-medium border px-2 py-0.5 rounded-full", cfg.color)}>
                        <Icon className="w-3 h-3" />{cfg.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {v.propertyTitle ?? "Unknown Property"}
                        {v.propertyPrice != null && ` · ${formatCurrency(v.propertyPrice)}`}
                      </span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{v.time}</span>
                      {v.agentName && <span className="flex items-center gap-1"><User className="w-3 h-3" />{v.agentName}</span>}
                      {v.leadPhone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{v.leadPhone}</span>}
                    </div>
                    {v.notes && <p className="text-xs text-muted-foreground mt-1.5 italic">"{v.notes}"</p>}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isUpcoming && (
                      <>
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-green-700 border-green-200 hover:bg-green-50"
                          onClick={() => changeStatus(v.id, "completed")}>
                          <CheckCircle2 className="w-3 h-3" />Done
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => changeStatus(v.id, "no_show")}>
                          No Show
                        </Button>
                      </>
                    )}
                    {canEdit && (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                        onClick={() => setEditViewing(v)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {isOwner && (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteViewingId(v.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Viewing Modal */}
      {editViewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Pencil className="w-4 h-4 text-primary" />Edit Viewing
              </h3>
              <button onClick={() => setEditViewing(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <EditViewingForm
              viewing={editViewing}
              leads={leads}
              properties={properties}
              agents={agents}
              onSave={(data) => {
                updateViewing.mutate({ id: editViewing.id, data }, {
                  onSuccess: () => { setEditViewing(null); toast({ title: "Viewing updated ✓" }); },
                  onError: () => toast({ title: "Failed to update viewing", variant: "destructive" }),
                });
              }}
              onClose={() => setEditViewing(null)}
              isPending={updateViewing.isPending}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function EditViewingForm({ viewing, leads, properties, agents, onSave, onClose, isPending }: {
  viewing: ViewingRecord;
  leads: { id: number; name: string }[] | undefined;
  properties: { id: number; title: string }[] | undefined;
  agents: { id: number; name: string }[] | undefined;
  onSave: (data: Partial<ViewingRecord>) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState({
    leadId: viewing.leadId?.toString() ?? "",
    propertyId: viewing.propertyId?.toString() ?? "",
    agentId: viewing.agentId?.toString() ?? "",
    date: viewing.date,
    time: viewing.time,
    status: viewing.status,
    notes: viewing.notes ?? "",
  });

  const inp = "w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs font-medium text-muted-foreground block mb-1">Lead</label>
          <select value={form.leadId} onChange={e => setForm(p => ({ ...p, leadId: e.target.value }))} className={inp}>
            <option value="">— None —</option>
            {(leads ?? []).map(l => <option key={l.id} value={String(l.id)}>{l.name}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="text-xs font-medium text-muted-foreground block mb-1">Property</label>
          <select value={form.propertyId} onChange={e => setForm(p => ({ ...p, propertyId: e.target.value }))} className={inp}>
            <option value="">— None —</option>
            {(properties ?? []).map(p => <option key={p.id} value={String(p.id)}>{p.title}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="text-xs font-medium text-muted-foreground block mb-1">Agent</label>
          <select value={form.agentId} onChange={e => setForm(p => ({ ...p, agentId: e.target.value }))} className={inp}>
            <option value="">— Unassigned —</option>
            {(agents ?? []).map(a => <option key={a.id} value={String(a.id)}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Date</label>
          <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className={inp} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Time</label>
          <input type="time" value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))} className={inp} />
        </div>
        <div className="col-span-2">
          <label className="text-xs font-medium text-muted-foreground block mb-1">Status</label>
          <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as Status }))} className={inp}>
            {(["pending","confirmed","completed","no_show","cancelled"] as const).map(s => (
              <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="text-xs font-medium text-muted-foreground block mb-1">Notes</label>
          <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional notes..." className={inp} />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button className="flex-1" onClick={() => onSave({
          leadId: form.leadId ? parseInt(form.leadId) : null,
          propertyId: form.propertyId ? parseInt(form.propertyId) : null,
          agentId: form.agentId ? parseInt(form.agentId) : null,
          date: form.date,
          time: form.time,
          status: form.status as Status,
          notes: form.notes || null,
        })} disabled={isPending}>
          {isPending ? "Saving..." : "Save Changes"}
        </Button>
        <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}
