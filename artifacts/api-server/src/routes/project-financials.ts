import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, projectFinancialsTable } from "@workspace/db";

import { MANAGER_ROLES } from "../lib/roles";

const router: IRouter = Router();

router.get("/project-financials", async (_req, res): Promise<void> => {
  const rows = await db.select().from(projectFinancialsTable).orderBy(projectFinancialsTable.propertyId);
  res.json(rows.map(r => ({
    ...r,
    totalInvested: Number(r.totalInvested),
    totalCollected: Number(r.totalCollected),
    totalOutstanding: Number(r.totalOutstanding),
    expectedRevenue: Number(r.expectedRevenue),
    margin: Number(r.margin),
    updatedAt: r.updatedAt.toISOString(),
  })));
});

router.put("/project-financials/:propertyId", async (req, res): Promise<void> => {
  const user = req.user!;
  if (!MANAGER_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Only owners and managers can update project financials" }); return;
  }

  const propertyId = parseInt(req.params.propertyId, 10);
  if (isNaN(propertyId)) { res.status(400).json({ error: "Invalid propertyId" }); return; }

  const { projectName, totalInvested, totalCollected, totalOutstanding, expectedRevenue, margin } = req.body ?? {};

  const [existing] = await db.select().from(projectFinancialsTable).where(eq(projectFinancialsTable.propertyId, propertyId));

  function toNum(v: unknown) { return v != null ? String(v) : undefined; }

  if (existing) {
    const updates: Record<string, unknown> = {};
    if (projectName !== undefined) updates.projectName = String(projectName);
    if (totalInvested !== undefined) updates.totalInvested = String(totalInvested);
    if (totalCollected !== undefined) updates.totalCollected = String(totalCollected);
    if (totalOutstanding !== undefined) updates.totalOutstanding = String(totalOutstanding);
    if (expectedRevenue !== undefined) updates.expectedRevenue = String(expectedRevenue);
    if (margin !== undefined) updates.margin = String(margin);

    const [record] = await db.update(projectFinancialsTable).set(updates).where(eq(projectFinancialsTable.propertyId, propertyId)).returning();
    return void res.json({
      ...record,
      totalInvested: Number(record.totalInvested),
      totalCollected: Number(record.totalCollected),
      totalOutstanding: Number(record.totalOutstanding),
      expectedRevenue: Number(record.expectedRevenue),
      margin: Number(record.margin),
      updatedAt: record.updatedAt.toISOString(),
    });
  }

  if (!projectName) {
    res.status(400).json({ error: "projectName required for first-time entry" }); return;
  }

  const [record] = await db.insert(projectFinancialsTable).values({
    propertyId,
    projectName: String(projectName),
    totalInvested: toNum(totalInvested) ?? "0",
    totalCollected: toNum(totalCollected) ?? "0",
    totalOutstanding: toNum(totalOutstanding) ?? "0",
    expectedRevenue: toNum(expectedRevenue) ?? "0",
    margin: toNum(margin) ?? "0",
  }).returning();

  res.status(201).json({
    ...record,
    totalInvested: Number(record.totalInvested),
    totalCollected: Number(record.totalCollected),
    totalOutstanding: Number(record.totalOutstanding),
    expectedRevenue: Number(record.expectedRevenue),
    margin: Number(record.margin),
    updatedAt: record.updatedAt.toISOString(),
  });
});

export default router;
