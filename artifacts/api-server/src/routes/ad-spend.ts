import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, adSpendTable } from "@workspace/db";
import { MANAGER_ROLES } from "../lib/roles";

const router: IRouter = Router();

function fmt(r: typeof adSpendTable.$inferSelect) {
  return {
    ...r,
    spend: Number(r.spend),
    cpl: r.leadsGenerated > 0 ? Number(r.spend) / r.leadsGenerated : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

router.get("/ad-spend", async (req, res): Promise<void> => {
  const rows = await db.select().from(adSpendTable).orderBy(adSpendTable.year, adSpendTable.month);
  res.json(rows.map(fmt));
});

router.post("/ad-spend", async (req, res): Promise<void> => {
  const user = req.user!;
  if (!MANAGER_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Only managers can add ad spend records" }); return;
  }
  const { channel, month, year, spend, leadsGenerated } = req.body;
  if (!channel || !month || !year || spend == null) {
    res.status(400).json({ error: "channel, month, year, spend are required" }); return;
  }
  const [row] = await db.insert(adSpendTable).values({
    channel, month: Number(month), year: Number(year),
    spend: String(spend), leadsGenerated: Number(leadsGenerated ?? 0),
  }).returning();
  res.status(201).json(fmt(row));
});

router.put("/ad-spend/:id", async (req, res): Promise<void> => {
  const user = req.user!;
  if (!MANAGER_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Only managers can update ad spend records" }); return;
  }
  const id = Number(req.params.id);
  const { channel, month, year, spend, leadsGenerated } = req.body;
  const updates: Partial<typeof adSpendTable.$inferInsert> = {};
  if (channel != null) updates.channel = channel;
  if (month != null) updates.month = Number(month);
  if (year != null) updates.year = Number(year);
  if (spend != null) updates.spend = String(spend);
  if (leadsGenerated != null) updates.leadsGenerated = Number(leadsGenerated);
  const [row] = await db.update(adSpendTable).set(updates).where(eq(adSpendTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Record not found" }); return; }
  res.json(fmt(row));
});

router.delete("/ad-spend/:id", async (req, res): Promise<void> => {
  const user = req.user!;
  if (!MANAGER_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Only managers can delete ad spend records" }); return;
  }
  const id = Number(req.params.id);
  await db.delete(adSpendTable).where(eq(adSpendTable.id, id));
  res.status(204).end();
});

export default router;
