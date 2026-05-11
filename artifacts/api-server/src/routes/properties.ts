import { Router, type IRouter } from "express";
import { eq, and, type SQL } from "drizzle-orm";
import { db, propertiesTable, agentsTable, activityTable } from "@workspace/db";
import {
  CreatePropertyBody,
  UpdatePropertyBody,
  UpdatePropertyParams,
  GetPropertyParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatProperty(prop: typeof propertiesTable.$inferSelect, agentName?: string | null) {
  return {
    ...prop,
    price: Number(prop.price),
    areaSqft: prop.areaSqft != null ? Number(prop.areaSqft) : null,
    agentName: agentName ?? null,
    createdAt: prop.createdAt.toISOString(),
    updatedAt: prop.updatedAt.toISOString(),
  };
}

router.get("/properties", async (req, res): Promise<void> => {
  const { status, type } = req.query;
  const conditions: SQL[] = [];
  if (status && typeof status === "string") conditions.push(eq(propertiesTable.status, status));
  if (type && typeof type === "string") conditions.push(eq(propertiesTable.type, type));

  let rows;
  if (conditions.length > 0) {
    rows = await db.select().from(propertiesTable).where(and(...conditions)).orderBy(propertiesTable.createdAt);
  } else {
    rows = await db.select().from(propertiesTable).orderBy(propertiesTable.createdAt);
  }

  const agents = await db.select().from(agentsTable);
  const agentMap = new Map(agents.map((a) => [a.id, a.name]));

  res.json(rows.map((p) => formatProperty(p, agentMap.get(p.agentId ?? -1))));
});

router.post("/properties", async (req, res): Promise<void> => {
  const parsed = CreatePropertyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [prop] = await db.insert(propertiesTable).values({
    ...parsed.data,
    price: String(parsed.data.price),
    areaSqft: parsed.data.areaSqft != null ? String(parsed.data.areaSqft) : parsed.data.areaSqft,
    status: parsed.data.status ?? "available",
  }).returning();

  let agentName: string | null = null;
  if (prop.agentId) {
    const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, prop.agentId));
    agentName = agent?.name ?? null;
  }

  await db.insert(activityTable).values({
    type: "property_added",
    description: `New property listed`,
    entityName: prop.title,
    agentId: prop.agentId ?? undefined,
  });

  res.status(201).json(formatProperty(prop, agentName));
});

router.get("/properties/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetPropertyParams.safeParse({ id: Number(raw) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [prop] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, params.data.id));
  if (!prop) {
    res.status(404).json({ error: "Property not found" });
    return;
  }
  let agentName: string | null = null;
  if (prop.agentId) {
    const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, prop.agentId));
    agentName = agent?.name ?? null;
  }
  res.json(formatProperty(prop, agentName));
});

router.put("/properties/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdatePropertyParams.safeParse({ id: Number(raw) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdatePropertyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [prop] = await db
    .update(propertiesTable)
    .set({
      ...parsed.data,
      price: parsed.data.price !== undefined ? String(parsed.data.price) : undefined,
      areaSqft: parsed.data.areaSqft != null ? String(parsed.data.areaSqft) : parsed.data.areaSqft,
    })
    .where(eq(propertiesTable.id, params.data.id))
    .returning();
  if (!prop) {
    res.status(404).json({ error: "Property not found" });
    return;
  }
  let agentName: string | null = null;
  if (prop.agentId) {
    const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, prop.agentId));
    agentName = agent?.name ?? null;
  }
  res.json(formatProperty(prop, agentName));
});

router.delete("/properties/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [prop] = await db.delete(propertiesTable).where(eq(propertiesTable.id, id)).returning();
  if (!prop) {
    res.status(404).json({ error: "Property not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
