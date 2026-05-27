import { Router } from "express";
import bcrypt from "bcryptjs";
import { eq, inArray } from "drizzle-orm";
import { db, usersTable, agentsTable, leadsTable, dealsTable, viewingsTable, scheduledActivitiesTable } from "@workspace/db";
import { authMiddleware, adminMiddleware } from "../middlewares/auth";

const AGENT_ROLES = ["manager", "agent", "broker"];

const router = Router();

router.use(authMiddleware as any);
router.use(adminMiddleware as any);

const PUBLIC_FIELDS = {
  id: usersTable.id,
  username: usersTable.username,
  name: usersTable.name,
  role: usersTable.role,
  isAdmin: usersTable.isAdmin,
  agentId: usersTable.agentId,
  isActive: usersTable.isActive,
  createdAt: usersTable.createdAt,
};

router.get("/users", async (_req, res): Promise<void> => {
  const users = await db.select(PUBLIC_FIELDS).from(usersTable).orderBy(usersTable.createdAt);
  res.json(users);
});

router.post("/users", async (req, res): Promise<void> => {
  const { username, password, name, role, isAdmin, email } = req.body ?? {};
  if (!username || !password || !name || !role) {
    res.status(400).json({ error: "username, password, name and role are required" });
    return;
  }

  const passwordHash = await bcrypt.hash(String(password), 10);

  try {
    // Auto-create agent record for all agent-role users (email optional)
    let linkedAgentId: number | null = null;
    if (AGENT_ROLES.includes(String(role))) {
      const [agent] = await db.insert(agentsTable).values({
        name: String(name).trim(),
        email: email ? String(email).toLowerCase().trim() : null,
        role: String(role),
      }).returning();
      linkedAgentId = agent.id;
    }

    const [user] = await db
      .insert(usersTable)
      .values({
        username: String(username).toLowerCase().trim(),
        passwordHash,
        name: String(name).trim(),
        role: String(role),
        isAdmin: Boolean(isAdmin),
        agentId: linkedAgentId,
      })
      .returning(PUBLIC_FIELDS);

    // Back-link agent → user
    if (linkedAgentId) {
      await db.update(agentsTable).set({ userId: user.id }).where(eq(agentsTable.id, linkedAgentId));
    }

    res.status(201).json({ ...user, agentCreated: linkedAgentId != null });
  } catch (err: any) {
    if (err.code === "23505") {
      const msg = (err.detail ?? "").includes("email") ? "Email already in use" : "Username already exists";
      res.status(409).json({ error: msg });
    } else {
      console.error("[admin] create user error:", err);
      res.status(500).json({ error: "Failed to create user. Please try again." });
    }
  }
});

router.put("/users/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!existing) { res.status(404).json({ error: "User not found" }); return; }

  const { name, role, isAdmin, agentId, password, email, isActive } = req.body ?? {};
  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (name !== undefined)     updates.name = String(name).trim();
  if (role !== undefined)     updates.role = String(role);
  if (isAdmin !== undefined)  updates.isAdmin = Boolean(isAdmin);
  if (agentId !== undefined)  updates.agentId = agentId != null ? Number(agentId) : null;
  if (isActive !== undefined) updates.isActive = Boolean(isActive);
  if (password)               updates.passwordHash = await bcrypt.hash(String(password), 10);

  const newRole = updates.role ?? existing.role;
  const wasAgent = AGENT_ROLES.includes(existing.role);
  const willBeAgent = AGENT_ROLES.includes(newRole);

  try {
    // Role changed to an agent role but user has no agent yet → create one
    if (willBeAgent && !existing.agentId) {
      const [agent] = await db.insert(agentsTable).values({
        name: updates.name ?? existing.name,
        email: email ? String(email).toLowerCase().trim() : null,
        role: newRole,
        userId: id,
      }).returning();
      updates.agentId = agent.id;
    }

    // Role changed away from agent role → unlink agent
    if (wasAgent && !willBeAgent && existing.agentId) {
      await db.update(agentsTable).set({ userId: null }).where(eq(agentsTable.id, existing.agentId));
      updates.agentId = null;
    }

    const [user] = await db
      .update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, id))
      .returning(PUBLIC_FIELDS);

    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json(user);
  } catch (err: any) {
    console.error("[admin] update user error:", err);
    res.status(500).json({ error: "Failed to update user. Please try again." });
  }
});

router.delete("/users/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  // Cascade: unassign leads, deals, viewings + activities linked to their agent profile, then delete agent
  if (user.agentId) {
    await db.update(leadsTable).set({ assignedTo: null }).where(eq(leadsTable.assignedTo, user.agentId));
    await db.update(dealsTable).set({ agentId: null }).where(eq(dealsTable.agentId, user.agentId));
    await db.update(viewingsTable).set({ agentId: null }).where(eq(viewingsTable.agentId, user.agentId));
    await db.update(scheduledActivitiesTable).set({ agentId: null }).where(eq(scheduledActivitiesTable.agentId, user.agentId));
    await db.delete(agentsTable).where(eq(agentsTable.id, user.agentId));
  }

  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.sendStatus(204);
});

export default router;
