import { Router, type IRouter } from "express";
import { eq, sql, gte, lte, and, inArray, isNull } from "drizzle-orm";
import {
  db, leadsTable, dealsTable, propertiesTable, activityTable,
  agentsTable, viewingsTable, unitsTable,
} from "@workspace/db";

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

  // Bookings this month (deals closed_won since monthStart)
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const [bookingsThisMonth] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(dealsTable)
    .where(and(eq(dealsTable.stage, "closed_won"), gte(dealsTable.updatedAt, monthStart)));

  // Overdue leads: status=new, created >2 hrs ago, unassigned or assigned but not yet contacted
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const [overdueLeads] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leadsTable)
    .where(and(eq(leadsTable.status, "new"), lte(leadsTable.createdAt, twoHoursAgo)));

  // Today's site visits
  const today = new Date().toISOString().slice(0, 10);
  const [todayVisits] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(viewingsTable)
    .where(eq(viewingsTable.date, today));

  // Available units
  const [availUnits] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(unitsTable)
    .where(eq(unitsTable.status, "available"));

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
    bookingsThisMonth: bookingsThisMonth?.count ?? 0,
    overdueLeads: overdueLeads?.count ?? 0,
    todayVisits: todayVisits?.count ?? 0,
    availableUnits: availUnits?.count ?? 0,
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

// Today's schedule: viewings for today + overdue new leads
router.get("/dashboard/today", async (_req, res): Promise<void> => {
  const today = new Date().toISOString().slice(0, 10);

  const viewings = await db.select().from(viewingsTable).where(eq(viewingsTable.date, today));

  // Enrich with lead and property names
  const leadIds = [...new Set(viewings.map(v => v.leadId).filter(Boolean))] as number[];
  const propIds = [...new Set(viewings.map(v => v.propertyId).filter(Boolean))] as number[];
  const agentIds = [...new Set(viewings.map(v => v.agentId).filter(Boolean))] as number[];

  const [leads, properties, agents] = await Promise.all([
    leadIds.length ? db.select({ id: leadsTable.id, name: leadsTable.name, phone: leadsTable.phone }).from(leadsTable) : [],
    propIds.length ? db.select({ id: propertiesTable.id, title: propertiesTable.title }).from(propertiesTable) : [],
    agentIds.length ? db.select({ id: agentsTable.id, name: agentsTable.name }).from(agentsTable) : [],
  ]);
  const leadMap  = new Map((leads as any[]).map(l => [l.id, l]));
  const propMap  = new Map((properties as any[]).map(p => [p.id, p.title]));
  const agentMap = new Map((agents as any[]).map(a => [a.id, a.name]));

  const todayViewings = viewings.map(v => ({
    id: v.id,
    time: v.time,
    status: v.status,
    notes: v.notes,
    leadId: v.leadId,
    leadName: v.leadId ? leadMap.get(v.leadId)?.name ?? null : null,
    leadPhone: v.leadId ? leadMap.get(v.leadId)?.phone ?? null : null,
    propertyId: v.propertyId,
    propertyTitle: v.propertyId ? propMap.get(v.propertyId) ?? null : null,
    agentId: v.agentId,
    agentName: v.agentId ? agentMap.get(v.agentId) ?? null : null,
  })).sort((a, b) => a.time.localeCompare(b.time));

  // Overdue leads: new + created >2hrs ago
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const overdueLeads = await db
    .select({
      id: leadsTable.id,
      name: leadsTable.name,
      phone: leadsTable.phone,
      source: leadsTable.source,
      createdAt: leadsTable.createdAt,
      assignedTo: leadsTable.assignedTo,
    })
    .from(leadsTable)
    .where(and(eq(leadsTable.status, "new"), lte(leadsTable.createdAt, twoHoursAgo)))
    .limit(10);

  // Hot leads: score >=75, status = new or contacted
  const hotLeads = await db
    .select({
      id: leadsTable.id,
      name: leadsTable.name,
      phone: leadsTable.phone,
      source: leadsTable.source,
      score: leadsTable.score,
      status: leadsTable.status,
      budget: leadsTable.budget,
      createdAt: leadsTable.createdAt,
    })
    .from(leadsTable)
    .where(sql`score >= 75 AND status IN ('new','contacted','qualified')`)
    .limit(5);

  res.json({
    todayViewings,
    overdueLeads: overdueLeads.map(l => ({ ...l, createdAt: l.createdAt.toISOString() })),
    hotLeads: hotLeads.map(l => ({ ...l, createdAt: l.createdAt.toISOString() })),
  });
});

// Agent performance for current month
router.get("/dashboard/agents-performance", async (_req, res): Promise<void> => {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const agents = await db.select().from(agentsTable);

  const [leadsThisMonth, dealsThisMonth, viewingsThisMonth] = await Promise.all([
    db.select({ agentId: leadsTable.assignedTo, count: sql<number>`count(*)::int` })
      .from(leadsTable).where(gte(leadsTable.createdAt, monthStart)).groupBy(leadsTable.assignedTo),
    db.select({
      agentId: dealsTable.agentId,
      count: sql<number>`count(*)::int`,
      revenue: sql<number>`coalesce(sum(value::numeric),0)`,
    }).from(dealsTable).where(and(eq(dealsTable.stage, "closed_won"), gte(dealsTable.updatedAt, monthStart))).groupBy(dealsTable.agentId),
    db.select({ agentId: viewingsTable.agentId, count: sql<number>`count(*)::int` })
      .from(viewingsTable).where(gte(viewingsTable.createdAt, monthStart)).groupBy(viewingsTable.agentId),
  ]);

  const leadsMap   = new Map(leadsThisMonth.map(r => [r.agentId, r.count]));
  const dealsMap   = new Map(dealsThisMonth.map(r => [r.agentId, r]));
  const visitMap   = new Map(viewingsThisMonth.map(r => [r.agentId, r.count]));

  const result = agents.map(agent => ({
    id: agent.id,
    name: agent.name,
    email: agent.email,
    role: agent.role,
    leadsThisMonth: leadsMap.get(agent.id) ?? 0,
    bookingsThisMonth: dealsMap.get(agent.id)?.count ?? 0,
    revenueThisMonth: Number(dealsMap.get(agent.id)?.revenue ?? 0),
    visitsThisMonth: visitMap.get(agent.id) ?? 0,
  }));

  res.json(result);
});

export default router;
