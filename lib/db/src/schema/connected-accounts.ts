import { pgTable, text, uuid, timestamp, pgEnum, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const platformEnum = pgEnum("platform_type", ["INSTAGRAM", "FACEBOOK", "TIKTOK"]);
export const tokenHealthEnum = pgEnum("token_health_status", ["HEALTHY", "EXPIRING", "BROKEN"]);
export const circuitStateEnum = pgEnum("circuit_state_type", ["CLOSED", "OPEN", "HALF_OPEN"]);

export const connectedAccountsTable = pgTable("connected_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  brandId: uuid("brand_id").notNull(),
  platform: platformEnum("platform").notNull(),
  platformAccountId: text("platform_account_id").notNull(),
  platformUsername: text("platform_username"),
  encryptedAccessToken: text("encrypted_access_token"),
  encryptedRefreshToken: text("encrypted_refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  lastRefreshAt: timestamp("last_refresh_at", { withTimezone: true }),
  healthStatus: tokenHealthEnum("health_status").notNull().default("HEALTHY"),
  grantedScopes: text("granted_scopes").array().notNull().default([]),
  lastWebhookAt: timestamp("last_webhook_at", { withTimezone: true }),
  circuitState: circuitStateEnum("circuit_state").notNull().default("CLOSED"),
  circuitTrippedAt: timestamp("circuit_tripped_at", { withTimezone: true }),
  failureCount: integer("failure_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertConnectedAccountSchema = createInsertSchema(connectedAccountsTable).omit({ id: true, createdAt: true });
export type InsertConnectedAccount = z.infer<typeof insertConnectedAccountSchema>;
export type ConnectedAccount = typeof connectedAccountsTable.$inferSelect;
