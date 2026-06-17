import { pgTable, text, uuid, timestamp, pgEnum, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const kbSourceTypeEnum = pgEnum("kb_source_type", ["PDF", "URL", "TEXT", "QA"]);
export const kbIndexStatusEnum = pgEnum("kb_index_status", ["PENDING", "INDEXED", "FAILED"]);
export const kbStrictnessEnum = pgEnum("kb_strictness", ["STRICT", "BALANCED", "CREATIVE"]);

export const kbDocumentsTable = pgTable("kb_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  brandId: uuid("brand_id").notNull(),
  name: text("name").notNull(),
  sourceType: kbSourceTypeEnum("source_type").notNull(),
  sourceUrl: text("source_url"),
  content: text("content"),
  indexStatus: kbIndexStatusEnum("index_status").notNull().default("PENDING"),
  chunkCount: integer("chunk_count").notNull().default(0),
  strictness: kbStrictnessEnum("strictness").notNull().default("BALANCED"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertKbDocumentSchema = createInsertSchema(kbDocumentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertKbDocument = z.infer<typeof insertKbDocumentSchema>;
export type KbDocument = typeof kbDocumentsTable.$inferSelect;
