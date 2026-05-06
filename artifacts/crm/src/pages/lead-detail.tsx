import { useParams, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useGetLead, useUpdateLead, getGetLeadsQueryKey, getGetLeadQueryKey, useGetAgents } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Edit2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { statusColor, stageLabel, formatCurrency, formatDate, LEAD_STATUSES, LEAD_SOURCES, PROPERTY_TYPES, scoreColor } from "@/lib/utils";
import { useState, useEffect } from "react";

const editSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  source: z.string(),
  status: z.string(),
  score: z.coerce.number().min(0).max(100),
  budget: z.coerce.number().optional(),
  propertyType: z.string().optional(),
  notes: z.string().optional(),
  assignedTo: z.coerce.number().optional(),
});

type FormValues = z.infer<typeof editSchema>;

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);

  const { data: lead, isLoading } = useGetLead(Number(id), { query: { queryKey: getGetLeadQueryKey(Number(id)) } });
  const { data: agents } = useGetAgents();
  const updateLead = useUpdateLead({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetLeadQueryKey(Number(id)) });
        qc.invalidateQueries({ queryKey: getGetLeadsQueryKey() });
        setEditing(false);
        toast({ title: "Lead updated" });
      },
      onError: () => toast({ title: "Update failed", variant: "destructive" }),
    },
  });

  const form = useForm<FormValues>({ resolver: zodResolver(editSchema), defaultValues: { name: "", email: "", source: "website", status: "new", score: 50 } });

  useEffect(() => {
    if (lead) {
      form.reset({
        name: lead.name, email: lead.email, phone: lead.phone ?? "", source: lead.source,
        status: lead.status, score: lead.score, budget: lead.budget ?? undefined,
        propertyType: lead.propertyType ?? "", notes: lead.notes ?? "",
        assignedTo: lead.assignedTo ?? undefined,
      });
    }
  }, [lead, form]);

  if (isLoading) return <div className="p-6"><div className="h-8 w-48 bg-muted rounded animate-pulse" /></div>;
  if (!lead) return <div className="p-6 text-muted-foreground">Lead not found</div>;

  function onSubmit(values: FormValues) {
    updateLead.mutate({ id: Number(id), data: { ...values, budget: values.budget ?? null, propertyType: values.propertyType ?? null, notes: values.notes ?? null, assignedTo: values.assignedTo ?? null } });
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/leads")} data-testid="button-back">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{lead.name}</h1>
          <p className="text-sm text-muted-foreground">{lead.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium ${statusColor(lead.status)}`}>{stageLabel(lead.status)}</span>
          {!editing ? (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)} data-testid="button-edit-lead"><Edit2 className="w-3.5 h-3.5 mr-1" />Edit</Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} data-testid="button-cancel-edit"><X className="w-3.5 h-3.5" /></Button>
          )}
        </div>
      </div>

      {!editing ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { label: "Phone", value: lead.phone ?? "—" },
            { label: "Source", value: <span className="capitalize">{lead.source}</span> },
            { label: "Score", value: <span className={`font-semibold ${scoreColor(lead.score)}`}>{lead.score}/100</span> },
            { label: "Budget", value: lead.budget ? formatCurrency(lead.budget) : "—" },
            { label: "Property Type", value: lead.propertyType ?? "—" },
            { label: "Assigned To", value: lead.agentName ?? "Unassigned" },
            { label: "Created", value: formatDate(lead.createdAt) },
            { label: "Updated", value: formatDate(lead.updatedAt) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-card border border-card-border rounded-lg p-4">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">{label}</p>
              <p className="text-sm text-foreground">{value}</p>
            </div>
          ))}
          {lead.notes && (
            <div className="bg-card border border-card-border rounded-lg p-4 md:col-span-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Notes</p>
              <p className="text-sm text-foreground">{lead.notes}</p>
            </div>
          )}
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
                <FormField control={form.control} name="source" render={({ field }) => (
                  <FormItem><FormLabel>Source</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{LEAD_SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem><FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{LEAD_STATUSES.map(s => <SelectItem key={s} value={s}>{stageLabel(s)}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="score" render={({ field }) => (
                  <FormItem><FormLabel>Score</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="budget" render={({ field }) => (
                  <FormItem><FormLabel>Budget ($)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="propertyType" render={({ field }) => (
                  <FormItem><FormLabel>Property Type</FormLabel>
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                      <SelectContent>{PROPERTY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="assignedTo" render={({ field }) => (
                  <FormItem><FormLabel>Agent</FormLabel>
                    <Select value={field.value?.toString() ?? ""} onValueChange={(v) => field.onChange(Number(v))}>
                      <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                      <SelectContent>{(agents ?? []).map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                <Button type="submit" data-testid="button-save-lead" disabled={updateLead.isPending}>
                  <Save className="w-3.5 h-3.5 mr-1" />{updateLead.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      )}
    </div>
  );
}
