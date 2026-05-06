import { Router, type IRouter } from "express";
import { eq, sql, gte, inArray } from "drizzle-orm";
import { db, leadsTable, dealsTable, propertiesTable, activityTable, agentsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/dashboard/stats", async (_req, res): Promise<void> => {
  const [totalLeads] = await db.select({ count: sql<number>`count(*)::int` }).from(leadsTable);
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const [newLeadsThisMonth] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leadsTable)
    .where(gte(leadsTable.createdAt, oneMonthAgo));

  const [totalDeals] = await db.select({ count: sql<number>`count(*)::int` }).from(dealsTable);
  const activeStages = ["prospect", "viewing", "offer", "under_contract", "due_diligence"];
  const [activeDeals] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(dealsTable)
    .where(inArray(dealsTable.stage, activeStages));

  const [pipeline] = await db
    .select({ total: sql<number>`coalesce(sum(value::numeric), 0)` })
    .from(dealsTable)
    .where(inArray(dealsTable.stage, activeStages));

  const [closed] = await db
    .select({ total: sql<number>`coalesce(sum(value::numeric), 0)` })
    .from(dealsTable)
    .where(eq(dealsTable.stage, "closed_won"));

  const [totalProps] = await db.select({ count: sql<number>`count(*)::int` }).from(propertiesTable);
  const [availProps] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(propertiesTable)
    .where(eq(propertiesTable.status, "available"));

  const allDeals = await db.select().from(dealsTable);
  const wonDeals = allDeals.filter((d) => d.stage === "closed_won");
  const conversionRate =
    allDeals.length > 0 ? Math.round((wonDeals.length / allDeals.length) * 100) : 0;
  const avgDealValue =
    wonDeals.length > 0
      ? wonDeals.reduce((acc, d) => acc + Number(d.value), 0) / wonDeals.length
      : 0;

  res.json({
    totalLeads: totalLeads?.count ?? 0,
    newLeadsThisMonth: newLeadsThisMonth?.count ?? 0,
    totalDeals: totalDeals?.count ?? 0,
    activeDeals: activeDeals?.count ?? 0,
    pipelineValue: Number(pipeline?.total ?? 0),
    closedRevenue: Number(closed?.total ?? 0),
    totalProperties: totalProps?.count ?? 0,
    availableProperties: availProps?.count ?? 0,
    conversionRate,
    avgDealValue,
  });
});

router.get("/dashboard/pipeline", async (_req, res): Promise<void> => {
  const stages = ["prospect", "viewing", "offer", "under_contract", "due_diligence", "closed_won", "closed_lost"];
  const rows = await db
    .select({
      stage: dealsTable.stage,
      count: sql<number>`count(*)::int`,
      value: sql<number>`coalesce(sum(value::numeric), 0)`,
    })
    .from(dealsTable)
    .groupBy(dealsTable.stage);

  const stageMap = new Map(rows.map((r) => [r.stage, r]));
  const result = stages.map((stage) => ({
    stage,
    count: stageMap.get(stage)?.count ?? 0,
    value: Number(stageMap.get(stage)?.value ?? 0),
  }));

  res.json(result);
});

router.get("/dashboard/recent-activity", async (_req, res): Promise<void> => {
  const activities = await db
    .select()
    .from(activityTable)
    .orderBy(sql`created_at DESC`)
    .limit(20);

  const agents = await db.select().from(agentsTable);
  const agentMap = new Map(agents.map((a) => [a.id, a.name]));

  res.json(
    activities.map((a) => ({
      ...a,
      agentName: a.agentId ? (agentMap.get(a.agentId) ?? null) : null,
      createdAt: a.createdAt.toISOString(),
    })),
  );
});

router.get("/dashboard/lead-sources", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      source: leadsTable.source,
      count: sql<number>`count(*)::int`,
    })
    .from(leadsTable)
    .groupBy(leadsTable.source);

  res.json(rows);
});

export default router;
