import { Router, type IRouter } from "express";
import { eq, ilike, and, type SQL } from "drizzle-orm";
import { db, leadsTable, agentsTable, activityTable, notificationsTable, usersTable, viewingsTable, dealsTable, scheduledActivitiesTable } from "@workspace/db";
import { ownerMiddleware } from "../middlewares/auth";
import { logger } from "../lib/logger";
import {
  CreateLeadBody,
  UpdateLeadBody,
  UpdateLeadParams,
  GetLeadParams,
} from "@workspace/api-zod";

import { FIELD_ROLES } from "../lib/roles";

const router: IRouter = Router();

function formatLead(lead: typeof leadsTable.$inferSelect, agentName?: string | null) {
  return {
    ...lead,
    budget: lead.budget != null ? Number(lead.budget) : null,
    agentName: agentName ?? null,
    followUpDate: lead.followUpDate ? lead.followUpDate.toISOString() : null,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  };
}

router.get("/leads", async (req, res): Promise<void> => {
  const { status, search, assignedTo } = req.query;
  const user = req.user!;
  const conditions: SQL[] = [];

  if (status && typeof status === "string") conditions.push(eq(leadsTable.status, status));
  if (assignedTo) conditions.push(eq(leadsTable.assignedTo, Number(assignedTo)));

  // Field roles only see their own leads; if no agentId linked they see nothing
  if (FIELD_ROLES.includes(user.role)) {
    if (!user.agentId) { res.json([]); return; }
    conditions.push(eq(leadsTable.assignedTo, user.agentId));
  }

  const rows = conditions.length > 0
    ? await db.select().from(leadsTable).where(and(...conditions)).orderBy(leadsTable.createdAt)
    : await db.select().from(leadsTable).orderBy(leadsTable.createdAt);

  let filtered = rows;
  if (search && typeof search === "string") {
    const lower = search.toLowerCase();
    filtered = rows.filter(
      (r) => r.name.toLowerCase().includes(lower) || r.email.toLowerCase().includes(lower),
    );
  }

  const agents = await db.select().from(agentsTable);
  const agentMap = new Map(agents.map((a) => [a.id, a.name]));
  res.json(filtered.map((l) => formatLead(l, agentMap.get(l.assignedTo ?? -1))));
});

router.post("/leads", async (req, res): Promise<void> => {
  const parsed = CreateLeadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues?.[0]?.message ?? parsed.error.message });
    return;
  }
  const user = req.user!;

  // Field roles auto-assign to themselves
  let assignedTo = parsed.data.assignedTo ?? null;
  if (FIELD_ROLES.includes(user.role) && user.agentId) {
    assignedTo = user.agentId;
  }

  const resolvedStatus = assignedTo ? (parsed.data.status ?? "new") : "unassigned";

  const { name, phone, source, propertyType, notes } = parsed.data;
  const email = parsed.data.email ?? "";

  let lead: typeof leadsTable.$inferSelect;
  try {
    const rows = await db.insert(leadsTable).values({
      name,
      email,
      phone: phone ?? null,
      source,
      propertyType: propertyType ?? null,
      notes: notes ?? null,
      assignedTo,
      budget: parsed.data.budget != null ? String(parsed.data.budget) : null,
      status: resolvedStatus,
      score: parsed.data.score ?? 50,
    }).returning();
    lead = rows[0];
  } catch (err: any) {
    logger.error({ err, body: req.body }, "Failed to insert lead");
    res.status(500).json({ error: err?.message ?? "Database error — check server logs" });
    return;
  }

  let agentName: string | null = null;
  if (lead.assignedTo) {
    const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, lead.assignedTo));
    agentName = agent?.name ?? null;
  }

  // Fire-and-forget side-effects — never let these break the main response
  db.insert(activityTable).values({
    type: "lead_created",
    description: lead.assignedTo ? `Lead added by agent` : `Portal lead received — awaiting assignment`,
    entityName: lead.name,
    agentId: lead.assignedTo ?? undefined,
  }).catch(() => {});

  if (!lead.assignedTo) {
    db.insert(notificationsTable).values([
      { type: "portal_lead", title: "New lead received", message: `${lead.name} from ${lead.source} is awaiting assignment`, leadId: lead.id, targetRole: "owner" },
      { type: "portal_lead", title: "New lead received", message: `${lead.name} from ${lead.source} is awaiting assignment`, leadId: lead.id, targetRole: "manager" },
    ]).catch(() => {});
  }

  res.status(201).json(formatLead(lead, agentName));
});

router.get("/leads/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetLeadParams.safeParse({ id: Number(raw) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, params.data.id));
  if (!lead) { res.status(404).json({ error: "Lead not found" }); return; }

  const user = req.user!;
  if (FIELD_ROLES.includes(user.role) && user.agentId && lead.assignedTo !== user.agentId) {
    res.status(403).json({ error: "Access denied" }); return;
  }

  let agentName: string | null = null;
  if (lead.assignedTo) {
    const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, lead.assignedTo));
    agentName = agent?.name ?? null;
  }
  res.json(formatLead(lead, agentName));
});

router.put("/leads/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateLeadParams.safeParse({ id: Number(raw) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = UpdateLeadBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [prevLead] = await db.select().from(leadsTable).where(eq(leadsTable.id, params.data.id));
  if (!prevLead) { res.status(404).json({ error: "Lead not found" }); return; }

  const user = req.user!;
  // Field agents can only update their own leads; they cannot reassign
  if (FIELD_ROLES.includes(user.role) && user.agentId) {
    if (prevLead.assignedTo !== user.agentId) { res.status(403).json({ error: "Access denied" }); return; }
    delete (parsed.data as any).assignedTo; // agents can't reassign leads
  }

  const updateData: Record<string, unknown> = {
    ...parsed.data,
    budget: parsed.data.budget != null ? String(parsed.data.budget) : parsed.data.budget,
    followUpDate: parsed.data.followUpDate ? new Date(parsed.data.followUpDate) : parsed.data.followUpDate,
  };
  if (parsed.data.assignedTo && prevLead.status === "unassigned") {
    updateData.status = "new";
  }

  const [lead] = await db.update(leadsTable).set(updateData).where(eq(leadsTable.id, params.data.id)).returning();
  if (!lead) { res.status(404).json({ error: "Lead not found" }); return; }

  let agentName: string | null = null;
  if (lead.assignedTo) {
    const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, lead.assignedTo));
    agentName = agent?.name ?? null;
  }

  if (parsed.data.assignedTo && parsed.data.assignedTo !== prevLead.assignedTo) {
    await db.insert(activityTable).values({
      type: "lead_assigned",
      description: `Lead assigned to ${agentName ?? "agent"}`,
      entityName: lead.name,
      agentId: lead.assignedTo ?? undefined,
    });
    const [agentUser] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.agentId, lead.assignedTo!));
    if (agentUser) {
      await db.insert(notificationsTable).values({
        type: "lead_assigned",
        title: "New lead assigned to you",
        message: `${lead.name} has been assigned to you`,
        leadId: lead.id,
        targetUserId: agentUser.id,
      });
    }
    await db.update(notificationsTable).set({ isRead: true }).where(and(eq(notificationsTable.leadId, lead.id), eq(notificationsTable.type, "portal_lead")));
  } else if (parsed.data.status && parsed.data.status !== prevLead.status) {
    await db.insert(activityTable).values({
      type: "lead_status_updated",
      description: `Lead stage updated to ${parsed.data.status}`,
      entityName: lead.name,
      agentId: lead.assignedTo ?? undefined,
    });
  }

  res.json(formatLead(lead, agentName));
});

router.delete("/leads/:id", ownerMiddleware as any, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, id));
  if (!lead) { res.status(404).json({ error: "Lead not found" }); return; }

  await db.delete(viewingsTable).where(eq(viewingsTable.leadId, id));
  await db.delete(scheduledActivitiesTable).where(eq(scheduledActivitiesTable.leadId, id));
  await db.delete(notificationsTable).where(eq(notificationsTable.leadId, id));
  await db.update(dealsTable).set({ leadId: null }).where(eq(dealsTable.leadId, id));
  await db.delete(leadsTable).where(eq(leadsTable.id, id));
  await db.insert(activityTable).values({ type: "lead_deleted", description: `Lead deleted`, entityName: lead.name });
  res.sendStatus(204);
});

export default router;
