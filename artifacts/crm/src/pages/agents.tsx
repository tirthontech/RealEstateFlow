import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useGetAgents, useCreateAgent, getGetAgentsQueryKey } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, ExternalLink, TrendingUp, Users, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, AGENT_ROLES, MARKETS } from "@/lib/utils";

const createAgentSchema = z.object({
  name: z.string().min(1, "Name required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  role: z.string().min(1),
  market: z.string().optional(),
});
type FormValues = z.infer<typeof createAgentSchema>;

export default function AgentsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: agents, isLoading } = useGetAgents();
  const createAgent = useCreateAgent({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetAgentsQueryKey() });
        setShowCreate(false);
        toast({ title: "Agent added" });
        form.reset();
      },
      onError: () => toast({ title: "Error adding agent", variant: "destructive" }),
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(createAgentSchema),
    defaultValues: { name: "", email: "", phone: "", role: "agent", market: "US" },
  });

  function onSubmit(values: FormValues) {
    createAgent.mutate({ data: { ...values, phone: values.phone ?? null, market: values.market ?? null } });
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agents</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{agents?.length ?? 0} team members</p>
        </div>
        <Button data-testid="button-create-agent" onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Add Agent
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-44 bg-muted rounded-lg animate-pulse" />)}
        </div>
      ) : (agents ?? []).length === 0 ? (
        <div className="bg-card border border-card-border rounded-lg py-16 text-center">
          <p className="text-muted-foreground text-sm">No agents yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {(agents ?? []).map((agent) => (
            <div key={agent.id} data-testid={`card-agent-${agent.id}`}
              className="bg-card border border-card-border rounded-lg p-5 cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => setLocation(`/agents/${agent.id}`)}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-foreground">{agent.name}</h3>
                  <p className="text-xs text-muted-foreground">{agent.email}</p>
                </div>
                <div className="flex gap-1.5">
                  <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground capitalize">{agent.role}</span>
                  {agent.market && <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">{agent.market}</span>}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-primary mb-0.5">
                    <Users className="w-3 h-3" />
                    <span className="text-sm font-bold">{agent.activeLeads}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Leads</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-primary mb-0.5">
                    <GitBranch className="w-3 h-3" />
                    <span className="text-sm font-bold">{agent.dealsCount}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Deals</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-primary mb-0.5">
                    <TrendingUp className="w-3 h-3" />
                    <span className="text-sm font-bold">{formatCurrency(agent.revenue)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Revenue</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Agent</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Name</FormLabel><FormControl><Input data-testid="input-agent-name" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Email</FormLabel><FormControl><Input data-testid="input-agent-email" type="email" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="role" render={({ field }) => (
                  <FormItem><FormLabel>Role</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{AGENT_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="market" render={({ field }) => (
                  <FormItem><FormLabel>Market</FormLabel>
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                      <SelectContent>{MARKETS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button type="submit" data-testid="button-submit-agent" disabled={createAgent.isPending}>
                  {createAgent.isPending ? "Adding..." : "Add Agent"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
