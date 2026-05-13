import { Router } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { authMiddleware, adminMiddleware } from "../middlewares/auth";

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

// POST /admin/users — create user
router.post("/admin/users", async (req, res): Promise<void> => {
  const { username, password, name, role, isAdmin, agentId } = req.body ?? {};
  if (!username || !password || !name || !role) {
    res.status(400).json({ error: "username, password, name and role are required" });
    return;
  }

  const passwordHash = await bcrypt.hash(String(password), 10);

  try {
    const [user] = await db
      .insert(usersTable)
      .values({
        username: String(username).toLowerCase().trim(),
        passwordHash,
        name: String(name).trim(),
        role: String(role),
        isAdmin: Boolean(isAdmin),
        agentId: agentId != null ? Number(agentId) : null,
      })
      .returning(PUBLIC_FIELDS);
    res.status(201).json(user);
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(409).json({ error: "Username already exists" });
    } else {
      throw err;
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

  const [user] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, id))
    .returning(PUBLIC_FIELDS);

  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(user);
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
