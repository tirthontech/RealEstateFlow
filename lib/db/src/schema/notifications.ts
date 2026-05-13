import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // "portal_lead" | "lead_assigned"
  title: text("title").notNull(),
  message: text("message"),
  leadId: integer("lead_id"),
  targetRole: text("target_role"), // "owner" | "manager" | "agent" — role-based broadcast
  targetUserId: integer("target_user_id"), // specific user (for lead_assigned to agent)
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
