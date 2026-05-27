import bcrypt from "bcryptjs";
import { ne } from "drizzle-orm";
import { db, usersTable, agentsTable } from "@workspace/db";
import { logger } from "./lib/logger";

export async function seedUsers(): Promise<void> {
  try {
    // Remove all non-admin users and their agent records so the owner starts fresh
    const nonAdmins = await db
      .select({ id: usersTable.id, agentId: usersTable.agentId })
      .from(usersTable)
      .where(ne(usersTable.username, "admin"));

    for (const u of nonAdmins) {
      if (u.agentId) {
        await db.delete(agentsTable).where(
          (await import("drizzle-orm")).eq(agentsTable.id, u.agentId),
        );
      }
    }

    if (nonAdmins.length > 0) {
      await db.delete(usersTable).where(ne(usersTable.username, "admin"));
      logger.info(`Removed ${nonAdmins.length} non-admin user(s) on startup`);
    }

    // Upsert the admin account so credentials are always correct
    const passwordHash = await bcrypt.hash("Admin@123", 10);
    await db
      .insert(usersTable)
      .values({
        username: "admin",
        passwordHash,
        name: "Admin",
        role: "owner",
        isAdmin: true,
        agentId: null,
      })
      .onConflictDoUpdate({
        target: usersTable.username,
        set: { passwordHash, name: "Admin", role: "owner", isAdmin: true },
      });

    logger.info("Admin account ready (admin / Admin@123)");
  } catch (err) {
    logger.error({ err }, "Failed to seed admin user");
  }
}
