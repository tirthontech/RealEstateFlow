import app from "./app";
import { logger } from "./lib/logger";
import { seedUsers } from "./seed";
import { db, usersTable, agentsTable } from "@workspace/db";
import { isNull, inArray, eq } from "drizzle-orm";

const rawPort = process.env["PORT"];
const port = rawPort ? Number(rawPort) : 3001;

if (rawPort && (Number.isNaN(port) || port <= 0)) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Creates agent records for any existing user with an agent role that has no linked agent yet.
// Runs once at startup — safe to re-run (no-op if all links exist).
async function repairAgentLinks(): Promise<void> {
  try {
    const AGENT_ROLES = ["manager", "agent", "broker"];
    const orphans = await db
      .select()
      .from(usersTable)
      .where(isNull(usersTable.agentId));

    const agentRoleOrphans = orphans.filter(u => AGENT_ROLES.includes(u.role));
    if (agentRoleOrphans.length === 0) return;

    for (const user of agentRoleOrphans) {
      const [agent] = await db.insert(agentsTable).values({
        name: user.name,
        email: null,
        role: user.role,
        userId: user.id,
      }).returning();
      await db.update(usersTable).set({ agentId: agent.id }).where(eq(usersTable.id, user.id));
      logger.info({ userId: user.id, agentId: agent.id }, "Repaired missing agent link");
    }
  } catch (err) {
    logger.error({ err }, "repairAgentLinks failed (table may not exist yet)");
  }
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  await seedUsers();
  await repairAgentLinks();
});
