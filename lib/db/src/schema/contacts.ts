import { pgTable, text, uuid, timestamp, pgEnum, integer, decimal, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const loyaltyTierEnum = pgEnum("loyalty_tier", ["NEWBIE", "FAN", "ADVOCATE"]);

export const unifiedContactsTable = pgTable("unified_contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  brandId: uuid("brand_id").notNull(),
  displayName: text("display_name"),
  email: text("email"),
  phone: text("phone"),
  loyaltyScore: integer("loyalty_score").notNull().default(0),
  loyaltyTier: loyaltyTierEnum("loyalty_tier").notNull().default("NEWBIE"),
  tags: text("tags").array().notNull().default([]),
  customFields: jsonb("custom_fields").notNull().default({}),
  zeroPartySignals: jsonb("zero_party_signals").notNull().default({}),
  sentimentScore: decimal("sentiment_score", { precision: 4, scale: 3 }).notNull().default("0"),
  gdprDeletedAt: timestamp("gdpr_deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const platformProfilesTable = pgTable("platform_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  unifiedContactId: uuid("unified_contact_id").notNull(),
  tenantId: uuid("tenant_id").notNull(),
  brandId: uuid("brand_id").notNull(),
  platform: text("platform").notNull(),
  platformUserId: text("platform_user_id").notNull(),
  platformUsername: text("platform_username"),
  lastInteractionAt: timestamp("last_interaction_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertContactSchema = createInsertSchema(unifiedContactsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof unifiedContactsTable.$inferSelect;
export type PlatformProfile = typeof platformProfilesTable.$inferSelect;
