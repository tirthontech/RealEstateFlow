import { useParams, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useGetAgent, useUpdateAgent, getGetAgentsQueryKey, getGetAgentQueryKey } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Edit2, Save, X, Mail, Phone, TrendingUp, Users, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate, AGENT_ROLES, MARKETS } from "@/lib/utils";
import { useState, useEffect } from "react";

const editSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  role: z.string(),
  market: z.string().optional(),
});
type FormValues = z.infer<typeof editSchema>;

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);

  const { data: agent, isLoading } = useGetAgent(Number(id), { query: { queryKey: getGetAgentQueryKey(Number(id)) } });
  const updateAgent = useUpdateAgent({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetAgentQueryKey(Number(id)) });
        qc.invalidateQueries({ queryKey: getGetAgentsQueryKey() });
        setEditing(false);
        toast({ title: "Agent updated" });
      },
      onError: () => toast({ title: "Update failed", variant: "destructive" }),
    },
  });

  const form = useForm<FormValues>({ resolver: zodResolver(editSchema), defaultValues: { name: "", email: "", role: "agent" } });

  useEffect(() => {
    if (agent) {
      form.reset({ name: agent.name, email: agent.email, phone: agent.phone ?? "", role: agent.role, market: agent.market ?? "" });
    }
  }, [agent, form]);

  if (isLoading) return <div className="p-6"><div className="h-8 w-48 bg-muted rounded animate-pulse" /></div>;
  if (!agent) return <div className="p-6 text-muted-foreground">Agent not found</div>;

  function onSubmit(values: FormValues) {
    updateAgent.mutate({ id: Number(id), data: { ...values, phone: values.phone ?? null, market: values.market ?? null } });
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/agents")}><ArrowLeft className="w-4 h-4" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{agent.name}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground capitalize">{agent.role}</span>
            {agent.market && <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">{agent.market}</span>}
          </div>
        </div>
        {!editing ? (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)} data-testid="button-edit-agent"><Edit2 className="w-3.5 h-3.5 mr-1" />Edit</Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}><X className="w-3.5 h-3.5" /></Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-card-border rounded-lg p-4 text-center">
          <Users className="w-5 h-5 text-primary mx-auto mb-1.5" />
          <p className="text-2xl font-bold text-foreground">{agent.activeLeads}</p>
          <p className="text-xs text-muted-foreground">Active Leads</p>
        </div>
        <div className="bg-card border border-card-border rounded-lg p-4 text-center">
          <GitBranch className="w-5 h-5 text-primary mx-auto mb-1.5" />
          <p className="text-2xl font-bold text-foreground">{agent.dealsCount}</p>
          <p className="text-xs text-muted-foreground">Deals</p>
        </div>
        <div className="bg-card border border-card-border rounded-lg p-4 text-center">
          <TrendingUp className="w-5 h-5 text-primary mx-auto mb-1.5" />
          <p className="text-2xl font-bold text-foreground">{formatCurrency(agent.revenue)}</p>
          <p className="text-xs text-muted-foreground">Revenue</p>
        </div>
      </div>

      {!editing ? (
        <div className="bg-card border border-card-border rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-3 text-sm">
            <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <a href={`mailto:${agent.email}`} className="text-primary hover:underline">{agent.email}</a>
          </div>
          {agent.phone && (
            <div className="flex items-center gap-3 text-sm">
              <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-foreground">{agent.phone}</span>
            </div>
          )}
          <div className="pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground">Member since {formatDate(agent.createdAt)}</p>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-card-border rounded-lg p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
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
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                <Button type="submit" data-testid="button-save-agent" disabled={updateAgent.isPending}>
                  <Save className="w-3.5 h-3.5 mr-1" />{updateAgent.isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      )}
    </div>
  );
}
