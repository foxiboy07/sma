import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

// GET /api/tenants/:tenantId/users
router.get("/tenants/:tenantId/users", requireAuth, async (req, res): Promise<void> => {
  const tenantId = Array.isArray(req.params.tenantId) ? req.params.tenantId[0] : req.params.tenantId;
  if (req.user!.tenantId !== tenantId) { res.status(403).json({ error: "Forbidden" }); return; }
  const users = await db.select({
    id: usersTable.id, email: usersTable.email, name: usersTable.name,
    role: usersTable.role, createdAt: usersTable.createdAt,
  }).from(usersTable).where(eq(usersTable.tenantId, tenantId));
  res.json({ data: users });
});

// POST /api/tenants/:tenantId/invites
router.post("/tenants/:tenantId/invites", requireAuth, async (req, res): Promise<void> => {
  const tenantId = Array.isArray(req.params.tenantId) ? req.params.tenantId[0] : req.params.tenantId;
  if (req.user!.tenantId !== tenantId) { res.status(403).json({ error: "Forbidden" }); return; }
  const { email, role } = req.body;
  if (!email || !role) { res.status(400).json({ error: "email and role required" }); return; }
  res.status(201).json({ data: { invited: true, email, role } });
});

// DELETE /api/tenants/:tenantId/users/:userId
router.delete("/tenants/:tenantId/users/:userId", requireAuth, async (req, res): Promise<void> => {
  const tenantId = Array.isArray(req.params.tenantId) ? req.params.tenantId[0] : req.params.tenantId;
  if (req.user!.tenantId !== tenantId) { res.status(403).json({ error: "Forbidden" }); return; }
  res.sendStatus(204);
});

// GET /api/tenants/:tenantId/billing
router.get("/tenants/:tenantId/billing", requireAuth, async (req, res): Promise<void> => {
  const tenantId = Array.isArray(req.params.tenantId) ? req.params.tenantId[0] : req.params.tenantId;
  if (req.user!.tenantId !== tenantId) { res.status(403).json({ error: "Forbidden" }); return; }
  res.json({ data: { plan: "FREE", nextBillingDate: null, seats: 1, maxSeats: 1 } });
});

// GET /api/tenants/:tenantId/api-keys
router.get("/tenants/:tenantId/api-keys", requireAuth, async (req, res): Promise<void> => {
  const tenantId = Array.isArray(req.params.tenantId) ? req.params.tenantId[0] : req.params.tenantId;
  if (req.user!.tenantId !== tenantId) { res.status(403).json({ error: "Forbidden" }); return; }
  res.json({ data: [] });
});

// POST /api/tenants/:tenantId/api-keys
router.post("/tenants/:tenantId/api-keys", requireAuth, async (req, res): Promise<void> => {
  const tenantId = Array.isArray(req.params.tenantId) ? req.params.tenantId[0] : req.params.tenantId;
  if (req.user!.tenantId !== tenantId) { res.status(403).json({ error: "Forbidden" }); return; }
  const { name, scopes } = req.body;
  const { nanoid } = await import("nanoid");
  const key = `fp_${nanoid(32)}`;
  res.status(201).json({ data: { id: nanoid(8), name, key, scopes: scopes ?? [], createdAt: new Date() } });
});

// DELETE /api/tenants/:tenantId/api-keys/:keyId
router.delete("/tenants/:tenantId/api-keys/:keyId", requireAuth, async (req, res): Promise<void> => {
  const tenantId = Array.isArray(req.params.tenantId) ? req.params.tenantId[0] : req.params.tenantId;
  if (req.user!.tenantId !== tenantId) { res.status(403).json({ error: "Forbidden" }); return; }
  res.sendStatus(204);
});

// GET /api/connected-accounts/:id/force-refresh
router.post("/connected-accounts/:id/force-refresh", requireAuth, async (_req, res): Promise<void> => {
  res.json({ data: { success: true } });
});

// POST /api/connected-accounts/:id/re-authenticate
router.post("/connected-accounts/:id/re-authenticate", requireAuth, async (_req, res): Promise<void> => {
  res.json({ data: { authUrl: null } });
});

// DELETE /api/connected-accounts/:id
router.delete("/connected-accounts/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { connectedAccountsTable, brandsTable } = await import("@workspace/db");
  const [account] = await db.select({ brandId: connectedAccountsTable.brandId })
    .from(connectedAccountsTable).where(eq(connectedAccountsTable.id, id)).limit(1);
  if (!account) { res.status(404).json({ error: "Not found" }); return; }
  const [brand] = await db.select({ tenantId: brandsTable.tenantId })
    .from(brandsTable).where(eq(brandsTable.id, account.brandId)).limit(1);
  if (!brand || brand.tenantId !== req.user!.tenantId) { res.status(403).json({ error: "Forbidden" }); return; }
  await db.delete(connectedAccountsTable).where(eq(connectedAccountsTable.id, id));
  res.sendStatus(204);
});

// DLQ routes
router.post("/dlq/:id/replay", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { dlqItemsTable } = await import("@workspace/db");
  const [item] = await db.select({ tenantId: dlqItemsTable.tenantId })
    .from(dlqItemsTable).where(eq(dlqItemsTable.id, id)).limit(1);
  if (!item || item.tenantId !== req.user!.tenantId) { res.status(403).json({ error: "Forbidden" }); return; }
  await db.update(dlqItemsTable).set({ isReplayed: true }).where(eq(dlqItemsTable.id, id));
  res.json({ data: { success: true } });
});

router.post("/dlq/:id/dismiss", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { dlqItemsTable } = await import("@workspace/db");
  const [item] = await db.select({ tenantId: dlqItemsTable.tenantId })
    .from(dlqItemsTable).where(eq(dlqItemsTable.id, id)).limit(1);
  if (!item || item.tenantId !== req.user!.tenantId) { res.status(403).json({ error: "Forbidden" }); return; }
  await db.update(dlqItemsTable).set({ isDismissed: true }).where(eq(dlqItemsTable.id, id));
  res.json({ data: { success: true } });
});

router.post("/brands/:id/dlq/batch-replay", requireAuth, async (_req, res): Promise<void> => {
  res.json({ data: { replayed: 0 } });
});

// KB routes
router.get("/knowledge-base/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { kbDocumentsTable, brandsTable } = await import("@workspace/db");
  const [doc] = await db.select().from(kbDocumentsTable).where(eq(kbDocumentsTable.id, id)).limit(1);
  if (!doc) { res.status(404).json({ error: "Not found" }); return; }
  const [brand] = await db.select({ tenantId: brandsTable.tenantId })
    .from(brandsTable).where(eq(brandsTable.id, doc.brandId)).limit(1);
  if (!brand || brand.tenantId !== req.user!.tenantId) { res.status(403).json({ error: "Forbidden" }); return; }
  res.json({ data: doc });
});

router.delete("/knowledge-base/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { kbDocumentsTable, brandsTable } = await import("@workspace/db");
  const [doc] = await db.select({ brandId: kbDocumentsTable.brandId })
    .from(kbDocumentsTable).where(eq(kbDocumentsTable.id, id)).limit(1);
  if (!doc) { res.status(404).json({ error: "Not found" }); return; }
  const [brand] = await db.select({ tenantId: brandsTable.tenantId })
    .from(brandsTable).where(eq(brandsTable.id, doc.brandId)).limit(1);
  if (!brand || brand.tenantId !== req.user!.tenantId) { res.status(403).json({ error: "Forbidden" }); return; }
  await db.delete(kbDocumentsTable).where(eq(kbDocumentsTable.id, id));
  res.sendStatus(204);
});

// Broadcasts
router.get("/brands/:id/broadcasts", requireAuth, async (_req, res): Promise<void> => {
  res.json({ data: [] });
});

router.post("/brands/:id/broadcasts", requireAuth, async (_req, res): Promise<void> => {
  res.status(201).json({ data: { id: "broadcast-placeholder", status: "DRAFT" } });
});

router.delete("/broadcasts/:id", requireAuth, async (_req, res): Promise<void> => {
  res.sendStatus(204);
});

router.post("/broadcasts/:id/estimate-reach", requireAuth, async (_req, res): Promise<void> => {
  res.json({ data: { estimatedReach: 0 } });
});

export default router;
