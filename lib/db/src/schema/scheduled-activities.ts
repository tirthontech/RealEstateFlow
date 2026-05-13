import { pgTable, serial, text, integer, numeric, timestamp } from "drizzle-orm/pg-core";

export const scheduledActivitiesTable = pgTable("scheduled_activities", {
  id: serial("id").primaryKey(),
  activityType: text("activity_type").notNull(),
  customer: text("customer").notNull(),
  phone: text("phone"),
  employeeName: text("employee_name"),
  agentId: integer("agent_id"),
  source: text("source"),
  project: text("project"),
  propertyId: integer("property_id"),
  leadId: integer("lead_id"),
  activityDate: text("activity_date").notNull(),
  activityTime: text("activity_time"),
  lastRemark: text("last_remark"),
  status: text("status").notNull().default("pending"),
  budget: numeric("budget", { precision: 15, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
