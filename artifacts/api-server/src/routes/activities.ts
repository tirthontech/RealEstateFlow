import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, scheduledActivitiesTable, activityTable } from "@workspace/db";

const router = Router();

function formatActivity(a: typeof scheduledActivitiesTable.$inferSelect) {
  return {
    ...a,
    budget: a.budget != null ? Number(a.budget) : null,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

// GET /activities — agents see only their own; owner/manager see all
router.get("/activities", async (req, res): Promise<void> => {
  const user = req.user!;
  const isFieldRole = user.role === "agent" || user.role === "broker";

  let rows;
  if (isFieldRole) {
    if (!user.agentId) { res.json([]); return; }
    rows = await db
      .select()
      .from(scheduledActivitiesTable)
      .where(eq(scheduledActivitiesTable.agentId, user.agentId))
      .orderBy(scheduledActivitiesTable.activityDate);
  } else {
    const filterAgentId = req.query.agentId ? Number(req.query.agentId) : null;
    if (filterAgentId) {
      rows = await db
        .select()
        .from(scheduledActivitiesTable)
        .where(eq(scheduledActivitiesTable.agentId, filterAgentId))
        .orderBy(scheduledActivitiesTable.activityDate);
    } else {
      rows = await db
        .select()
        .from(scheduledActivitiesTable)
        .orderBy(scheduledActivitiesTable.activityDate);
    }
  }

  res.json(rows.map(formatActivity));
});

// POST /activities — create; agents are auto-assigned to themselves
router.post("/activities", async (req, res): Promise<void> => {
  const user = req.user!;
  const isFieldRole = user.role === "agent" || user.role === "broker";

  const {
    activityType, customer, phone, employeeName, agentId,
    source, project, propertyId, leadId,
    activityDate, activityTime, lastRemark, budget,
  } = req.body ?? {};

  if (!activityType || !customer || !activityDate) {
    res.status(400).json({ error: "activityType, customer, and activityDate are required" });
    return;
  }

  // Field roles are always assigned to themselves; owners/managers can specify any agent
  const resolvedAgentId: number | null = isFieldRole
    ? (user.agentId ?? null)
    : (agentId != null ? Number(agentId) : null);

  const [activity] = await db
    .insert(scheduledActivitiesTable)
    .values({
      activityType: String(activityType),
      customer: String(customer),
      phone: phone ? String(phone) : null,
      employeeName: employeeName ? String(employeeName) : null,
      agentId: resolvedAgentId,
      source: source ? String(source) : null,
      project: project ? String(project) : null,
      propertyId: propertyId != null ? Number(propertyId) : null,
      leadId: leadId != null ? Number(leadId) : null,
      activityDate: String(activityDate),
      activityTime: activityTime ? String(activityTime) : null,
      lastRemark: lastRemark ? String(lastRemark) : null,
      budget: budget != null ? String(budget) : null,
    })
    .returning();

  // Audit log
  await db.insert(activityTable).values({
    type: "activity_scheduled",
    description: `Activity scheduled: ${activityType.replace(/_/g, " ")}`,
    entityName: String(customer),
    agentId: resolvedAgentId ?? undefined,
  });

  res.status(201).json(formatActivity(activity));
});

// PUT /activities/:id — update remark, status, or other fields
router.put("/activities/:id", async (req, res): Promise<void> => {
  const user = req.user!;
  const isFieldRole = user.role === "agent" || user.role === "broker";
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  // Security: field roles can only update their own activities
  if (isFieldRole && user.agentId) {
    const [existing] = await db
      .select({ id: scheduledActivitiesTable.id })
      .from(scheduledActivitiesTable)
      .where(and(
        eq(scheduledActivitiesTable.id, id),
        eq(scheduledActivitiesTable.agentId, user.agentId),
      ));
    if (!existing) { res.status(403).json({ error: "Forbidden — not your activity" }); return; }
  }

  const {
    lastRemark, status, activityType, customer, phone,
    source, project, activityDate, activityTime, budget,
  } = req.body ?? {};

  const updates: Partial<typeof scheduledActivitiesTable.$inferInsert> = {};
  if (lastRemark !== undefined) updates.lastRemark = lastRemark ?? null;
  if (status !== undefined) updates.status = String(status);
  if (activityType !== undefined) updates.activityType = String(activityType);
  if (customer !== undefined) updates.customer = String(customer);
  if (phone !== undefined) updates.phone = phone ?? null;
  if (source !== undefined) updates.source = source ?? null;
  if (project !== undefined) updates.project = project ?? null;
  if (activityDate !== undefined) updates.activityDate = String(activityDate);
  if (activityTime !== undefined) updates.activityTime = activityTime ?? null;
  if (budget !== undefined) updates.budget = budget != null ? String(budget) : null;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" }); return;
  }

  const [activity] = await db
    .update(scheduledActivitiesTable)
    .set(updates)
    .where(eq(scheduledActivitiesTable.id, id))
    .returning();

  if (!activity) { res.status(404).json({ error: "Activity not found" }); return; }
  res.json(formatActivity(activity));
});

// DELETE /activities/:id — owner can delete any; agents/brokers only their own
router.delete("/activities/:id", async (req, res): Promise<void> => {
  const user = req.user!;
  const isOwner = user.role === "owner";
  const isFieldRole = user.role === "agent" || user.role === "broker";
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  // Non-owner, non-field roles (manager, cfo) cannot delete
  if (!isOwner && !isFieldRole) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  // Field roles can only delete their own activities
  if (isFieldRole && user.agentId) {
    const [existing] = await db
      .select({ id: scheduledActivitiesTable.id })
      .from(scheduledActivitiesTable)
      .where(and(
        eq(scheduledActivitiesTable.id, id),
        eq(scheduledActivitiesTable.agentId, user.agentId),
      ));
    if (!existing) { res.status(403).json({ error: "Forbidden" }); return; }
  }

  const [deleted] = await db
    .delete(scheduledActivitiesTable)
    .where(eq(scheduledActivitiesTable.id, id))
    .returning();

  if (!deleted) { res.status(404).json({ error: "Activity not found" }); return; }

  await db.insert(activityTable).values({
    type: "activity_deleted",
    description: `Scheduled activity deleted`,
    entityName: deleted.customer,
    agentId: deleted.agentId ?? undefined,
  });

  res.sendStatus(204);
});

export default router;
