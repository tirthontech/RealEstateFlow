import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const projectFinancialsTable = pgTable("project_financials", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull(),
  projectName: text("project_name").notNull(),
  totalInvested: numeric("total_invested", { precision: 15, scale: 2 }).notNull().default("0"),
  totalCollected: numeric("total_collected", { precision: 15, scale: 2 }).notNull().default("0"),
  totalOutstanding: numeric("total_outstanding", { precision: 15, scale: 2 }).notNull().default("0"),
  expectedRevenue: numeric("expected_revenue", { precision: 15, scale: 2 }).notNull().default("0"),
  margin: numeric("margin", { precision: 7, scale: 2 }).notNull().default("0"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProjectFinancialSchema = createInsertSchema(projectFinancialsTable).omit({ id: true, updatedAt: true });
export type InsertProjectFinancial = z.infer<typeof insertProjectFinancialSchema>;
export type ProjectFinancial = typeof projectFinancialsTable.$inferSelect;
