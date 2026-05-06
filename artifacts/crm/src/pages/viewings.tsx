import { useState } from "react";
import { useGetLeads, useGetProperties, useGetAgents, getGetLeadsQueryKey, getGetPropertiesQueryKey, getGetAgentsQueryKey } from "@workspace/api-client-react";
import { Calendar, Clock, MapPin, User, Plus, CheckCircle2, XCircle, HelpCircle, Trash2, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn, formatCurrency } from "@/lib/utils";

type Status = "confirmed" | "pending" | "completed" | "no_show" | "cancelled";

type Viewing = {
  id: number;
  leadId: number;
  propertyId: number;
  agentId: number;
  date: string;
  time: string;
  status: Status;
  notes?: string;
};

const STATUS_CONFIG: Record<Status, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  confirmed:  { label: "Confirmed",  color: "text-green-700 bg-green-50 border-green-200",   icon: CheckCircle2 },
  pending:    { label: "Pending",    color: "text-amber-700 bg-amber-50 border-amber-200",    icon: HelpCircle },
  completed:  { label: "Completed",  color: "text-blue-700 bg-blue-50 border-blue-200",       icon: CheckCircle2 },
  no_show:    { label: "No Show",    color: "text-red-700 bg-red-50 border-red-200",          icon: XCircle },
  cancelled:  { label: "Cancelled",  color: "text-slate-600 bg-slate-50 border-slate-200",    icon: XCircle },
};

const SEED_VIEWINGS: Viewing[] = [
  { id: 1, leadId: 1, propertyId: 1, agentId: 1, date: "2026-05-07", time: "10:00", status: "confirmed" },
  { id: 2, leadId: 2, propertyId: 2, agentId: 2, date: "2026-05-07", time: "14:30", status: "pending" },
  { id: 3, leadId: 3, propertyId: 3, agentId: 3, date: "2026-05-08", time: "11:00", status: "confirmed" },
  { id: 4, leadId: 4, propertyId: 1, agentId: 1, date: "2026-05-09", time: "16:00", status: "pending" },
  { id: 5, leadId: 5, propertyId: 4, agentId: 4, date: "2026-05-05", time: "09:30", status: "completed", notes: "Showed 3-bed unit. Lead very interested, wants to discuss financing." },
  { id: 6, leadId: 6, propertyId: 2, agentId: 2, date: "2026-05-04", time: "15:00", status: "no_show", notes: "Called twice, no response." },
];

export default function ViewingsPage() {
  const { toast } = useToast();
  const [viewings, setViewings] = useState<Viewing[]>(SEED_VIEWINGS);
  const [showAdd, setShowAdd] = useState(false);
  const [filterStatus, setFilterStatus] = useState<Status | "all">("all");
  const [newViewing, setNewViewing] = useState({ leadId: "", propertyId: "", agentId: "", date: "", time: "10:00", notes: "" });

  const { data: leads } = useGetLeads({}, { query: { queryKey: getGetLeadsQueryKey() } });
  const { data: properties } = useGetProperties({}, { query: { queryKey: getGetPropertiesQueryKey() } });
  const { data: agents } = useGetAgents({ query: { queryKey: getGetAgentsQueryKey() } });

  function addViewing() {
    if (!newViewing.leadId || !newViewing.propertyId || !newViewing.date) {
      toast({ title: "Please fill in lead, property, and date", variant: "destructive" }); return;
    }
    setViewings((prev) => [
      ...prev,
      {
        id: Date.now(), status: "pending",
        leadId: parseInt(newViewing.leadId),
        propertyId: parseInt(newViewing.propertyId),
        agentId: parseInt(newViewing.agentId) || (agents?.[0]?.id ?? 1),
        date: newViewing.date, time: newViewing.time, notes: newViewing.notes,
      },
    ]);
    setNewViewing({ leadId: "", propertyId: "", agentId: "", date: "", time: "10:00", notes: "" });
    setShowAdd(false);
    toast({ title: "Viewing scheduled ✓" });
  }

  function changeStatus(id: number, status: Status) {
    setViewings((prev) => prev.map((v) => v.id === id ? { ...v, status } : v));
    toast({ title: `Viewing marked as ${STATUS_CONFIG[status].label}` });
  }

  function deleteViewing(id: number) {
    setViewings((prev) => prev.filter((v) => v.id !== id));
    toast({ title: "Viewing removed" });
  }

  const filtered = viewings.filter((v) => filterStatus === "all" || v.status === filterStatus);
  const upcomingCount = viewings.filter((v) => v.status === "confirmed" || v.status === "pending").length;
  const completedCount = viewings.filter((v) => v.status === "completed").length;
  const noShowCount = viewings.filter((v) => v.status === "no_show").length;

  return (
    <div className="p-6 space-y-5">
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
            <Button size="sm" onClick={addViewing}>Confirm Viewing</Button>
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
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="bg-card border border-card-border rounded-lg p-10 text-center text-muted-foreground text-sm">
            No viewings match the current filter
          </div>
        )}
        {filtered.map((v) => {
          const lead = (leads ?? []).find((l) => l.id === v.leadId);
          const property = (properties ?? []).find((p) => p.id === v.propertyId);
          const agent = (agents ?? []).find((a) => a.id === v.agentId);
          const cfg = STATUS_CONFIG[v.status];
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
                    <h3 className="font-semibold text-foreground">{lead?.name ?? "Unknown Lead"}</h3>
                    <span className={cn("flex items-center gap-1 text-xs font-medium border px-2 py-0.5 rounded-full", cfg.color)}>
                      <Icon className="w-3 h-3" />{cfg.label}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{property?.title ?? "Unknown Property"}{property && ` · ${formatCurrency(property.price)}`}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{v.time}</span>
                    {agent && <span className="flex items-center gap-1"><User className="w-3 h-3" />{agent.name}</span>}
                    {lead?.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{lead.phone}</span>}
                  </div>
                  {v.notes && <p className="text-xs text-muted-foreground mt-1.5 italic">"{v.notes}"</p>}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isUpcoming && (
                    <>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-green-700 border-green-200 hover:bg-green-50" onClick={() => changeStatus(v.id, "completed")}>
                        <CheckCircle2 className="w-3 h-3" />Done
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50" onClick={() => changeStatus(v.id, "no_show")}>
                        No Show
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => deleteViewing(v.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
