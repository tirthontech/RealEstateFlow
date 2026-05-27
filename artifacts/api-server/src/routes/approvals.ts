import { Router, type IRouter } from "express";
import { eq, and, type SQL } from "drizzle-orm";
import { db, approvalsTable } from "@workspace/db";

import { APPROVAL_ROLES } from "../lib/roles";

const router: IRouter = Router();

router.get("/approvals", async (req, res): Promise<void> => {
  const { status } = req.query;
  const conditions: SQL[] = [];
  if (status && typeof status === "string") conditions.push(eq(approvalsTable.status, status));

  const rows = conditions.length > 0
    ? await db.select().from(approvalsTable).where(and(...conditions)).orderBy(approvalsTable.createdAt)
    : await db.select().from(approvalsTable).orderBy(approvalsTable.createdAt);

  res.json(rows.map(r => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  })));
});

router.post("/approvals", async (req, res): Promise<void> => {
  const user = req.user!;
  const { type, entityId, entityName, details } = req.body ?? {};
  if (!type || !entityName || !details) {
    res.status(400).json({ error: "type, entityName and details are required" }); return;
  }

  const [record] = await db.insert(approvalsTable).values({
    type: String(type),
    requestedBy: user.id,
    requestedByName: user.name,
    entityId: entityId ?? null,
    entityName: String(entityName),
    details: typeof details === "string" ? details : JSON.stringify(details),
    status: "pending",
  }).returning();

  res.status(201).json({
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
});

router.put("/approvals/:id", async (req, res): Promise<void> => {
  const user = req.user!;
  if (!APPROVAL_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Only managers and owners can review approvals" }); return;
  }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [existing] = await db.select().from(approvalsTable).where(eq(approvalsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Approval not found" }); return; }
  if (existing.status !== "pending") {
    res.status(409).json({ error: "Approval already reviewed" }); return;
  }

  const { status, reviewNote } = req.body ?? {};
  if (!status || !["approved", "rejected"].includes(status)) {
    res.status(400).json({ error: "status must be 'approved' or 'rejected'" }); return;
  }

  const [record] = await db.update(approvalsTable).set({
    status: String(status),
    reviewedBy: user.id,
    reviewedByName: user.name,
    reviewNote: reviewNote ?? null,
  }).where(eq(approvalsTable.id, id)).returning();

  res.json({
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
});

export default router;
