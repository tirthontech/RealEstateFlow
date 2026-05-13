import { Router } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable, agentsTable } from "@workspace/db";
import { authMiddleware, adminMiddleware } from "../middlewares/auth";

// Roles that need an agent record in the agents table
const AGENT_ROLES = ["manager", "agent", "broker"];

const router = Router();

// All /admin/* routes require auth + isAdmin
router.use(authMiddleware as any);
router.use(adminMiddleware as any);

const PUBLIC_FIELDS = {
  id: usersTable.id,
  username: usersTable.username,
  name: usersTable.name,
  role: usersTable.role,
  isAdmin: usersTable.isAdmin,
  agentId: usersTable.agentId,
  createdAt: usersTable.createdAt,
};

// GET /admin/users — list all users
router.get("/admin/users", async (_req, res): Promise<void> => {
  const users = await db.select(PUBLIC_FIELDS).from(usersTable).orderBy(usersTable.createdAt);
  res.json(users);
});

// POST /admin/users — create user (auto-creates agent for manager/sales/broker roles)
router.post("/admin/users", async (req, res): Promise<void> => {
  const { username, password, name, role, isAdmin, email } = req.body ?? {};
  if (!username || !password || !name || !role) {
    res.status(400).json({ error: "username, password, name and role are required" });
    return;
  }
  if (AGENT_ROLES.includes(String(role)) && !email) {
    res.status(400).json({ error: "Email is required for manager/agent/broker roles" });
    return;
  }

  const passwordHash = await bcrypt.hash(String(password), 10);

  try {
    // Create agent record first if needed
    let linkedAgentId: number | null = null;
    if (AGENT_ROLES.includes(String(role))) {
      const [agent] = await db.insert(agentsTable).values({
        name: String(name).trim(),
        email: String(email).toLowerCase().trim(),
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

    // Back-link agent → user so agents page can show login status
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

// PUT /admin/users/:id — edit user (name, role, isAdmin, agentId, password)
router.put("/admin/users/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { name, role, isAdmin, agentId, password } = req.body ?? {};
  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (name !== undefined)    updates.name = String(name).trim();
  if (role !== undefined)    updates.role = String(role);
  if (isAdmin !== undefined) updates.isAdmin = Boolean(isAdmin);
  if (agentId !== undefined) updates.agentId = agentId != null ? Number(agentId) : null;
  if (password)              updates.passwordHash = await bcrypt.hash(String(password), 10);

  try {
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

// DELETE /admin/users/:id — delete user
router.delete("/admin/users/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [deleted] = await db.delete(usersTable).where(eq(usersTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "User not found" }); return; }
  res.sendStatus(204);
});

export default router;
