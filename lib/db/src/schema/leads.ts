import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const leadsTable = pgTable("leads", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().default(""),
  phone: text("phone"),
  source: text("source").notNull().default("other"),
  status: text("status").notNull().default("new"),
  score: integer("score").notNull().default(50),
  budget: numeric("budget", { precision: 15, scale: 2 }),
  propertyType: text("property_type"),
  notes: text("notes"),
  assignedTo: integer("assigned_to"),
  createdBy: integer("created_by"),  // user id of whoever added this lead
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertLeadSchema = createInsertSchema(leadsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leadsTable.$inferSelect;
