import { useParams, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useGetProperty, useUpdateProperty, getGetPropertiesQueryKey, getGetPropertyQueryKey, useGetAgents } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Edit2, Save, X, BedDouble, Bath, Maximize2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { statusColor, stageLabel, formatCurrency, formatDate, PROPERTY_TYPES, PROPERTY_STATUSES } from "@/lib/utils";
import { useState, useEffect } from "react";

const editSchema = z.object({
  title: z.string().min(1), address: z.string().min(1), city: z.string().min(1),
  price: z.coerce.number().min(1), type: z.string(), status: z.string(),
  bedrooms: z.coerce.number().optional(), bathrooms: z.coerce.number().optional(),
  areaSqft: z.coerce.number().optional(), description: z.string().optional(),
  agentId: z.coerce.number().optional(),
});
type FormValues = z.infer<typeof editSchema>;

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const numId = parseInt(id ?? "", 10);
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);

  const { data: prop, isLoading } = useGetProperty(numId, { query: { queryKey: getGetPropertyQueryKey(numId), enabled: !isNaN(numId) } });
  const { data: agents } = useGetAgents();
  const updateProperty = useUpdateProperty({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetPropertyQueryKey(numId) });
        qc.invalidateQueries({ queryKey: getGetPropertiesQueryKey() });
        setEditing(false);
        toast({ title: "Property updated" });
      },
      onError: () => toast({ title: "Update failed", variant: "destructive" }),
    },
  });

  const form = useForm<FormValues>({ resolver: zodResolver(editSchema), defaultValues: { title: "", address: "", city: "", price: 0, type: "residential", status: "available" } });

  useEffect(() => {
    if (prop) {
      form.reset({
        title: prop.title, address: prop.address, city: prop.city, price: prop.price,
        type: prop.type, status: prop.status, bedrooms: prop.bedrooms ?? undefined,
        bathrooms: prop.bathrooms ?? undefined, areaSqft: prop.areaSqft != null ? Number(prop.areaSqft) : undefined,
        description: prop.description ?? "", agentId: prop.agentId ?? undefined,
      });
    }
  }, [prop, form]);

  if (isNaN(numId)) return <div className="p-6 text-muted-foreground">Invalid property ID</div>;
  if (isLoading) return <div className="p-6"><div className="h-8 w-48 bg-muted rounded animate-pulse" /></div>;
  if (!prop) return <div className="p-6 text-muted-foreground">Property not found</div>;

  function onSubmit(values: FormValues) {
    updateProperty.mutate({ id: numId, data: { ...values, bedrooms: values.bedrooms ?? null, bathrooms: values.bathrooms ?? null, areaSqft: values.areaSqft ?? null, description: values.description ?? null, agentId: values.agentId ?? null } });
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/properties")}><ArrowLeft className="w-4 h-4" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{prop.title}</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{prop.address}, {prop.city}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded text-xs font-medium ${statusColor(prop.status)}`}>{stageLabel(prop.status)}</span>
          {!editing ? (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Edit2 className="w-3.5 h-3.5 mr-1" />Edit</Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}><X className="w-3.5 h-3.5" /></Button>
          )}
        </div>
      </div>

      {!editing ? (
        <div className="space-y-4">
          <div className="bg-card border border-card-border rounded-lg p-5">
            <p className="text-3xl font-bold text-primary">{formatCurrency(prop.price)}</p>
            <div className="flex gap-4 mt-3 text-sm text-muted-foreground">
              {prop.bedrooms != null && <span className="flex items-center gap-1.5"><BedDouble className="w-4 h-4" />{prop.bedrooms} bedrooms</span>}
              {prop.bathrooms != null && <span className="flex items-center gap-1.5"><Bath className="w-4 h-4" />{prop.bathrooms} bathrooms</span>}
              {prop.areaSqft != null && <span className="flex items-center gap-1.5"><Maximize2 className="w-4 h-4" />{Number(prop.areaSqft).toLocaleString()} sqft</span>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Type", value: <span className="capitalize">{prop.type}</span> },
              { label: "Listing Agent", value: prop.agentName ?? "Unassigned" },
              { label: "Listed", value: formatDate(prop.createdAt) },
              { label: "Updated", value: formatDate(prop.updatedAt) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-card border border-card-border rounded-lg p-4">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">{label}</p>
                <p className="text-sm text-foreground">{value}</p>
              </div>
            ))}
          </div>
          {prop.description && (
            <div className="bg-card border border-card-border rounded-lg p-4">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Description</p>
              <p className="text-sm text-foreground">{prop.description}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-card border border-card-border rounded-lg p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem className="col-span-2"><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="address" render={({ field }) => (
                  <FormItem className="col-span-2"><FormLabel>Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="city" render={({ field }) => (
                  <FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="price" render={({ field }) => (
                  <FormItem><FormLabel>Price ($)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="type" render={({ field }) => (
                  <FormItem><FormLabel>Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{PROPERTY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem><FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{PROPERTY_STATUSES.map(s => <SelectItem key={s} value={s}>{stageLabel(s)}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="bedrooms" render={({ field }) => (
                  <FormItem><FormLabel>Bedrooms</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="bathrooms" render={({ field }) => (
                  <FormItem><FormLabel>Bathrooms</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="areaSqft" render={({ field }) => (
                  <FormItem><FormLabel>Area (sqft)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="agentId" render={({ field }) => (
                  <FormItem><FormLabel>Agent</FormLabel>
                    <Select value={field.value?.toString() ?? ""} onValueChange={(v) => field.onChange(Number(v))}>
                      <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                      <SelectContent>{(agents ?? []).map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                <Button type="submit" disabled={updateProperty.isPending}><Save className="w-3.5 h-3.5 mr-1" />{updateProperty.isPending ? "Saving..." : "Save"}</Button>
              </div>
            </form>
          </Form>
        </div>
      )}
    </div>
  );
}
