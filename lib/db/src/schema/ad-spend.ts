import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const adSpendTable = pgTable("ad_spend", {
  id: serial("id").primaryKey(),
  channel: text("channel").notNull(),              // 99acres | facebook | google | housing | other
  month: integer("month").notNull(),               // 1-12
  year: integer("year").notNull(),
  spend: numeric("spend", { precision: 15, scale: 2 }).notNull().default("0"),
  leadsGenerated: integer("leads_generated").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAdSpendSchema = createInsertSchema(adSpendTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAdSpend = z.infer<typeof insertAdSpendSchema>;
export type AdSpend = typeof adSpendTable.$inferSelect;
