import { Router, type IRouter } from "express";
import { eq, sql, gte, lte, and, inArray, isNull, isNotNull } from "drizzle-orm";
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
router.get("/dashboard/today", async (req, res): Promise<void> => {
  const user = req.user!;
  const isField = user.role === "agent" || user.role === "broker";
  const today = new Date().toISOString().slice(0, 10);

  const viewings = isField && user.agentId
    ? await db.select().from(viewingsTable).where(and(eq(viewingsTable.date, today), eq(viewingsTable.agentId, user.agentId)))
    : await db.select().from(viewingsTable).where(eq(viewingsTable.date, today));

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

  // Overdue leads: new + created >2hrs ago — field roles see only their own
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
    .where(
      isField && user.agentId
        ? and(eq(leadsTable.status, "new"), lte(leadsTable.createdAt, twoHoursAgo), eq(leadsTable.assignedTo, user.agentId))
        : and(eq(leadsTable.status, "new"), lte(leadsTable.createdAt, twoHoursAgo)),
    )
    .limit(10);

  // Hot leads: score >=75, status = new/contacted/qualified — field roles see only their own
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
    .where(
      isField && user.agentId
        ? and(sql`score >= 75 AND status IN ('new','contacted','qualified')`, eq(leadsTable.assignedTo, user.agentId))
        : sql`score >= 75 AND status IN ('new','contacted','qualified')`,
    )
    .limit(5);

  res.json({
    todayViewings,
    overdueLeads: overdueLeads.map(l => ({ ...l, createdAt: l.createdAt.toISOString() })),
    hotLeads: hotLeads.map(l => ({ ...l, createdAt: l.createdAt.toISOString() })),
  });
});

// Agent performance for current month — field roles see only their own row
router.get("/dashboard/agents-performance", async (req, res): Promise<void> => {
  const user = req.user!;
  const isField = user.role === "agent" || user.role === "broker";
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const agents = isField && user.agentId
    ? await db.select().from(agentsTable).where(eq(agentsTable.id, user.agentId))
    : await db.select().from(agentsTable);

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

// Inventory: properties with per-property unit breakdown + blocked unit details
router.get("/dashboard/inventory", async (_req, res): Promise<void> => {
  const properties = await db.select().from(propertiesTable);
  const allUnits = await db.select().from(unitsTable);

  const propertyMap = new Map(properties.map(p => [p.id, p]));

  const result = properties.map(p => {
    const propUnits = allUnits.filter(u => u.propertyId === p.id);
    return {
      id: p.id,
      title: p.title,
      city: p.city,
      type: p.type,
      status: p.status,
      price: Number(p.price),
      totalUnits: propUnits.length,
      available: propUnits.filter(u => u.status === "available").length,
      sold: propUnits.filter(u => u.status === "sold").length,
      booked: propUnits.filter(u => u.status === "booked").length,
      blocked: propUnits.filter(u => u.status === "blocked").length,
    };
  });

  const blockedRaw = allUnits.filter(u => u.status === "blocked");
  const leadIds = [...new Set(blockedRaw.map(u => u.blockedByLeadId).filter(Boolean))] as number[];
  const blockedLeads = leadIds.length
    ? await db.select({ id: leadsTable.id, name: leadsTable.name }).from(leadsTable)
    : [];
  const leadNameMap = new Map(blockedLeads.map(l => [l.id, l.name]));

  const blockedUnits = blockedRaw.map(u => ({
    id: u.id,
    unitNo: u.unitNo,
    propertyId: u.propertyId,
    propertyTitle: u.propertyId ? (propertyMap.get(u.propertyId)?.title ?? null) : null,
    buyerName: u.blockedByLeadId ? (leadNameMap.get(u.blockedByLeadId) ?? null) : null,
    daysBlocked: Math.floor((Date.now() - u.updatedAt.getTime()) / 86400000),
  }));

  res.json({ properties: result, blockedUnits });
});

// Aggregated lost-lead reasons from real data
router.get("/dashboard/lost-reasons", async (_req, res): Promise<void> => {
  const rows = await db
    .select({ reason: leadsTable.lostReason, count: sql<number>`count(*)::int` })
    .from(leadsTable)
    .where(and(eq(leadsTable.status, "closed_lost"), isNotNull(leadsTable.lostReason)))
    .groupBy(leadsTable.lostReason);

  const total = rows.reduce((s, r) => s + r.count, 0);
  const REASON_COLORS: Record<string, string> = {
    "Budget too high":       "#ef4444",
    "Location preference":   "#f59e0b",
    "Competitor offering":   "#8b5cf6",
    "Project delay concern": "#3b82f6",
    "Config unavailable":    "#10b981",
    "No response":           "#6b7280",
    "Other":                 "#94a3b8",
  };

  const result = rows.map(r => ({
    reason: r.reason ?? "Other",
    count: r.count,
    pct: total > 0 ? Math.round((r.count / total) * 100) : 0,
    color: REASON_COLORS[r.reason as string] ?? "#94a3b8",
  })).sort((a, b) => b.count - a.count);

  res.json(result);
});

// Location ROI: group closed_won deals by city via linked property
router.get("/dashboard/location-roi", async (_req, res): Promise<void> => {
  const closedDeals = await db
    .select({
      propertyId: dealsTable.propertyId,
      value: dealsTable.value,
      updatedAt: dealsTable.updatedAt,
    })
    .from(dealsTable)
    .where(eq(dealsTable.stage, "closed_won"));

  if (closedDeals.length === 0) { res.json([]); return; }

  const propIds = [...new Set(closedDeals.map(d => d.propertyId).filter(Boolean))] as number[];
  const properties = propIds.length
    ? await db.select({ id: propertiesTable.id, city: propertiesTable.city, price: propertiesTable.price }).from(propertiesTable)
    : [];
  const propMap = new Map(properties.map(p => [p.id, p]));

  const cityMap = new Map<string, { deals: number; totalValue: number; totalInvested: number }>();
  for (const deal of closedDeals) {
    const prop = deal.propertyId ? propMap.get(deal.propertyId) : null;
    const city = prop?.city ?? "Other";
    const existing = cityMap.get(city) ?? { deals: 0, totalValue: 0, totalInvested: 0 };
    existing.deals += 1;
    existing.totalValue += Number(deal.value);
    existing.totalInvested += prop ? Number(prop.price) : 0;
    cityMap.set(city, existing);
  }

  const result = [...cityMap.entries()]
    .map(([location, data]) => ({
      location,
      deals: data.deals,
      avgROI: data.totalInvested > 0
        ? Math.round(((data.totalValue - data.totalInvested) / data.totalInvested) * 100)
        : 0,
    }))
    .sort((a, b) => b.deals - a.deals)
    .slice(0, 6);

  res.json(result);
});

// Demand intelligence: most-wanted BHK types and budget ranges from active leads
router.get("/dashboard/demand-intelligence", async (_req, res): Promise<void> => {
  const activeLeads = await db
    .select({
      propertyType: leadsTable.propertyType,
      budget: leadsTable.budget,
      source: leadsTable.source,
      lostReason: leadsTable.lostReason,
      status: leadsTable.status,
    })
    .from(leadsTable)
    .where(sql`status NOT IN ('closed_lost')`);

  // BHK demand
  const bhkMap = new Map<string, number>();
  for (const lead of activeLeads) {
    if (lead.propertyType) {
      bhkMap.set(lead.propertyType, (bhkMap.get(lead.propertyType) ?? 0) + 1);
    }
  }
  const bhkDemand = [...bhkMap.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  // Budget range buckets
  const budgetBuckets = new Map<string, number>([
    ["< 50L", 0], ["50L – 1Cr", 0], ["1Cr – 2Cr", 0], ["2Cr – 5Cr", 0], ["> 5Cr", 0],
  ]);
  for (const lead of activeLeads) {
    const b = Number(lead.budget ?? 0);
    if (!b) continue;
    if (b < 5000000) budgetBuckets.set("< 50L", budgetBuckets.get("< 50L")! + 1);
    else if (b < 10000000) budgetBuckets.set("50L – 1Cr", budgetBuckets.get("50L – 1Cr")! + 1);
    else if (b < 20000000) budgetBuckets.set("1Cr – 2Cr", budgetBuckets.get("1Cr – 2Cr")! + 1);
    else if (b < 50000000) budgetBuckets.set("2Cr – 5Cr", budgetBuckets.get("2Cr – 5Cr")! + 1);
    else budgetBuckets.set("> 5Cr", budgetBuckets.get("> 5Cr")! + 1);
  }
  const budgetDemand = [...budgetBuckets.entries()].map(([range, count]) => ({ range, count }));

  // Top objections (from closed_lost)
  const lostLeads = await db
    .select({ lostReason: leadsTable.lostReason })
    .from(leadsTable)
    .where(and(eq(leadsTable.status, "closed_lost"), isNotNull(leadsTable.lostReason)));

  const objectionMap = new Map<string, number>();
  for (const lead of lostLeads) {
    const r = lead.lostReason ?? "Other";
    objectionMap.set(r, (objectionMap.get(r) ?? 0) + 1);
  }
  const topObjections = [...objectionMap.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  res.json({ bhkDemand, budgetDemand, topObjections, totalActiveLeads: activeLeads.length });
});

// Site visit to booking conversion funnel (last 30 days) — field roles see only their own data
router.get("/dashboard/visit-conversion", async (req, res): Promise<void> => {
  const user = req.user!;
  const isField = user.role === "agent" || user.role === "broker";
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const visits = await db.select({
    id: viewingsTable.id,
    status: viewingsTable.status,
    agentId: viewingsTable.agentId,
    leadId: viewingsTable.leadId,
    createdAt: viewingsTable.createdAt,
  }).from(viewingsTable).where(
    isField && user.agentId
      ? and(gte(viewingsTable.createdAt, thirtyDaysAgo), eq(viewingsTable.agentId, user.agentId))
      : gte(viewingsTable.createdAt, thirtyDaysAgo),
  );

  const completedVisits = visits.filter(v => v.status === "completed");
  const leadIds = [...new Set(completedVisits.map(v => v.leadId).filter(Boolean))] as number[];

  // Find deals closed_won for those leads
  let bookings = 0;
  if (leadIds.length > 0) {
    const bookedDeals = await db.select({ leadId: dealsTable.leadId })
      .from(dealsTable)
      .where(and(eq(dealsTable.stage, "closed_won"), inArray(dealsTable.leadId, leadIds)));
    bookings = bookedDeals.length;
  }

  // Per-agent breakdown
  const agents = await db.select({ id: agentsTable.id, name: agentsTable.name }).from(agentsTable);
  const agentMap = new Map(agents.map(a => [a.id, a.name]));

  const agentStats = new Map<number, { visits: number; completed: number; agentName: string }>();
  for (const v of visits) {
    if (!v.agentId) continue;
    const s = agentStats.get(v.agentId) ?? { visits: 0, completed: 0, agentName: agentMap.get(v.agentId) ?? "Unknown" };
    s.visits += 1;
    if (v.status === "completed") s.completed += 1;
    agentStats.set(v.agentId, s);
  }

  const conversionRate = completedVisits.length > 0
    ? Math.round((bookings / completedVisits.length) * 100)
    : 0;

  res.json({
    totalVisitsScheduled: visits.length,
    completedVisits: completedVisits.length,
    bookingsFromVisits: bookings,
    conversionRate,
    byAgent: [...agentStats.entries()].map(([agentId, s]) => ({
      agentId,
      agentName: s.agentName,
      visits: s.visits,
      completed: s.completed,
      conversionRate: s.completed > 0 ? Math.round((s.completed / s.visits) * 100) : 0,
    })),
  });
});

export default router;
