import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { logger } from "./lib/logger";

// Seeds a single owner/admin account when the DB is empty.
// All other users (agents, managers, brokers) are created by the owner via Manage Users.
export async function seedUsers(): Promise<void> {
  try {
    const existing = await db.select({ id: usersTable.id }).from(usersTable).limit(1);
    if (existing.length > 0) return;

    const passwordHash = await bcrypt.hash("Admin@123", 10);
    await db.insert(usersTable).values({
      username: "admin",
      passwordHash,
      name: "Admin",
      role: "owner",
      isAdmin: true,
      agentId: null,
    });

    logger.info("Seeded default admin user (admin / Admin@123)");
  } catch (err) {
    logger.error({ err }, "Failed to seed (table may not exist yet — run drizzle-kit push)");
  }
}
