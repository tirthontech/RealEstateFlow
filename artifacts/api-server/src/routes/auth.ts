import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { JWT_SECRET, authMiddleware, type JwtPayload } from "../middlewares/auth";

const router = Router();

function toPayload(u: typeof usersTable.$inferSelect): JwtPayload {
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    role: u.role,
    isAdmin: u.isAdmin,
    agentId: u.agentId ?? null,
  };
}

router.post("/auth/login", async (req, res): Promise<void> => {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    res.status(400).json({ error: "Username and password required" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, String(username).toLowerCase().trim()));

  if (!user || !(await bcrypt.compare(String(password), user.passwordHash))) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  const payload = toPayload(user);
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user: payload });
});

router.get("/auth/me", authMiddleware, (req, res): void => {
  res.json(req.user);
});

export default router;
