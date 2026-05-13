import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, unitsTable, leadsTable } from "@workspace/db";

const router = Router();

function fmt(u: typeof unitsTable.$inferSelect, leadName?: string | null) {
  return {
    ...u,
    carpetArea:      u.carpetArea      != null ? Number(u.carpetArea)      : null,
    saleableArea:    u.saleableArea    != null ? Number(u.saleableArea)    : null,
    bsp:             u.bsp             != null ? Number(u.bsp)             : null,
    plcCharges:      u.plcCharges      != null ? Number(u.plcCharges)      : null,
    parkingCharges:  u.parkingCharges  != null ? Number(u.parkingCharges)  : null,
    blockedByLeadName: leadName ?? null,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
    bookedAt:  u.bookedAt?.toISOString() ?? null,
  };
}

// GET /units?propertyId=X
router.get("/units", async (req, res): Promise<void> => {
  const { propertyId } = req.query;
  const rows = propertyId
    ? await db.select().from(unitsTable).where(eq(unitsTable.propertyId, Number(propertyId))).orderBy(unitsTable.floor, unitsTable.unitNo)
    : await db.select().from(unitsTable).orderBy(unitsTable.propertyId, unitsTable.floor, unitsTable.unitNo);

  // Attach blocked lead names
  const leadIds = [...new Set(rows.map(r => r.blockedByLeadId).filter(Boolean))] as number[];
  const leads = leadIds.length > 0
    ? await db.select({ id: leadsTable.id, name: leadsTable.name }).from(leadsTable)
    : [];
  const leadMap = new Map(leads.map(l => [l.id, l.name]));

  res.json(rows.map(r => fmt(r, leadMap.get(r.blockedByLeadId ?? -1))));
});

// POST /units
router.post("/units", async (req, res): Promise<void> => {
  const { propertyId, unitNo, bhkType, floor, facing, carpetArea, saleableArea, bsp, plcCharges, parkingCharges, isPremium, notes } = req.body ?? {};
  if (!propertyId || !unitNo || !bhkType) {
    res.status(400).json({ error: "propertyId, unitNo, bhkType required" }); return;
  }
  const [unit] = await db.insert(unitsTable).values({
    propertyId: Number(propertyId),
    unitNo: String(unitNo),
    bhkType: String(bhkType),
    floor: floor != null ? Number(floor) : null,
    facing: facing ?? null,
    carpetArea: carpetArea != null ? String(carpetArea) : null,
    saleableArea: saleableArea != null ? String(saleableArea) : null,
    bsp: bsp != null ? String(bsp) : null,
    plcCharges: plcCharges != null ? String(plcCharges) : "0",
    parkingCharges: parkingCharges != null ? String(parkingCharges) : "500000",
    isPremium: Boolean(isPremium),
    notes: notes ?? null,
  }).returning();
  res.status(201).json(fmt(unit));
});

// PUT /units/:id  — update status, block, book, or edit details
router.put("/units/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { status, blockedByLeadId, unitNo, bhkType, floor, facing, carpetArea, saleableArea, bsp, plcCharges, parkingCharges, isPremium, notes } = req.body ?? {};

  const updates: Partial<typeof unitsTable.$inferInsert> = {};
  if (unitNo   != null) updates.unitNo   = String(unitNo);
  if (bhkType  != null) updates.bhkType  = String(bhkType);
  if (floor    != null) updates.floor    = Number(floor);
  if (facing   != null) updates.facing   = String(facing);
  if (carpetArea   != null) updates.carpetArea   = String(carpetArea);
  if (saleableArea != null) updates.saleableArea = String(saleableArea);
  if (bsp      != null) updates.bsp      = String(bsp);
  if (plcCharges  != null) updates.plcCharges  = String(plcCharges);
  if (parkingCharges != null) updates.parkingCharges = String(parkingCharges);
  if (isPremium != null) updates.isPremium = Boolean(isPremium);
  if (notes    != null) updates.notes    = String(notes);

  if (status) {
    updates.status = String(status);
    if (status === "available") updates.blockedByLeadId = null;
    if (status === "blocked") updates.blockedByLeadId = blockedByLeadId ? Number(blockedByLeadId) : null;
    if (status === "booked") updates.bookedAt = new Date();
  }

  const [unit] = await db.update(unitsTable).set(updates).where(eq(unitsTable.id, id)).returning();
  if (!unit) { res.status(404).json({ error: "Unit not found" }); return; }

  let leadName: string | null = null;
  if (unit.blockedByLeadId) {
    const [lead] = await db.select({ name: leadsTable.name }).from(leadsTable).where(eq(leadsTable.id, unit.blockedByLeadId));
    leadName = lead?.name ?? null;
  }
  res.json(fmt(unit, leadName));
});

// DELETE /units/:id
router.delete("/units/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const [deleted] = await db.delete(unitsTable).where(eq(unitsTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Unit not found" }); return; }
  res.sendStatus(204);
});

export default router;
