import { pgTable, text, uuid, timestamp, pgEnum, boolean, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const conversationStatusEnum = pgEnum("conversation_status", ["BOT", "HUMAN", "CLOSED"]);
export const messageDirectionEnum = pgEnum("message_direction", ["INBOUND", "OUTBOUND"]);
export const messageTypeEnum = pgEnum("message_type", ["TEXT", "DM_CARD", "PRODUCT_CARD", "SYSTEM"]);
export const deliveryStatusEnum = pgEnum("delivery_status", ["QUEUED", "SENT", "DELIVERED", "FAILED"]);
export const aiTierEnum = pgEnum("ai_tier", ["TIER_1", "TIER_2"]);

export const conversationsTable = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  brandId: uuid("brand_id").notNull(),
  unifiedContactId: uuid("unified_contact_id").notNull(),
  platform: text("platform").notNull(),
  platformConversationId: text("platform_conversation_id"),
  status: conversationStatusEnum("status").notNull().default("BOT"),
  assignedAgentId: uuid("assigned_agent_id"),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
  sentimentScore: decimal("sentiment_score", { precision: 4, scale: 3 }).notNull().default("0"),
  priorityRed: boolean("priority_red").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const messagesTable = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull(),
  tenantId: uuid("tenant_id").notNull(),
  direction: messageDirectionEnum("direction").notNull(),
  content: text("content"),
  messageType: messageTypeEnum("message_type").notNull().default("TEXT"),
  platformMessageId: text("platform_message_id"),
  deliveryStatus: deliveryStatusEnum("delivery_status").notNull().default("QUEUED"),
  isAiGenerated: boolean("is_ai_generated").notNull().default(false),
  aiTierUsed: aiTierEnum("ai_tier_used"),
  aiTokenCost: text("ai_token_cost").notNull().default("0"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertConversationSchema = createInsertSchema(conversationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMessageSchema = createInsertSchema(messagesTable).omit({ id: true, createdAt: true });
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Conversation = typeof conversationsTable.$inferSelect;
export type Message = typeof messagesTable.$inferSelect;
