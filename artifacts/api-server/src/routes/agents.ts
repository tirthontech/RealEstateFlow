import { Router, type IRouter } from "express";
import { eq, sql, isNotNull } from "drizzle-orm";
import { db, agentsTable, leadsTable, dealsTable, usersTable, scheduledActivitiesTable, activityTable } from "@workspace/db";
import { ownerMiddleware } from "../middlewares/auth";
import {
  UpdateAgentBody,
  UpdateAgentParams,
  GetAgentParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function enrichAgents(agents: (typeof agentsTable.$inferSelect)[]) {
  if (agents.length === 0) return [];

  const leadRows = await db
    .select({ agentId: leadsTable.assignedTo, count: sql<number>`count(*)::int` })
    .from(leadsTable)
    .groupBy(leadsTable.assignedTo);
  const leadCount = new Map(leadRows.map(r => [r.agentId, r.count]));

  const dealRows = await db
    .select({
      agentId: dealsTable.agentId,
      count: sql<number>`count(*)::int`,
      revenue: sql<number>`coalesce(sum(value::numeric), 0)`,
    })
    .from(dealsTable)
    .groupBy(dealsTable.agentId);
  const dealMap = new Map(dealRows.map(r => [r.agentId, r]));

  const actRows = await db
    .select({ agentId: scheduledActivitiesTable.agentId, count: sql<number>`count(*)::int` })
    .from(scheduledActivitiesTable)
    .groupBy(scheduledActivitiesTable.agentId);
  const actCount = new Map(actRows.map(r => [r.agentId, r.count]));

  const userRows = await db
    .select({ agentId: usersTable.agentId, id: usersTable.id, username: usersTable.username })
    .from(usersTable)
    .where(isNotNull(usersTable.agentId));
  const userByAgentId = new Map(
    userRows.filter(u => u.agentId != null).map(u => [u.agentId!, { id: u.id, username: u.username }]),
  );

  return agents.map(agent => {
    const linkedUser = userByAgentId.get(agent.id) ?? null;
    return {
      ...agent,
      activeLeads:     leadCount.get(agent.id) ?? 0,
      dealsCount:      dealMap.get(agent.id)?.count ?? 0,
      revenue:         Number(dealMap.get(agent.id)?.revenue ?? 0),
      activitiesCount: actCount.get(agent.id) ?? 0,
      userId:          linkedUser?.id ?? null,
      username:        linkedUser?.username ?? null,
      hasLogin:        linkedUser != null,
      createdAt:       agent.createdAt.toISOString(),
    };
  });
}

router.get("/agents", async (_req, res): Promise<void> => {
  const agents = await db.select().from(agentsTable).orderBy(agentsTable.name);
  res.json(await enrichAgents(agents));
});

router.get("/agents/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetAgentParams.safeParse({ id: Number(raw) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, params.data.id));
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }
  const [enriched] = await enrichAgents([agent]);
  res.json(enriched);
});

router.put("/agents/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateAgentParams.safeParse({ id: Number(raw) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateAgentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [agent] = await db
    .update(agentsTable)
    .set(parsed.data)
    .where(eq(agentsTable.id, params.data.id))
    .returning();
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }
  const [enriched] = await enrichAgents([agent]);
  res.json(enriched);
});

// Delete agent — also deletes the linked user account so both stay in sync
router.delete("/agents/:id", ownerMiddleware as any, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, id));
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  await db.update(leadsTable).set({ assignedTo: null }).where(eq(leadsTable.assignedTo, id));
  await db.update(scheduledActivitiesTable).set({ agentId: null }).where(eq(scheduledActivitiesTable.agentId, id));
  await db.delete(agentsTable).where(eq(agentsTable.id, id));

  // Also remove the linked user account so they can no longer log in
  if (agent.userId) {
    await db.delete(usersTable).where(eq(usersTable.id, agent.userId));
  }

  await db.insert(activityTable).values({
    type: "agent_deleted",
    description: `Agent deleted`,
    entityName: agent.name,
  });
  res.sendStatus(204);
});

export default router;
