import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const commissionsTable = pgTable("commissions", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id"),
  agentId: integer("agent_id"),                   // agent or broker
  agentName: text("agent_name").notNull(),
  dealTitle: text("deal_title").notNull(),
  dealValue: numeric("deal_value", { precision: 15, scale: 2 }).notNull(),
  commissionRate: numeric("commission_rate", { precision: 5, scale: 2 }).notNull().default("2.00"), // percent
  commissionEarned: numeric("commission_earned", { precision: 15, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"), // pending | paid
  type: text("type").notNull().default("agent"),       // agent | broker
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCommissionSchema = createInsertSchema(commissionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCommission = z.infer<typeof insertCommissionSchema>;
export type Commission = typeof commissionsTable.$inferSelect;
