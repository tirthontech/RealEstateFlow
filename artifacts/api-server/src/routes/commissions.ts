import { Router, type IRouter } from "express";
import { eq, and, type SQL } from "drizzle-orm";
import { db, commissionsTable, agentsTable } from "@workspace/db";
import { FIELD_ROLES, MANAGER_ROLES } from "../lib/roles";

const router: IRouter = Router();

router.get("/commissions", async (req, res): Promise<void> => {
  const user = req.user!;
  const conditions: SQL[] = [];

  // Agents/brokers only see their own commissions
  if (FIELD_ROLES.includes(user.role) && user.agentId) {
    conditions.push(eq(commissionsTable.agentId, user.agentId));
  }

  const rows = conditions.length > 0
    ? await db.select().from(commissionsTable).where(and(...conditions)).orderBy(commissionsTable.createdAt)
    : await db.select().from(commissionsTable).orderBy(commissionsTable.createdAt);

  res.json(rows.map(r => ({
    ...r,
    dealValue: Number(r.dealValue),
    commissionRate: Number(r.commissionRate),
    commissionEarned: Number(r.commissionEarned),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  })));
});

router.post("/commissions", async (req, res): Promise<void> => {
  const user = req.user!;
  if (!MANAGER_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Only managers and owners can create commission records" }); return;
  }

  const { dealId, agentId, agentName, dealTitle, dealValue, commissionRate, status, type } = req.body ?? {};
  if (!agentName || !dealTitle || dealValue == null) {
    res.status(400).json({ error: "agentName, dealTitle and dealValue are required" }); return;
  }

  const rate = commissionRate ?? 2;
  const earned = (Number(dealValue) * Number(rate)) / 100;

  const [record] = await db.insert(commissionsTable).values({
    dealId: dealId ?? null,
    agentId: agentId ?? null,
    agentName: String(agentName),
    dealTitle: String(dealTitle),
    dealValue: String(dealValue),
    commissionRate: String(rate),
    commissionEarned: String(earned),
    status: status ?? "pending",
    type: type ?? "agent",
  }).returning();

  res.status(201).json({
    ...record,
    dealValue: Number(record.dealValue),
    commissionRate: Number(record.commissionRate),
    commissionEarned: Number(record.commissionEarned),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
});

router.put("/commissions/:id", async (req, res): Promise<void> => {
  const user = req.user!;
  if (!MANAGER_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Only managers and owners can update commission records" }); return;
  }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [existing] = await db.select().from(commissionsTable).where(eq(commissionsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Commission record not found" }); return; }

  const { status, commissionRate, commissionEarned } = req.body ?? {};
  const updates: Record<string, unknown> = {};
  if (status !== undefined) updates.status = status;
  if (commissionRate !== undefined) {
    updates.commissionRate = String(commissionRate);
    // Recalculate earned if rate changed
    updates.commissionEarned = String((Number(existing.dealValue) * Number(commissionRate)) / 100);
  }
  if (commissionEarned !== undefined) updates.commissionEarned = String(commissionEarned);

  const [record] = await db.update(commissionsTable).set(updates).where(eq(commissionsTable.id, id)).returning();
  res.json({
    ...record,
    dealValue: Number(record.dealValue),
    commissionRate: Number(record.commissionRate),
    commissionEarned: Number(record.commissionEarned),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
});

router.delete("/commissions/:id", async (req, res): Promise<void> => {
  const user = req.user!;
  if (!MANAGER_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Only managers and owners can delete commission records" }); return;
  }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  await db.delete(commissionsTable).where(eq(commissionsTable.id, id));
  res.sendStatus(204);
});

export default router;
