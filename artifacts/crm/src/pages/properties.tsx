import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  useGetProperties, useCreateProperty, useDeleteProperty,
  useGetLeads, useGetAgents,
  getGetPropertiesQueryKey, getGetDashboardStatsQueryKey, getGetLeadsQueryKey,
} from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus, Search, Trash2, BedDouble, Bath, Maximize2, Calendar, MapPin,
  Info, X, ChevronDown, ChevronUp, Package, FileText, IndianRupee,
  Lock, CheckCircle2, Edit2, Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/lib/role-context";
import { useAuth } from "@/lib/auth-context";
import { statusColor, stageLabel, formatCurrency, PROPERTY_TYPES, PROPERTY_STATUSES, cn } from "@/lib/utils";

/* ─── Types ──────────────────────────────────────────────────────────── */
interface Unit {
  id: number;
  propertyId: number;
  unitNo: string;
  bhkType: string;
  floor: number | null;
  facing: string | null;
  carpetArea: number | null;
  saleableArea: number | null;
  bsp: number | null;
  plcCharges: number | null;
  parkingCharges: number | null;
  isPremium: boolean;
  status: "available" | "blocked" | "booked" | "sold";
  blockedByLeadId: number | null;
  blockedByLeadName: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

const BHK_TYPES = ["Studio", "1BHK", "2BHK", "3BHK", "4BHK", "Penthouse", "Commercial"];
const FACING_OPTIONS = ["North", "South", "East", "West", "Garden", "Pool", "Corner"];

const UNIT_STATUS_COLOR: Record<string, string> = {
  available: "bg-green-100 text-green-700",
  blocked:   "bg-amber-100 text-amber-700",
  booked:    "bg-blue-100 text-blue-700",
  sold:      "bg-slate-100 text-slate-600",
};

/* ─── Cost Sheet ─────────────────────────────────────────────────────── */
function CostSheet({ unit, onClose }: { unit: Unit; onClose: () => void }) {
  const area = unit.saleableArea ?? unit.carpetArea ?? 0;
  const carpet = unit.carpetArea ?? area;
  const bsp = unit.bsp ?? 0;
  const floor = unit.floor ?? 0;

  const base   = bsp * area;
  const floorRise = Math.max(0, floor - 1) * 50 * carpet;   // ₹50/sqft/floor above GF
  const facingPLC = (() => {
    if (!unit.facing) return 0;
    const f = unit.facing.toLowerCase();
    if (f === "garden" || f === "pool") return 200 * carpet;
    if (f === "corner") return 150 * carpet;
    if (f === "east" || f === "north") return 100 * carpet;
    return 0;
  })();
  const plc       = unit.plcCharges ?? facingPLC;
  const parking   = unit.parkingCharges ?? 500000;
  const clubhouse = 200000;
  const maintenance = carpet * 2 * 24;   // ₹2/sqft × 24 months
  const subtotal  = base + floorRise + plc + parking + clubhouse;
  const gst       = subtotal * 0.05;
  const total     = subtotal + gst + maintenance;

  const Row = ({ label, value, light }: { label: string; value: string; light?: boolean }) => (
    <div className={`flex justify-between text-sm ${light ? "text-muted-foreground" : "text-foreground"}`}>
      <span>{label}</span><span className="font-medium">{value}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center px-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <div>
              <p className="font-semibold text-foreground text-sm">Cost Sheet — {unit.unitNo}</p>
              <p className="text-[10px] text-muted-foreground">{unit.bhkType} · Floor {unit.floor ?? "G"} · {unit.facing ?? "—"} facing</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-0.5"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-5 py-4 space-y-2.5">
          <div className="flex justify-between text-xs text-muted-foreground pb-1 border-b border-border">
            <span>Saleable Area: {area.toLocaleString()} sqft · BSP: ₹{bsp.toLocaleString()}/sqft</span>
          </div>

          <Row label="Basic Sale Price (BSP)" value={formatCurrency(base)} />
          {floorRise > 0 && <Row label={`Floor Rise (Floor ${floor})`} value={formatCurrency(floorRise)} light />}
          {plc > 0 && <Row label={`PLC (${unit.facing})`} value={formatCurrency(plc)} light />}
          <Row label="Parking Charges" value={formatCurrency(parking)} light />
          <Row label="Clubhouse / Amenity" value={formatCurrency(clubhouse)} light />

          <div className="border-t border-dashed border-border pt-2">
            <Row label="Sub-Total" value={formatCurrency(subtotal)} />
            <Row label="GST @ 5%" value={formatCurrency(gst)} light />
          </div>

          <div className="border-t border-border pt-2">
            <Row label="Maintenance Deposit (24 mo)" value={formatCurrency(maintenance)} light />
            <div className="flex justify-between text-base font-bold text-foreground mt-2 pt-2 border-t border-border">
              <span>Total Payable</span><span className="text-primary">{formatCurrency(total)}</span>
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 leading-relaxed">
            Note: Stamp duty + registration (~5.5% in Maharashtra) will be charged on agreement value separately.
            Prices are indicative and subject to revision.
          </p>
        </div>

        <div className="px-5 pb-4 flex gap-2">
          <button onClick={onClose} className="flex-1 h-9 rounded-lg border border-border text-sm hover:bg-muted/50 transition-colors">Close</button>
          <button onClick={() => window.print()} className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            Print / Share
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Add/Edit Unit Modal ────────────────────────────────────────────── */
function UnitFormModal({
  propertyId, existing, token, leads, onSave, onClose,
}: {
  propertyId: number;
  existing?: Unit;
  token: string;
  leads: { id: number; name: string }[];
  onSave: (u: Unit) => void;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    unitNo: existing?.unitNo ?? "",
    bhkType: existing?.bhkType ?? "2BHK",
    floor: existing?.floor?.toString() ?? "",
    facing: existing?.facing ?? "",
    carpetArea: existing?.carpetArea?.toString() ?? "",
    saleableArea: existing?.saleableArea?.toString() ?? "",
    bsp: existing?.bsp?.toString() ?? "",
    plcCharges: existing?.plcCharges?.toString() ?? "0",
    parkingCharges: existing?.parkingCharges?.toString() ?? "500000",
    isPremium: existing?.isPremium ?? false,
    notes: existing?.notes ?? "",
  });

  async function save() {
    if (!f.unitNo || !f.bhkType) { toast({ title: "Unit No and BHK type required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const body = {
        propertyId,
        unitNo: f.unitNo,
        bhkType: f.bhkType,
        floor: f.floor ? Number(f.floor) : null,
        facing: f.facing || null,
        carpetArea: f.carpetArea ? Number(f.carpetArea) : null,
        saleableArea: f.saleableArea ? Number(f.saleableArea) : null,
        bsp: f.bsp ? Number(f.bsp) : null,
        plcCharges: f.plcCharges ? Number(f.plcCharges) : 0,
        parkingCharges: f.parkingCharges ? Number(f.parkingCharges) : 500000,
        isPremium: f.isPremium,
        notes: f.notes || null,
      };
      const url = existing ? `/api/units/${existing.id}` : "/api/units";
      const method = existing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Failed"); }
      const unit = await res.json();
      onSave(unit);
      toast({ title: existing ? "Unit updated" : "Unit added" });
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  const inp = "w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center px-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <p className="font-semibold text-foreground">{existing ? "Edit Unit" : "Add Unit"}</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-0.5"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 grid grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto">
          <div><label className="text-xs font-medium text-muted-foreground block mb-1">Unit No *</label>
            <input value={f.unitNo} onChange={e => setF(p => ({ ...p, unitNo: e.target.value }))} placeholder="A-504" className={inp} /></div>

          <div><label className="text-xs font-medium text-muted-foreground block mb-1">BHK Type *</label>
            <select value={f.bhkType} onChange={e => setF(p => ({ ...p, bhkType: e.target.value }))} className={inp}>
              {BHK_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
            </select></div>

          <div><label className="text-xs font-medium text-muted-foreground block mb-1">Floor</label>
            <input type="number" value={f.floor} onChange={e => setF(p => ({ ...p, floor: e.target.value }))} placeholder="5" className={inp} /></div>

          <div><label className="text-xs font-medium text-muted-foreground block mb-1">Facing</label>
            <select value={f.facing} onChange={e => setF(p => ({ ...p, facing: e.target.value }))} className={inp}>
              <option value="">— Select —</option>
              {FACING_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
            </select></div>

          <div><label className="text-xs font-medium text-muted-foreground block mb-1">Carpet Area (sqft)</label>
            <input type="number" value={f.carpetArea} onChange={e => setF(p => ({ ...p, carpetArea: e.target.value }))} placeholder="850" className={inp} /></div>

          <div><label className="text-xs font-medium text-muted-foreground block mb-1">Saleable Area (sqft)</label>
            <input type="number" value={f.saleableArea} onChange={e => setF(p => ({ ...p, saleableArea: e.target.value }))} placeholder="1100" className={inp} /></div>

          <div><label className="text-xs font-medium text-muted-foreground block mb-1">BSP (₹ per sqft)</label>
            <input type="number" value={f.bsp} onChange={e => setF(p => ({ ...p, bsp: e.target.value }))} placeholder="12500" className={inp} /></div>

          <div><label className="text-xs font-medium text-muted-foreground block mb-1">PLC Charges (₹)</label>
            <input type="number" value={f.plcCharges} onChange={e => setF(p => ({ ...p, plcCharges: e.target.value }))} placeholder="0" className={inp} /></div>

          <div><label className="text-xs font-medium text-muted-foreground block mb-1">Parking (₹)</label>
            <input type="number" value={f.parkingCharges} onChange={e => setF(p => ({ ...p, parkingCharges: e.target.value }))} placeholder="500000" className={inp} /></div>

          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={f.isPremium} onChange={e => setF(p => ({ ...p, isPremium: e.target.checked }))} className="w-4 h-4 accent-primary" />
              <span className="text-xs font-medium text-foreground">Premium Unit</span>
            </label>
          </div>

          <div className="col-span-2"><label className="text-xs font-medium text-muted-foreground block mb-1">Notes</label>
            <textarea value={f.notes} onChange={e => setF(p => ({ ...p, notes: e.target.value }))} rows={2}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" /></div>
        </div>
        <div className="flex gap-2 px-5 py-3 border-t border-border bg-muted/20">
          <button onClick={onClose} className="flex-1 h-9 rounded-lg border border-border text-sm hover:bg-muted/50 transition-colors">Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {saving ? "Saving…" : existing ? "Save Changes" : "Add Unit"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Units Panel (expands per property card) ────────────────────────── */
function UnitsPanel({
  propertyId, token, canManage,
}: {
  propertyId: number;
  token: string;
  canManage: boolean;
}) {
  const { toast } = useToast();
  const { data: allLeads } = useGetLeads({}, { query: { queryKey: getGetLeadsQueryKey({}) } });
  const leads = (allLeads ?? []).map(l => ({ id: l.id, name: l.name }));

  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editUnit, setEditUnit] = useState<Unit | null>(null);
  const [costSheetUnit, setCostSheetUnit] = useState<Unit | null>(null);
  const [blockModal, setBlockModal] = useState<Unit | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState("");

  const apiFetch = useCallback(async (path: string, opts: RequestInit = {}) => {
    const res = await fetch(path, {
      ...opts,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers ?? {}) },
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "Error"); }
    return res.status === 204 ? null : res.json();
  }, [token]);

  const loadUnits = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/units?propertyId=${propertyId}`);
      setUnits(data ?? []);
    } finally { setLoading(false); }
  }, [propertyId, apiFetch]);

  useEffect(() => { loadUnits(); }, [loadUnits]);

  async function deleteUnit(id: number) {
    if (!confirm("Delete this unit?")) return;
    try { await apiFetch(`/api/units/${id}`, { method: "DELETE" }); setUnits(u => u.filter(x => x.id !== id)); toast({ title: "Unit deleted" }); }
    catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
  }

  async function changeStatus(unit: Unit, status: string, leadId?: number) {
    try {
      const updated = await apiFetch(`/api/units/${unit.id}`, {
        method: "PUT",
        body: JSON.stringify({ status, blockedByLeadId: leadId ?? null }),
      });
      setUnits(u => u.map(x => x.id === unit.id ? updated : x));
      toast({ title: `Unit ${unit.unitNo} marked as ${status}` });
      setBlockModal(null);
    } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
  }

  // Counts per status
  const counts = { available: 0, blocked: 0, booked: 0, sold: 0 };
  units.forEach(u => { if (u.status in counts) counts[u.status as keyof typeof counts]++; });

  return (
    <div className="mt-3 border-t border-border pt-3" onClick={e => e.stopPropagation()}>
      {/* Summary pills */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {(["available","blocked","booked","sold"] as const).map(s => (
          <span key={s} className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${UNIT_STATUS_COLOR[s]}`}>
            {counts[s]} {s}
          </span>
        ))}
        <span className="text-[11px] text-muted-foreground ml-auto">{units.length} units total</span>
        {canManage && (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline">
            <Plus className="w-3 h-3" /> Add Unit
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground py-2">Loading units…</div>
      ) : units.length === 0 ? (
        <div className="text-xs text-muted-foreground py-2 text-center">No units added yet. {canManage && "Click 'Add Unit' to start building inventory."}</div>
      ) : (
        <div className="space-y-1.5">
          {units.map(unit => (
            <div key={unit.id} className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-xs border",
              unit.status === "available" ? "bg-green-50/50 border-green-200/50" :
              unit.status === "blocked"   ? "bg-amber-50/50 border-amber-200/50" :
              unit.status === "booked"    ? "bg-blue-50/50 border-blue-200/50" :
              "bg-muted/30 border-border"
            )}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{unit.unitNo}</span>
                  <span className="text-muted-foreground">{unit.bhkType}</span>
                  {unit.floor != null && <span className="text-muted-foreground">· Fl {unit.floor}</span>}
                  {unit.facing && <span className="text-muted-foreground">· {unit.facing}</span>}
                  {unit.isPremium && <span className="bg-amber-100 text-amber-700 text-[9px] font-bold px-1.5 py-0.5 rounded">PREMIUM</span>}
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-muted-foreground">
                  {unit.saleableArea && <span>{Number(unit.saleableArea).toLocaleString()} sqft</span>}
                  {unit.bsp && <span>₹{Number(unit.bsp).toLocaleString()}/sqft</span>}
                  {unit.bsp && unit.saleableArea && (
                    <span className="font-medium text-foreground">
                      ≈ {formatCurrency(Number(unit.bsp) * Number(unit.saleableArea))}
                    </span>
                  )}
                  {unit.status === "blocked" && unit.blockedByLeadName && (
                    <span className="text-amber-700">Blocked: {unit.blockedByLeadName}</span>
                  )}
                </div>
              </div>

              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded capitalize flex-shrink-0 ${UNIT_STATUS_COLOR[unit.status]}`}>
                {unit.status}
              </span>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {unit.bsp && (
                  <button onClick={() => setCostSheetUnit(unit)} title="Cost Sheet"
                    className="p-1 rounded hover:bg-primary/10 text-primary transition-colors">
                    <FileText className="w-3.5 h-3.5" />
                  </button>
                )}
                {canManage && (
                  <>
                    {unit.status === "available" && (
                      <button onClick={() => { setBlockModal(unit); setSelectedLeadId(""); }} title="Block for prospect"
                        className="p-1 rounded hover:bg-amber-50 text-amber-600 transition-colors">
                        <Lock className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {unit.status === "blocked" && (
                      <>
                        <button onClick={() => changeStatus(unit, "booked", unit.blockedByLeadId ?? undefined)} title="Mark Booked"
                          className="p-1 rounded hover:bg-blue-50 text-blue-600 transition-colors">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => changeStatus(unit, "available")} title="Release"
                          className="p-1 rounded hover:bg-green-50 text-green-600 transition-colors text-[10px] font-medium px-1.5">
                          Release
                        </button>
                      </>
                    )}
                    {unit.status === "booked" && (
                      <button onClick={() => changeStatus(unit, "sold")} title="Mark Sold"
                        className="p-1 rounded hover:bg-slate-100 text-slate-600 transition-colors text-[10px] font-medium px-1.5">
                        Mark Sold
                      </button>
                    )}
                    <button onClick={() => setEditUnit(unit)} title="Edit"
                      className="p-1 rounded hover:bg-primary/10 text-primary transition-colors">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deleteUnit(unit.id)} title="Delete"
                      className="p-1 rounded hover:bg-destructive/10 text-destructive transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Block for lead modal */}
      {blockModal && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center px-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-foreground">Block Unit {blockModal.unitNo}</p>
              <button onClick={() => setBlockModal(null)} className="text-muted-foreground hover:text-foreground p-0.5"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-muted-foreground">Select the prospect to block this unit for. Unit will show as "Blocked" to the entire team.</p>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Prospect (Lead)</label>
              <select value={selectedLeadId} onChange={e => setSelectedLeadId(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="">— select a lead —</option>
                {leads.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setBlockModal(null)} className="flex-1 h-9 rounded-lg border border-border text-sm hover:bg-muted/50">Cancel</button>
              <button disabled={!selectedLeadId} onClick={() => changeStatus(blockModal, "blocked", Number(selectedLeadId))}
                className="flex-1 h-9 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-50">
                Block Unit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit unit modal */}
      {(showAdd || editUnit) && (
        <UnitFormModal
          propertyId={propertyId}
          existing={editUnit ?? undefined}
          token={token}
          leads={leads}
          onSave={(u) => {
            setUnits(prev => editUnit ? prev.map(x => x.id === u.id ? u : x) : [...prev, u]);
            setShowAdd(false); setEditUnit(null);
          }}
          onClose={() => { setShowAdd(false); setEditUnit(null); }}
        />
      )}

      {/* Cost sheet modal */}
      {costSheetUnit && <CostSheet unit={costSheetUnit} onClose={() => setCostSheetUnit(null)} />}
    </div>
  );
}

/* ─── Site Visit Dialog (salesperson) ───────────────────────────────── */
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
          <div><label className="text-xs font-medium text-muted-foreground block mb-1">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" /></div>
          <div><label className="text-xs font-medium text-muted-foreground block mb-1">Time</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" /></div>
        </div>
        <div><label className="text-xs font-medium text-muted-foreground block mb-1">Note</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Any special instructions..."
            className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" /></div>
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

/* ─── Form schema ────────────────────────────────────────────────────── */
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

/* ─── Page ───────────────────────────────────────────────────────────── */
export default function PropertiesPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [siteVisitProp, setSiteVisitProp] = useState<{ id: number; title: string } | null>(null);
  const [infoCard, setInfoCard] = useState<number | null>(null);
  const [inventoryCard, setInventoryCard] = useState<number | null>(null); // which property shows units panel
  const qc = useQueryClient();
  const { toast } = useToast();
  const { role } = useRole();
  const { token } = useAuth();
  const isSales = role === "agent" || role === "broker";
  const canManageUnits = role === "owner" || role === "manager";
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
        <SiteVisitDialog propertyTitle={siteVisitProp.title} open={!!siteVisitProp} onClose={() => setSiteVisitProp(null)} />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isSales ? "Project Inventory" : "Properties & Inventory"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isSales ? `${filtered.length} projects — view units and book site visits` : `${filtered.length} projects · manage unit inventory`}
          </p>
        </div>
        {!isSales && (
          <Button data-testid="button-create-property" onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Add Project
          </Button>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} />
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
          <p className="text-muted-foreground text-sm">No projects found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((prop) => {
            const showInventory = inventoryCard === prop.id;
            return (
              <div key={prop.id} data-testid={`card-property-${prop.id}`}
                className="bg-card border border-card-border rounded-lg p-5 hover:border-primary/40 transition-colors flex flex-col gap-3">

                {/* Header — clicking goes to detail for owner/manager */}
                <div className="flex items-start justify-between cursor-pointer"
                  onClick={() => !isSales && setLocation(`/properties/${prop.id}`)}>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground text-sm truncate">{prop.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate flex items-center gap-1">
                      <MapPin className="w-3 h-3 flex-shrink-0" />{prop.address}, {prop.city}
                    </p>
                  </div>
                  {!isSales && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 flex-shrink-0 text-destructive hover:text-destructive ml-2"
                      data-testid={`button-delete-property-${prop.id}`}
                      onClick={(e) => { e.stopPropagation(); if (confirm("Delete this project and all its units?")) deleteProperty.mutate({ id: prop.id }); }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>

                <p className="text-xl font-bold text-primary">{formatCurrency(prop.price)}</p>

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {prop.bedrooms   != null && <span className="flex items-center gap-1"><BedDouble className="w-3.5 h-3.5" />{prop.bedrooms} bd</span>}
                  {prop.bathrooms  != null && <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5" />{prop.bathrooms} ba</span>}
                  {prop.areaSqft   != null && <span className="flex items-center gap-1"><Maximize2 className="w-3.5 h-3.5" />{Number(prop.areaSqft).toLocaleString()} sqft</span>}
                </div>

                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColor(prop.status)}`}>{stageLabel(prop.status)}</span>
                  <span className="text-xs text-muted-foreground capitalize">{prop.type}</span>
                </div>

                {/* Description (salesperson) */}
                {isSales && infoCard === prop.id && prop.description && (
                  <div className="rounded-lg bg-muted/50 border border-border px-3 py-2 text-xs text-muted-foreground leading-relaxed">
                    {prop.description}
                  </div>
                )}

                {/* Inventory toggle button — always shown */}
                <button
                  onClick={(e) => { e.stopPropagation(); setInventoryCard(showInventory ? null : prop.id); }}
                  className="flex items-center justify-between w-full px-3 py-1.5 rounded-lg border border-border hover:bg-muted/40 transition-colors text-xs font-medium text-foreground">
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-primary" />
                    {canManageUnits ? "Manage Unit Inventory" : "View Available Units"}
                  </span>
                  {showInventory ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                </button>

                {showInventory && (
                  <UnitsPanel
                    propertyId={prop.id}
                    token={token ?? ""}
                    canManage={canManageUnits}
                  />
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
            );
          })}
        </div>
      )}

      {/* Add Project Dialog */}
      <Dialog open={!isSales && showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add New Project</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem className="col-span-2"><FormLabel>Project Name</FormLabel><FormControl><Input data-testid="input-property-title" placeholder="Lodha World Towers" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="address" render={({ field }) => (
                  <FormItem className="col-span-2"><FormLabel>Address</FormLabel><FormControl><Input data-testid="input-property-address" placeholder="Worli, Mumbai" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="city" render={({ field }) => (
                  <FormItem><FormLabel>City</FormLabel><FormControl><Input data-testid="input-property-city" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="price" render={({ field }) => (
                  <FormItem><FormLabel>Starting Price (₹)</FormLabel><FormControl><Input data-testid="input-property-price" type="number" {...field} /></FormControl><FormMessage /></FormItem>
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
                <FormField control={form.control} name="areaSqft" render={({ field }) => (
                  <FormItem><FormLabel>Total Area (sqft)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="agentId" render={({ field }) => (
                  <FormItem><FormLabel>Project Manager</FormLabel>
                    <Select value={field.value?.toString() ?? ""} onValueChange={(v) => field.onChange(v ? Number(v) : undefined)}>
                      <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                      <SelectContent>{(agents ?? []).map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Description / USPs</FormLabel>
                  <FormControl><textarea rows={3} placeholder="2BHK & 3BHK homes with sea view, RERA approved, possession Dec 2026..."
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button type="submit" data-testid="button-submit-property" disabled={createProperty.isPending}>
                  {createProperty.isPending ? "Adding..." : "Add Project"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
