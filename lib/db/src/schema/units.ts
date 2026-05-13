import { pgTable, text, serial, timestamp, integer, numeric, boolean } from "drizzle-orm/pg-core";

export const unitsTable = pgTable("units", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull(),
  unitNo: text("unit_no").notNull(),               // e.g. "A-504", "T2-1203"
  bhkType: text("bhk_type").notNull(),             // 1BHK | 2BHK | 3BHK | 4BHK | Studio | Penthouse | Commercial
  floor: integer("floor"),
  facing: text("facing"),                          // North | South | East | West | Garden | Pool | Corner
  carpetArea: numeric("carpet_area"),              // sqft
  saleableArea: numeric("saleable_area"),          // sqft (carpet + walls + common)
  bsp: numeric("bsp"),                             // Base Selling Price per sqft (₹)
  plcCharges: numeric("plc_charges").default("0"), // Preferential Location Charges (flat amount)
  parkingCharges: numeric("parking_charges").default("500000"), // ₹5L default
  status: text("status").notNull().default("available"), // available | blocked | booked | sold
  blockedByLeadId: integer("blocked_by_lead_id"), // which lead has it blocked
  bookedAt: timestamp("booked_at", { withTimezone: true }),
  isPremium: boolean("is_premium").notNull().default(false), // premium unit flag
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Unit = typeof unitsTable.$inferSelect;
export type InsertUnit = typeof unitsTable.$inferInsert;
