import bcrypt from "bcryptjs";
import { db, usersTable, agentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./lib/logger";

// Demo users; operational roles (manager/agent) also get an agent record
const DEMO_USERS = [
  { username: "admin",  password: "Admin@123", name: "Harsh Jain",   role: "owner",   isAdmin: true,  email: null },
  { username: "harsh",  password: "Demo@123",  name: "Harsh Jain",   role: "owner",   isAdmin: false, email: null },
  { username: "rakesh", password: "Demo@123",  name: "Rakesh Kumar", role: "cfo",     isAdmin: false, email: null },
  { username: "sneha",  password: "Demo@123",  name: "Sneha Joshi",  role: "manager", isAdmin: false, email: "sneha.joshi@estate.demo" },
  { username: "riya",   password: "Demo@123",  name: "Riya Sharma",  role: "agent",   isAdmin: false, email: "riya.sharma@estate.demo" },
  { username: "vijay",  password: "Demo@123",  name: "Vijay Broker", role: "broker",  isAdmin: false, email: "vijay.broker@estate.demo" },
];

const AGENT_ROLES = ["manager", "agent", "broker"];

export async function seedUsers(): Promise<void> {
  try {
    const existing = await db.select({ id: usersTable.id }).from(usersTable).limit(1);
    if (existing.length > 0) return;

    for (const u of DEMO_USERS) {
      const passwordHash = await bcrypt.hash(u.password, 10);

      // Create agent record for operational roles
      let agentId: number | null = null;
      if (AGENT_ROLES.includes(u.role) && u.email) {
        const [agent] = await db.insert(agentsTable).values({
          name: u.name,
          email: u.email,
          role: u.role,
        }).onConflictDoNothing().returning();
        agentId = agent?.id ?? null;

        // If conflict (agent already exists by email), look it up
        if (agentId == null) {
          const [existing] = await db.select({ id: agentsTable.id }).from(agentsTable).where(eq(agentsTable.email, u.email));
          agentId = existing?.id ?? null;
        }
      }

      await db.insert(usersTable).values({
        username: u.username,
        passwordHash,
        name: u.name,
        role: u.role,
        isAdmin: u.isAdmin,
        agentId,
      }).onConflictDoNothing();
    }

    logger.info("Demo users seeded successfully");
  } catch (err) {
    logger.error({ err }, "Failed to seed users (table may not exist yet — run drizzle-kit push)");
  }
}
