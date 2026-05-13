import { Router } from "express";
import { eq, or, desc } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";

const router = Router();

// GET /notifications — returns notifications visible to current user (by role or direct userId)
router.get("/notifications", async (req, res): Promise<void> => {
  const user = req.user!;
  const rows = await db
    .select()
    .from(notificationsTable)
    .where(
      or(
        eq(notificationsTable.targetRole, user.role),
        eq(notificationsTable.targetUserId, user.id),
      ),
    )
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);

  res.json(
    rows.map(n => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
    })),
  );
});

// PATCH /notifications/read-all — mark all as read for current user
router.patch("/notifications/read-all", async (req, res): Promise<void> => {
  const user = req.user!;
  await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(
      or(
        eq(notificationsTable.targetRole, user.role),
        eq(notificationsTable.targetUserId, user.id),
      ),
    );
  res.json({ ok: true });
});

// PATCH /notifications/:id/read — mark one as read
router.patch("/notifications/:id/read", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [n] = await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(eq(notificationsTable.id, id))
    .returning();
  if (!n) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...n, createdAt: n.createdAt.toISOString() });
});

export default router;
