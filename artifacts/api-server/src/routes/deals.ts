import { Router, type IRouter } from "express";
import { eq, and, type SQL } from "drizzle-orm";
import { db, dealsTable, leadsTable, propertiesTable, agentsTable, activityTable } from "@workspace/db";
import { ownerMiddleware } from "../middlewares/auth";
import {
  CreateDealBody,
  UpdateDealBody,
  UpdateDealParams,
  GetDealParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const FIELD_ROLES = ["agent", "broker"];

async function formatDeal(deal: typeof dealsTable.$inferSelect) {
  let leadName: string | null = null;
  let propertyTitle: string | null = null;
  let agentName: string | null = null;

  if (deal.leadId) {
    const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, deal.leadId));
    leadName = lead?.name ?? null;
  }
  if (deal.propertyId) {
    const [prop] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, deal.propertyId));
    propertyTitle = prop?.title ?? null;
  }
  if (deal.agentId) {
    const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, deal.agentId));
    agentName = agent?.name ?? null;
  }
  return {
    ...deal,
    value: Number(deal.value),
    leadName,
    propertyTitle,
    agentName,
    closingDate: deal.closingDate ? deal.closingDate.toISOString() : null,
    createdAt: deal.createdAt.toISOString(),
    updatedAt: deal.updatedAt.toISOString(),
  };
}

router.get("/deals", async (req, res): Promise<void> => {
  const { stage, agentId } = req.query;
  const user = req.user!;
  const conditions: SQL[] = [];

  if (stage && typeof stage === "string") conditions.push(eq(dealsTable.stage, stage));
  if (agentId) conditions.push(eq(dealsTable.agentId, Number(agentId)));

  // Field roles only see their own deals
  if (FIELD_ROLES.includes(user.role) && user.agentId) {
    conditions.push(eq(dealsTable.agentId, user.agentId));
  }

  const rows = conditions.length > 0
    ? await db.select().from(dealsTable).where(and(...conditions)).orderBy(dealsTable.createdAt)
    : await db.select().from(dealsTable).orderBy(dealsTable.createdAt);

  const formatted = await Promise.all(rows.map(formatDeal));
  res.json(formatted);
});

router.post("/deals", async (req, res): Promise<void> => {
  const parsed = CreateDealBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const user = req.user!;

  // Field roles auto-assign the deal to themselves
  let agentId = parsed.data.agentId ?? null;
  if (FIELD_ROLES.includes(user.role) && user.agentId) {
    agentId = user.agentId;
  }

  const [deal] = await db.insert(dealsTable).values({
    ...parsed.data,
    agentId,
    value: String(parsed.data.value),
    stage: parsed.data.stage ?? "prospect",
    closingDate: parsed.data.closingDate ? new Date(parsed.data.closingDate as unknown as string) : null,
  }).returning();

  db.insert(activityTable).values({
    type: "deal_updated",
    description: `New deal created`,
    entityName: deal.title,
    agentId: deal.agentId ?? undefined,
  }).catch(() => {});

  res.status(201).json(await formatDeal(deal));
});

router.get("/deals/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetDealParams.safeParse({ id: Number(raw) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [deal] = await db.select().from(dealsTable).where(eq(dealsTable.id, params.data.id));
  if (!deal) { res.status(404).json({ error: "Deal not found" }); return; }

  const user = req.user!;
  if (FIELD_ROLES.includes(user.role) && user.agentId && deal.agentId !== user.agentId) {
    res.status(403).json({ error: "Access denied" }); return;
  }

  res.json(await formatDeal(deal));
});

router.put("/deals/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateDealParams.safeParse({ id: Number(raw) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = UpdateDealBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [existing] = await db.select().from(dealsTable).where(eq(dealsTable.id, params.data.id));
  if (!existing) { res.status(404).json({ error: "Deal not found" }); return; }

  const user = req.user!;
  if (FIELD_ROLES.includes(user.role) && user.agentId && existing.agentId !== user.agentId) {
    res.status(403).json({ error: "Access denied" }); return;
  }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.closingDate) updateData.closingDate = new Date(parsed.data.closingDate as unknown as string);
  if (parsed.data.value != null) updateData.value = String(parsed.data.value);

  const [deal] = await db.update(dealsTable).set(updateData).where(eq(dealsTable.id, params.data.id)).returning();
  if (!deal) { res.status(404).json({ error: "Deal not found" }); return; }

  db.insert(activityTable).values({
    type: deal.stage === "closed_won" ? "deal_closed" : "deal_updated",
    description: deal.stage === "closed_won" ? `Deal closed successfully` : `Deal moved to ${deal.stage.replace(/_/g, " ")}`,
    entityName: deal.title,
    agentId: deal.agentId ?? undefined,
  }).catch(() => {});

  res.json(await formatDeal(deal));
});

router.delete("/deals/:id", ownerMiddleware as any, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [deal] = await db.select().from(dealsTable).where(eq(dealsTable.id, id));
  if (!deal) { res.status(404).json({ error: "Deal not found" }); return; }

  await db.delete(dealsTable).where(eq(dealsTable.id, id));
  db.insert(activityTable).values({ type: "deal_deleted", description: `Deal deleted`, entityName: deal.title, agentId: deal.agentId ?? undefined }).catch(() => {});
  res.sendStatus(204);
});

export default router;
