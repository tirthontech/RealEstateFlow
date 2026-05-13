import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  useGetAgents, useCreateAgent, useGetLeads, useUpdateLead,
  getGetAgentsQueryKey, getGetLeadsQueryKey, customFetch,
} from "@workspace/api-client-react";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus, Users, Activity, ShieldCheck, ShieldOff,
  Mail, Phone, ExternalLink, Info, UserPlus, Trash2, UserCheck, X, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, cn } from "@/lib/utils";
import { useRole } from "@/lib/role-context";

const createAgentSchema = z.object({
  name: z.string().min(1, "Name required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  role: z.string().min(1),
});
type FormValues = z.infer<typeof createAgentSchema>;

const ROLE_COLORS: Record<string, string> = {
  manager: "bg-green-100 text-green-800",
  agent:   "bg-purple-100 text-purple-800",
  broker:  "bg-teal-100 text-teal-800",
};
function roleColor(role: string) {
  return ROLE_COLORS[role] ?? "bg-muted text-muted-foreground";
}

/* ─── Assign Lead Modal ──────────────────────────────────────────────── */
function AssignLeadModal({ agent, onClose }: { agent: { id: number; name: string }; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: leads = [], isLoading } = useGetLeads({}, { query: { queryKey: getGetLeadsQueryKey({}) } });
  const updateLead = useUpdateLead({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetLeadsQueryKey({}) });
        qc.invalidateQueries({ queryKey: getGetAgentsQueryKey() });
        toast({ title: `Lead assigned to ${agent.name}` });
        onClose();
      },
      onError: () => toast({ title: "Failed to assign lead", variant: "destructive" }),
    },
  });

  const unassigned = leads.filter(l => !l.assignedTo || l.status === "unassigned");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <p className="font-semibold text-sm text-foreground">Assign Lead</p>
            <p className="text-xs text-muted-foreground mt-0.5">Pick a lead to assign to <span className="font-medium">{agent.name}</span></p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-0.5"><X className="w-4 h-4" /></button>
        </div>
        <div className="max-h-72 overflow-y-auto divide-y divide-border">
          {isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : unassigned.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No unassigned leads</p>
          ) : unassigned.map(lead => (
            <button
              key={lead.id}
              disabled={updateLead.isPending}
              onClick={() => updateLead.mutate({ id: lead.id, data: { assignedTo: agent.id } })}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors text-left disabled:opacity-50 group"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{lead.name}</p>
                <p className="text-xs text-muted-foreground truncate">{lead.source} · {lead.phone ?? lead.email}</p>
              </div>
              {updateLead.isPending
                ? <Loader2 className="w-3.5 h-3.5 text-primary animate-spin flex-shrink-0" />
                : <UserCheck className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary flex-shrink-0" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AgentsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [assignTarget, setAssignTarget] = useState<{ id: number; name: string } | null>(null);
  const [deleteName, setDeleteName] = useState("");
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { role: myRole } = useRole();
  const isAdmin = myRole === "owner";

  const deleteAgent = useMutation({
    mutationFn: (id: number) => customFetch(`/api/agents/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getGetAgentsQueryKey() });
      setDeleteId(null);
      toast({ title: "Agent deleted" });
    },
    onError: () => toast({ title: "Failed to delete agent", variant: "destructive" }),
  });

  const { data: agents, isLoading } = useGetAgents();
  const createAgent = useCreateAgent({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetAgentsQueryKey() });
        setShowCreate(false);
        toast({ title: "Agent profile created (no login access)" });
        form.reset();
      },
      onError: (e: any) => toast({
        title: "Error adding agent",
        description: e?.response?.data?.error ?? "Please try again",
        variant: "destructive",
      }),
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(createAgentSchema),
    defaultValues: { name: "", email: "", phone: "", role: "agent" },
  });

  function onSubmit(values: FormValues) {
    createAgent.mutate({ data: { ...values, phone: values.phone || null } });
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {assignTarget && <AssignLeadModal agent={assignTarget} onClose={() => setAssignTarget(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Agents</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {agents?.length ?? 0} team member{(agents?.length ?? 0) !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setLocation("/admin/users")}>
              <UserPlus className="w-3.5 h-3.5" />
              Add with Login
            </Button>
          )}
          <Button data-testid="button-create-agent" onClick={() => setShowCreate(true)} size="sm" className="gap-1.5 text-xs">
            <Plus className="w-3.5 h-3.5" />
            Add Agent
          </Button>
        </div>
      </div>

      {/* Info banner for admins */}
      {isAdmin && (
        <div className="flex items-start gap-2.5 text-xs px-3.5 py-2.5 bg-blue-50 border border-blue-200 rounded-lg text-blue-800">
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <p>
            <span className="font-semibold">Two ways to add agents:</span>{" "}
            Use <span className="font-medium">Add Agent</span> for a CRM profile without login, or{" "}
            <button onClick={() => setLocation("/admin/users")} className="underline font-medium hover:text-blue-900">
              Settings → Users
            </button>{" "}
            to create a login account (automatically links an agent profile).
          </p>
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-52 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : (agents ?? []).length === 0 ? (
        <div className="bg-card border border-card-border rounded-xl py-16 text-center">
          <Users className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm font-medium">No agents yet</p>
          <p className="text-xs text-muted-foreground mt-1">Add an agent profile or create a user with an agent role.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {(agents ?? []).map((agent) => (
            <div
              key={agent.id}
              data-testid={`card-agent-${agent.id}`}
              className="bg-card border border-card-border rounded-xl overflow-hidden hover:shadow-md hover:border-primary/30 transition-all group"
            >
              {/* Card header */}
              <div className="p-4 pb-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  {/* Avatar + name */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {agent.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground text-sm leading-tight truncate">{agent.name}</h3>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize", roleColor(agent.role))}>
                          {agent.role}
                        </span>
                        {agent.hasLogin ? (
                          <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">
                            <ShieldCheck className="w-2.5 h-2.5" />Login Enabled
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                            <ShieldOff className="w-2.5 h-2.5" />No Login
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setLocation(`/agents/${agent.id}`)}
                    className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Contact info */}
                <div className="space-y-1 mt-2.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5 truncate">
                    <Mail className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{agent.email}</span>
                  </div>
                  {agent.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3 h-3 flex-shrink-0" />
                      <span>{agent.phone}</span>
                    </div>
                  )}
                  {agent.hasLogin && agent.username && (
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3 h-3 flex-shrink-0 text-green-600" />
                      <span className="font-mono text-green-700 font-medium">{agent.username}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-4 divide-x divide-border border-t border-border bg-muted/20">
                <div className="py-2 text-center">
                  <p className="text-sm font-bold text-foreground">{agent.activeLeads}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Leads</p>
                </div>
                <div className="py-2 text-center">
                  <p className="text-sm font-bold text-foreground">{agent.dealsCount}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Deals</p>
                </div>
                <div className="py-2 text-center">
                  <p className="text-sm font-bold text-foreground">{agent.activitiesCount}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Activities</p>
                </div>
                <div className="py-2 text-center">
                  <p className="text-[11px] font-bold text-foreground leading-tight">{formatCurrency(agent.revenue)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Revenue</p>
                </div>
              </div>

              {/* Quick actions */}
              <div className="flex divide-x divide-border border-t border-border">
                <button
                  onClick={() => setLocation("/leads")}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                >
                  <Users className="w-3 h-3" />View Leads
                </button>
                <button
                  onClick={() => setLocation("/activities")}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                >
                  <Activity className="w-3 h-3" />Activities
                </button>
                <button
                  onClick={() => setAssignTarget({ id: agent.id, name: agent.name })}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium text-muted-foreground hover:text-green-700 hover:bg-green-50 transition-colors"
                >
                  <UserCheck className="w-3 h-3" />Assign Lead
                </button>
                {isAdmin && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteName(agent.name); setDeleteId(agent.id); }}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
                    title="Delete agent"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDeleteDialog
        open={deleteId !== null}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        onConfirm={() => deleteId && deleteAgent.mutate(deleteId)}
        title="Delete Agent"
        description={`Are you sure you want to delete "${deleteName}"? Their leads will become unassigned. This action cannot be undone.`}
        loading={deleteAgent.isPending}
      />

      {/* Add Agent dialog (no login — CRM profile only) */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" />
              Add Agent Profile
            </DialogTitle>
          </DialogHeader>

          <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 mb-1">
            This creates a CRM-only profile with <span className="font-semibold">no login access</span>. To allow this agent to log in, use{" "}
            <button onClick={() => { setShowCreate(false); setLocation("/admin/users"); }} className="underline font-medium">
              Settings → Users
            </button> instead.
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Full Name *</FormLabel><FormControl>
                  <Input data-testid="input-agent-name" placeholder="Riya Sharma" {...field} />
                </FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Work Email *</FormLabel><FormControl>
                  <Input data-testid="input-agent-email" type="email" placeholder="riya@company.com" {...field} />
                </FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem><FormLabel>Phone</FormLabel><FormControl>
                    <Input placeholder="+91 98xxx xxxxx" {...field} />
                  </FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="role" render={({ field }) => (
                  <FormItem><FormLabel>Role</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="agent">Agent</SelectItem>
                        <SelectItem value="broker">Broker</SelectItem>
                      </SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button type="submit" data-testid="button-submit-agent" disabled={createAgent.isPending}>
                  {createAgent.isPending ? "Adding…" : "Add Agent"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
