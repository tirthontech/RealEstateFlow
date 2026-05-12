import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  useGetProperties, useCreateProperty, useDeleteProperty,
  useGetLeads,
  getGetPropertiesQueryKey, getGetDashboardStatsQueryKey, getGetLeadsQueryKey, useGetAgents
} from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, Trash2, BedDouble, Bath, Maximize2, Calendar, Phone, MapPin, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/lib/role-context";
import { statusColor, stageLabel, formatCurrency, formatDate, PROPERTY_TYPES, PROPERTY_STATUSES, cn } from "@/lib/utils";

/* ─── Site Visit Dialog (salesperson only) ──────────────────────────── */
function SiteVisitDialog({ propertyTitle, open, onClose }: {
  propertyTitle: string; open: boolean; onClose: () => void;
}) {
  const { data: leads } = useGetLeads({}, { query: { queryKey: getGetLeadsQueryKey({}) } });
  const { toast } = useToast();
  const [leadId, setLeadId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("10:00");
  const [note, setNote] = useState("");

  function handleBook() {
    const lead = (leads ?? []).find(l => String(l.id) === leadId);
    toast({ title: `Site visit booked for ${lead?.name ?? "lead"} at ${propertyTitle} on ${date}` });
    onClose();
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-card rounded-xl border border-border shadow-xl w-full max-w-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" /> Book Site Visit
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-muted-foreground">Property: <span className="font-semibold text-foreground">{propertyTitle}</span></p>

        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Select Lead *</label>
          <select value={leadId} onChange={e => setLeadId(e.target.value)}
            className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
            <option value="">— choose a lead —</option>
            {(leads ?? []).map(l => <option key={l.id} value={String(l.id)}>{l.name} · {l.phone ?? l.email}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Time</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Note</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Any special instructions..."
            className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
        </div>

        <div className="flex gap-2 pt-1">
          <button disabled={!leadId} onClick={handleBook}
            className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
            Confirm Visit
          </button>
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted/50 transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  );
}

const createPropertySchema = z.object({
  title: z.string().min(1, "Title is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  price: z.coerce.number().min(1, "Price is required"),
  type: z.string().min(1),
  status: z.string().min(1),
  bedrooms: z.coerce.number().optional(),
  bathrooms: z.coerce.number().optional(),
  areaSqft: z.coerce.number().optional(),
  description: z.string().optional(),
  agentId: z.coerce.number().optional(),
});

type FormValues = z.infer<typeof createPropertySchema>;

export default function PropertiesPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [siteVisitProp, setSiteVisitProp] = useState<{ id: number; title: string } | null>(null);
  const [infoCard, setInfoCard] = useState<number | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();
  const { role } = useRole();
  const isSales = role === "sales";
  const [, setLocation] = useLocation();

  const params = {
    ...(typeFilter !== "all" ? { type: typeFilter } : {}),
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
  };
  const { data: properties, isLoading } = useGetProperties(params, { query: { queryKey: getGetPropertiesQueryKey(params) } });
  const { data: agents } = useGetAgents();

  const filtered = (properties ?? []).filter(p =>
    !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.city.toLowerCase().includes(search.toLowerCase())
  );

  const createProperty = useCreateProperty({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetPropertiesQueryKey() });
        qc.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
        setShowCreate(false);
        toast({ title: "Property added" });
      },
      onError: () => toast({ title: "Error adding property", variant: "destructive" }),
    },
  });
  const deleteProperty = useDeleteProperty({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetPropertiesQueryKey() });
        qc.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
        toast({ title: "Property deleted" });
      },
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(createPropertySchema),
    defaultValues: { title: "", address: "", city: "", price: 0, type: "residential", status: "available" },
  });

  function onSubmit(values: FormValues) {
    createProperty.mutate({ data: { ...values, bedrooms: values.bedrooms ?? null, bathrooms: values.bathrooms ?? null, areaSqft: values.areaSqft ?? null, description: values.description ?? null, agentId: values.agentId ?? null } });
  }

  return (
    <div className="p-6 space-y-5">
      {siteVisitProp && (
        <SiteVisitDialog
          propertyTitle={siteVisitProp.title}
          open={!!siteVisitProp}
          onClose={() => setSiteVisitProp(null)}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Properties</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isSales ? `${filtered.length} available properties — view details and book site visits` : `${filtered.length} listings`}
          </p>
        </div>
        {!isSales && (
          <Button data-testid="button-create-property" onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Add Property
          </Button>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search properties..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {PROPERTY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {PROPERTY_STATUSES.map(s => <SelectItem key={s} value={s}>{stageLabel(s)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-48 bg-muted rounded-lg animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-card-border rounded-lg py-16 text-center">
          <p className="text-muted-foreground text-sm">No properties found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((prop) => (
            <div key={prop.id} data-testid={`card-property-${prop.id}`}
              className="bg-card border border-card-border rounded-lg p-5 hover:border-primary/40 transition-colors flex flex-col gap-3"
              onClick={() => !isSales && setLocation(`/properties/${prop.id}`)}
              style={{ cursor: isSales ? "default" : "pointer" }}>

              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground text-sm truncate">{prop.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate flex items-center gap-1">
                    <MapPin className="w-3 h-3 flex-shrink-0" />{prop.address}, {prop.city}
                  </p>
                </div>
                {!isSales && (
                  <Button size="icon" variant="ghost" className="h-7 w-7 flex-shrink-0 text-destructive hover:text-destructive ml-2"
                    data-testid={`button-delete-property-${prop.id}`}
                    onClick={(e) => { e.stopPropagation(); if (confirm("Delete?")) deleteProperty.mutate({ id: prop.id }); }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>

              {/* Price */}
              <p className="text-xl font-bold text-primary">{formatCurrency(prop.price)}</p>

              {/* Specs */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {prop.bedrooms != null && <span className="flex items-center gap-1"><BedDouble className="w-3.5 h-3.5" />{prop.bedrooms} bd</span>}
                {prop.bathrooms != null && <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5" />{prop.bathrooms} ba</span>}
                {prop.areaSqft != null && <span className="flex items-center gap-1"><Maximize2 className="w-3.5 h-3.5" />{Number(prop.areaSqft).toLocaleString()} sqft</span>}
              </div>

              {/* Status + type */}
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColor(prop.status)}`}>{stageLabel(prop.status)}</span>
                <span className="text-xs text-muted-foreground capitalize">{prop.type}</span>
              </div>

              {/* Description expandable (salesperson info panel) */}
              {isSales && infoCard === prop.id && prop.description && (
                <div className="rounded-lg bg-muted/50 border border-border px-3 py-2 text-xs text-muted-foreground leading-relaxed">
                  {prop.description}
                </div>
              )}

              {/* Salesperson actions */}
              {isSales && (
                <div className="flex gap-2 pt-1 border-t border-border" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => setSiteVisitProp({ id: prop.id, title: prop.title })}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 transition-opacity">
                    <Calendar className="w-3.5 h-3.5" /> Book Site Visit
                  </button>
                  {prop.description && (
                    <button
                      onClick={() => setInfoCard(infoCard === prop.id ? null : prop.id)}
                      className={cn("flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                        infoCard === prop.id ? "bg-primary/10 text-primary border-primary/30" : "border-border text-muted-foreground hover:border-primary/40")}>
                      <Info className="w-3.5 h-3.5" /> Info
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={!isSales && showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Property</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem className="col-span-2"><FormLabel>Title</FormLabel><FormControl><Input data-testid="input-property-title" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="address" render={({ field }) => (
                  <FormItem className="col-span-2"><FormLabel>Address</FormLabel><FormControl><Input data-testid="input-property-address" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="city" render={({ field }) => (
                  <FormItem><FormLabel>City</FormLabel><FormControl><Input data-testid="input-property-city" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="price" render={({ field }) => (
                  <FormItem><FormLabel>Price ($)</FormLabel><FormControl><Input data-testid="input-property-price" type="number" {...field} /></FormControl><FormMessage /></FormItem>
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
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button type="submit" data-testid="button-submit-property" disabled={createProperty.isPending}>
                  {createProperty.isPending ? "Adding..." : "Add Property"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
