import { pgTable, text, uuid, timestamp, pgEnum, decimal, integer, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const attributionEventTypeEnum = pgEnum("attribution_event_type", [
  "FLOW_TRIGGERED", "MESSAGE_SENT", "LINK_CLICKED", "PURCHASE_ATTRIBUTED",
  "INTENT_CLASSIFIED", "AI_RESPONSE_SENT", "HUMAN_HANDOFF", "BIO_CLICK", "CAPI_FIRED"
]);

export const attributionEventsTable = pgTable("attribution_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  brandId: uuid("brand_id").notNull(),
  unifiedContactId: uuid("unified_contact_id"),
  flowId: uuid("flow_id"),
  nodeId: uuid("node_id"),
  eventType: attributionEventTypeEnum("event_type").notNull(),
  platform: text("platform"),
  revenueAttributed: decimal("revenue_attributed", { precision: 10, scale: 2 }).notNull().default("0"),
  identityToken: text("identity_token"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const shortLinksTable = pgTable("short_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  brandId: uuid("brand_id").notNull(),
  slug: text("slug").notNull().unique(),
  destinationUrl: text("destination_url").notNull(),
  identityToken: text("identity_token").notNull(),
  contactId: uuid("contact_id"),
  flowId: uuid("flow_id"),
  clickCount: integer("click_count").notNull().default(0),
  customDomain: text("custom_domain"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const dlqItemsTable = pgTable("dlq_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  brandId: uuid("brand_id").notNull(),
  platform: text("platform"),
  contactName: text("contact_name"),
  flowName: text("flow_name"),
  errorReason: text("error_reason").notNull(),
  payload: jsonb("payload").notNull().default({}),
  isReplayed: boolean("is_replayed").notNull().default(false),
  isDismissed: boolean("is_dismissed").notNull().default(false),
  replaysCount: integer("replays_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAttributionEventSchema = createInsertSchema(attributionEventsTable).omit({ id: true, createdAt: true });
export const insertShortLinkSchema = createInsertSchema(shortLinksTable).omit({ id: true, createdAt: true });
export type InsertAttributionEvent = z.infer<typeof insertAttributionEventSchema>;
export type InsertShortLink = z.infer<typeof insertShortLinkSchema>;
export type AttributionEvent = typeof attributionEventsTable.$inferSelect;
export type ShortLink = typeof shortLinksTable.$inferSelect;
export type DlqItem = typeof dlqItemsTable.$inferSelect;
