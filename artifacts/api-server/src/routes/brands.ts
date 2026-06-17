import { Router } from "express";
import { db } from "@workspace/db";
import { brandsTable, connectedAccountsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

// GET /api/brands
router.get("/brands", requireAuth, async (req, res): Promise<void> => {
  const brands = await db.select().from(brandsTable).where(eq(brandsTable.tenantId, req.user!.tenantId));
  res.json({ data: brands });
});

// GET /api/brands/:id
router.get("/brands/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [brand] = await db.select().from(brandsTable).where(
    and(eq(brandsTable.id, id), eq(brandsTable.tenantId, req.user!.tenantId))
  ).limit(1);
  if (!brand) { res.status(404).json({ error: "Brand not found" }); return; }
  res.json({ data: brand });
});

// POST /api/brands
router.post("/brands", requireAuth, async (req, res): Promise<void> => {
  const { name, timezone, logoUrl } = req.body;
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  const [brand] = await db.insert(brandsTable).values({
    tenantId: req.user!.tenantId,
    name,
    timezone: timezone ?? "UTC",
    logoUrl,
  }).returning();
  res.status(201).json({ data: brand });
});

// PATCH /api/brands/:id
router.patch("/brands/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { name, timezone, logoUrl, personaName, personaTone, personaLanguage } = req.body;
  const [brand] = await db.update(brandsTable).set({
    ...(name && { name }),
    ...(timezone && { timezone }),
    ...(logoUrl !== undefined && { logoUrl }),
    ...(personaName && { personaName }),
    ...(personaTone && { personaTone }),
    ...(personaLanguage && { personaLanguage }),
  }).where(and(eq(brandsTable.id, id), eq(brandsTable.tenantId, req.user!.tenantId))).returning();
  if (!brand) { res.status(404).json({ error: "Brand not found" }); return; }
  res.json({ data: brand });
});

// GET /api/brands/:id/connected-accounts
router.get("/brands/:id/connected-accounts", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const accounts = await db.select().from(connectedAccountsTable).where(
    and(eq(connectedAccountsTable.brandId, id), eq(connectedAccountsTable.tenantId, req.user!.tenantId))
  );
  // Strip encrypted tokens from response
  const safe = accounts.map(a => ({ ...a, encryptedAccessToken: undefined, encryptedRefreshToken: undefined }));
  res.json({ data: safe });
});

// GET /api/brands/:id/dashboard
router.get("/brands/:id/dashboard", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { conversationsTable, messagesTable, unifiedContactsTable, flowsTable } = await import("@workspace/db");
  const [totalContacts] = await db.select({ count: db.$count(unifiedContactsTable) }).from(unifiedContactsTable)
    .where(and(eq(unifiedContactsTable.brandId, id), eq(unifiedContactsTable.tenantId, req.user!.tenantId)));
  const [totalConversations] = await db.select({ count: db.$count(conversationsTable) }).from(conversationsTable)
    .where(and(eq(conversationsTable.brandId, id), eq(conversationsTable.tenantId, req.user!.tenantId)));
  const [totalFlows] = await db.select({ count: db.$count(flowsTable) }).from(flowsTable)
    .where(and(eq(flowsTable.brandId, id), eq(flowsTable.tenantId, req.user!.tenantId)));
  res.json({
    data: {
      totalContacts: Number(totalContacts?.count ?? 0),
      totalConversations: Number(totalConversations?.count ?? 0),
      totalFlows: Number(totalFlows?.count ?? 0),
      revenueAttributed: 0,
      aiCreditsSaved: 0,
      activeFlows: 0,
    }
  });
});

// GET /api/brands/:id/health
router.get("/brands/:id/health", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const accounts = await db.select().from(connectedAccountsTable).where(
    and(eq(connectedAccountsTable.brandId, id), eq(connectedAccountsTable.tenantId, req.user!.tenantId))
  );
  const safe = accounts.map(a => ({ ...a, encryptedAccessToken: undefined, encryptedRefreshToken: undefined }));
  res.json({ data: safe });
});

// GET /api/brands/:id/analytics/overview
router.get("/brands/:id/analytics/overview", requireAuth, async (_req, res): Promise<void> => {
  res.json({
    data: {
      totalDmsSent: 0, totalFlowsTriggered: 0, totalRevenue: 0,
      aiCost: 0, cacheHitRate: 0, conversionRate: 0,
      dailySeries: [], platformBreakdown: [],
    }
  });
});

// GET /api/brands/:id/analytics/flows
router.get("/brands/:id/analytics/flows", requireAuth, async (_req, res): Promise<void> => {
  res.json({ data: { flows: [] } });
});

// GET /api/brands/:id/analytics/ai
router.get("/brands/:id/analytics/ai", requireAuth, async (_req, res): Promise<void> => {
  res.json({ data: { totalTokens: 0, totalCost: 0, cacheHitRate: 0, tier1Pct: 0, tier2Pct: 0 } });
});

// GET /api/brands/:id/analytics/attribution
router.get("/brands/:id/analytics/attribution", requireAuth, async (_req, res): Promise<void> => {
  res.json({ data: { totalRevenue: 0, attributedSales: 0, funnel: [] } });
});

// GET /api/brands/:id/analytics/ghost-ab
router.get("/brands/:id/analytics/ghost-ab", requireAuth, async (_req, res): Promise<void> => {
  res.json({ data: { variants: [] } });
});

// GET /api/brands/:id/short-links
router.get("/brands/:id/short-links", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { shortLinksTable } = await import("@workspace/db");
  const links = await db.select().from(shortLinksTable).where(
    and(eq(shortLinksTable.brandId, id), eq(shortLinksTable.tenantId, req.user!.tenantId))
  );
  res.json({ data: links });
});

// POST /api/brands/:id/short-links
router.post("/brands/:id/short-links", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { destinationUrl, contactId, flowId, customSlug } = req.body;
  if (!destinationUrl) { res.status(400).json({ error: "destinationUrl is required" }); return; }
  const { shortLinksTable } = await import("@workspace/db");
  const { nanoid } = await import("nanoid");
  const slug = customSlug ?? nanoid(8);
  const identityToken = nanoid(16);
  const [link] = await db.insert(shortLinksTable).values({
    tenantId: req.user!.tenantId, brandId: id,
    slug, destinationUrl, identityToken,
    contactId, flowId,
  }).returning();
  res.status(201).json({ data: link });
});

// GET /api/brands/:id/dlq
router.get("/brands/:id/dlq", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { dlqItemsTable } = await import("@workspace/db");
  const items = await db.select().from(dlqItemsTable).where(
    and(eq(dlqItemsTable.brandId, id), eq(dlqItemsTable.tenantId, req.user!.tenantId))
  );
  res.json({ data: items });
});

// GET /api/brands/:id/knowledge-base
router.get("/brands/:id/knowledge-base", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { kbDocumentsTable } = await import("@workspace/db");
  const docs = await db.select().from(kbDocumentsTable).where(
    and(eq(kbDocumentsTable.brandId, id), eq(kbDocumentsTable.tenantId, req.user!.tenantId))
  );
  res.json({ data: docs });
});

export default router;
