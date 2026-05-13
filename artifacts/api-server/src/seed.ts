import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { logger } from "./lib/logger";

const DEMO_USERS = [
  // isAdmin=true → can create/delete/edit users in the platform
  { username: "admin",        password: "Admin@123",  name: "Harsh Jain",    role: "owner",   isAdmin: true  },
  { username: "harsh",        password: "Demo@123",   name: "Harsh Jain",    role: "owner",   isAdmin: false },
  { username: "rakesh",       password: "Demo@123",   name: "Rakesh Kumar",  role: "cfo",     isAdmin: false },
  { username: "sneha",        password: "Demo@123",   name: "Sneha Joshi",   role: "manager", isAdmin: false },
  { username: "riya",         password: "Demo@123",   name: "Riya Sharma",   role: "sales",   isAdmin: false },
  { username: "vijay",        password: "Demo@123",   name: "Vijay Broker",  role: "broker",  isAdmin: false },
];

export async function seedUsers(): Promise<void> {
  try {
    const existing = await db.select({ id: usersTable.id }).from(usersTable).limit(1);
    if (existing.length > 0) return; // already seeded

    for (const u of DEMO_USERS) {
      const passwordHash = await bcrypt.hash(u.password, 10);
      await db.insert(usersTable).values({
        username: u.username,
        passwordHash,
        name: u.name,
        role: u.role,
        isAdmin: u.isAdmin,
        agentId: null,
      }).onConflictDoNothing();
    }

    logger.info("Demo users seeded successfully");
  } catch (err) {
    logger.error({ err }, "Failed to seed users (table may not exist yet — run drizzle-kit push)");
  }
}
