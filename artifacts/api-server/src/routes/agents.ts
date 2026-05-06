import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, agentsTable, leadsTable, dealsTable } from "@workspace/db";
import {
  CreateAgentBody,
  UpdateAgentBody,
  UpdateAgentParams,
  GetAgentParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/agents", async (_req, res): Promise<void> => {
  const agents = await db.select().from(agentsTable).orderBy(agentsTable.name);

  const enriched = await Promise.all(
    agents.map(async (agent) => {
      const [leadsCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(leadsTable)
        .where(eq(leadsTable.assignedTo, agent.id));
      const dealRows = await db
        .select({ count: sql<number>`count(*)::int`, revenue: sql<number>`coalesce(sum(value::numeric), 0)` })
        .from(dealsTable)
        .where(eq(dealsTable.agentId, agent.id));
      return {
        ...agent,
        activeLeads: leadsCount?.count ?? 0,
        dealsCount: dealRows[0]?.count ?? 0,
        revenue: Number(dealRows[0]?.revenue ?? 0),
        createdAt: agent.createdAt.toISOString(),
      };
    }),
  );

  res.json(enriched);
});

router.post("/agents", async (req, res): Promise<void> => {
  const parsed = CreateAgentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [agent] = await db.insert(agentsTable).values(parsed.data).returning();
  res.status(201).json({
    ...agent,
    activeLeads: 0,
    dealsCount: 0,
    revenue: 0,
    createdAt: agent.createdAt.toISOString(),
  });
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
  const [leadsCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leadsTable)
    .where(eq(leadsTable.assignedTo, agent.id));
  const dealRows = await db
    .select({ count: sql<number>`count(*)::int`, revenue: sql<number>`coalesce(sum(value::numeric), 0)` })
    .from(dealsTable)
    .where(eq(dealsTable.agentId, agent.id));

  res.json({
    ...agent,
    activeLeads: leadsCount?.count ?? 0,
    dealsCount: dealRows[0]?.count ?? 0,
    revenue: Number(dealRows[0]?.revenue ?? 0),
    createdAt: agent.createdAt.toISOString(),
  });
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
  const [leadsCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leadsTable)
    .where(eq(leadsTable.assignedTo, agent.id));
  const dealRows = await db
    .select({ count: sql<number>`count(*)::int`, revenue: sql<number>`coalesce(sum(value::numeric), 0)` })
    .from(dealsTable)
    .where(eq(dealsTable.agentId, agent.id));

  res.json({
    ...agent,
    activeLeads: leadsCount?.count ?? 0,
    dealsCount: dealRows[0]?.count ?? 0,
    revenue: Number(dealRows[0]?.revenue ?? 0),
    createdAt: agent.createdAt.toISOString(),
  });
});

export default router;
