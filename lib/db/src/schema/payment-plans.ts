import { pgTable, text, serial, timestamp, integer, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const paymentPlansTable = pgTable("payment_plans", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id"),
  leadId: integer("lead_id"),
  propertyId: integer("property_id"),
  clientName: text("client_name").notNull(),
  totalAmount: numeric("total_amount", { precision: 15, scale: 2 }).notNull(),
  downPayment: numeric("down_payment", { precision: 15, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const paymentInstallmentsTable = pgTable("payment_installments", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull(),
  label: text("label").notNull(),
  dueDate: text("due_date"),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPaymentPlanSchema = createInsertSchema(paymentPlansTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPaymentInstallmentSchema = createInsertSchema(paymentInstallmentsTable).omit({ id: true, createdAt: true });
export type InsertPaymentPlan = z.infer<typeof insertPaymentPlanSchema>;
export type PaymentPlan = typeof paymentPlansTable.$inferSelect;
export type PaymentInstallment = typeof paymentInstallmentsTable.$inferSelect;
