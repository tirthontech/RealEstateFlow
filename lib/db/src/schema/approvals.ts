import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const approvalsTable = pgTable("approvals", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),                    // unit_block | price_discount | payment_plan
  requestedBy: integer("requested_by"),            // userId
  requestedByName: text("requested_by_name").notNull(),
  entityId: integer("entity_id"),                  // unitId or dealId depending on type
  entityName: text("entity_name").notNull(),        // unit name or deal title
  details: text("details").notNull(),              // JSON string with additional context
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  reviewedBy: integer("reviewed_by"),
  reviewedByName: text("reviewed_by_name"),
  reviewNote: text("review_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertApprovalSchema = createInsertSchema(approvalsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertApproval = z.infer<typeof insertApprovalSchema>;
export type Approval = typeof approvalsTable.$inferSelect;
