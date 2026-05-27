import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const viewingsTable = pgTable("viewings", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id"),
  propertyId: integer("property_id"),
  agentId: integer("agent_id"),
  date: text("date").notNull(),
  time: text("time").notNull().default("10:00"),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  budgetConfirmed: boolean("budget_confirmed").notNull().default(false),
  timelineConfirmed: boolean("timeline_confirmed").notNull().default(false),
  requirementsDiscussed: boolean("requirements_discussed").notNull().default(false),
  followUpScheduled: boolean("follow_up_scheduled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertViewingSchema = createInsertSchema(viewingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertViewing = z.infer<typeof insertViewingSchema>;
export type Viewing = typeof viewingsTable.$inferSelect;
