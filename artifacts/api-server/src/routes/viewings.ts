import { Router, type IRouter } from "express";
import { eq, and, type SQL } from "drizzle-orm";
import { db, viewingsTable, leadsTable, propertiesTable, agentsTable, activityTable } from "@workspace/db";
import { ownerMiddleware } from "../middlewares/auth";

const router: IRouter = Router();

type CreateViewingBody = {
  leadId?: number | null;
  propertyId?: number | null;
  agentId?: number | null;
  date: string;
  time?: string;
  status?: string;
  notes?: string | null;
};

type UpdateViewingBody = Partial<CreateViewingBody>;

async function formatViewing(v: typeof viewingsTable.$inferSelect) {
  let leadName: string | null = null;
  let propertyTitle: string | null = null;
  let agentName: string | null = null;
  let leadPhone: string | null = null;
  let propertyPrice: number | null = null;

  if (v.leadId) {
    const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, v.leadId));
    leadName = lead?.name ?? null;
    leadPhone = lead?.phone ?? null;
  }
  if (v.propertyId) {
    const [prop] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, v.propertyId));
    propertyTitle = prop?.title ?? null;
    propertyPrice = prop?.price != null ? Number(prop.price) : null;
  }
  if (v.agentId) {
    const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, v.agentId));
    agentName = agent?.name ?? null;
  }

  return {
    ...v,
    leadName,
    leadPhone,
    propertyTitle,
    propertyPrice,
    agentName,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
  };
}

router.get("/viewings", async (req, res): Promise<void> => {
  const { status, leadId, agentId } = req.query;
  const conditions: SQL[] = [];
  if (status && typeof status === "string") conditions.push(eq(viewingsTable.status, status));
  if (leadId) conditions.push(eq(viewingsTable.leadId, Number(leadId)));
  if (agentId) conditions.push(eq(viewingsTable.agentId, Number(agentId)));

  const rows = conditions.length > 0
    ? await db.select().from(viewingsTable).where(and(...conditions)).orderBy(viewingsTable.date)
    : await db.select().from(viewingsTable).orderBy(viewingsTable.date);

  const formatted = await Promise.all(rows.map(formatViewing));
  res.json(formatted);
});

router.post("/viewings", async (req, res): Promise<void> => {
  const body = req.body as CreateViewingBody;
  if (!body.date) {
    res.status(400).json({ error: "date is required" });
    return;
  }
  const [viewing] = await db.insert(viewingsTable).values({
    leadId: body.leadId ?? null,
    propertyId: body.propertyId ?? null,
    agentId: body.agentId ?? null,
    date: body.date,
    time: body.time ?? "10:00",
    status: body.status ?? "pending",
    notes: body.notes ?? null,
  }).returning();
  res.status(201).json(await formatViewing(viewing));
});

router.get("/viewings/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [viewing] = await db.select().from(viewingsTable).where(eq(viewingsTable.id, id));
  if (!viewing) { res.status(404).json({ error: "Viewing not found" }); return; }
  res.json(await formatViewing(viewing));
});

router.put("/viewings/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const body = req.body as UpdateViewingBody;
  const updateData: Record<string, unknown> = {};
  if (body.leadId !== undefined) updateData.leadId = body.leadId;
  if (body.propertyId !== undefined) updateData.propertyId = body.propertyId;
  if (body.agentId !== undefined) updateData.agentId = body.agentId;
  if (body.date !== undefined) updateData.date = body.date;
  if (body.time !== undefined) updateData.time = body.time;
  if (body.status !== undefined) updateData.status = body.status;
  if (body.notes !== undefined) updateData.notes = body.notes;
  const [viewing] = await db.update(viewingsTable).set(updateData).where(eq(viewingsTable.id, id)).returning();
  if (!viewing) { res.status(404).json({ error: "Viewing not found" }); return; }
  res.json(await formatViewing(viewing));
});

router.delete("/viewings/:id", ownerMiddleware as any, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [viewing] = await db.select().from(viewingsTable).where(eq(viewingsTable.id, id));
  if (!viewing) { res.status(404).json({ error: "Viewing not found" }); return; }
  await db.delete(viewingsTable).where(eq(viewingsTable.id, id));
  const entityName = viewing.leadId ? `Viewing #${id}` : `Viewing #${id}`;
  await db.insert(activityTable).values({
    type: "viewing_deleted",
    description: `Viewing deleted`,
    entityName,
    agentId: viewing.agentId ?? undefined,
  });
  res.sendStatus(204);
});

export default router;
