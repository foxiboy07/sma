import { pgTable, text, uuid, timestamp, pgEnum, integer, decimal, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const flowStatusEnum = pgEnum("flow_status", ["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"]);
export const triggerTypeEnum = pgEnum("trigger_type", [
  "COMMENT_TO_DM", "STORY_MENTION", "STORY_REPLY", "FOLLOW_TO_DM",
  "SHARE_TO_DM", "TIKTOK_COMMENT_TO_DM", "TIKTOK_SHOP_COMMENT",
  "DEEPLINK_BIO_CLICK", "MANUAL"
]);
export const nodeTypeEnum = pgEnum("node_type", [
  "TRIGGER", "SEND_MESSAGE", "SEND_DM_CARD", "AI_STEP", "ACTION_BLOCK",
  "CUSTOM_CODE", "CONDITION", "SUPER_RANDOMIZER", "SMART_DELAY",
  "FRICTION_RECOVERY", "TIKTOK_SHOP_PRODUCT", "OUTBOUND_WEBHOOK"
]);

export const flowsTable = pgTable("flows", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  brandId: uuid("brand_id").notNull(),
  name: text("name").notNull(),
  status: flowStatusEnum("status").notNull().default("DRAFT"),
  triggerType: triggerTypeEnum("trigger_type").notNull().default("MANUAL"),
  triggerConfig: jsonb("trigger_config").notNull().default({}),
  ghostVariantId: uuid("ghost_variant_id"),
  ghostTrafficPct: integer("ghost_traffic_pct").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const flowNodesTable = pgTable("flow_nodes", {
  id: uuid("id").primaryKey().defaultRandom(),
  flowId: uuid("flow_id").notNull(),
  tenantId: uuid("tenant_id").notNull(),
  nodeType: nodeTypeEnum("node_type").notNull(),
  config: jsonb("config").notNull().default({}),
  positionX: decimal("position_x", { precision: 10, scale: 2 }).notNull().default("0"),
  positionY: decimal("position_y", { precision: 10, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const flowEdgesTable = pgTable("flow_edges", {
  id: uuid("id").primaryKey().defaultRandom(),
  flowId: uuid("flow_id").notNull(),
  tenantId: uuid("tenant_id").notNull(),
  sourceNodeId: uuid("source_node_id").notNull(),
  targetNodeId: uuid("target_node_id").notNull(),
  edgeLabel: text("edge_label"),
  conditionConfig: jsonb("condition_config").notNull().default({}),
});

export const insertFlowSchema = createInsertSchema(flowsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFlow = z.infer<typeof insertFlowSchema>;
export type Flow = typeof flowsTable.$inferSelect;
export type FlowNode = typeof flowNodesTable.$inferSelect;
export type FlowEdge = typeof flowEdgesTable.$inferSelect;
