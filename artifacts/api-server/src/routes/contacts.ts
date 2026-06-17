import { Router } from "express";
import { db } from "@workspace/db";
import { unifiedContactsTable } from "@workspace/db";
import { eq, and, ilike } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

// GET /api/brands/:id/contacts
router.get("/brands/:id/contacts", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const contacts = await db.select().from(unifiedContactsTable).where(
    and(
      eq(unifiedContactsTable.brandId, id),
      eq(unifiedContactsTable.tenantId, req.user!.tenantId)
    )
  );
  res.json({ data: contacts });
});

// GET /api/contacts/:id
router.get("/contacts/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [contact] = await db.select().from(unifiedContactsTable).where(
    and(eq(unifiedContactsTable.id, id), eq(unifiedContactsTable.tenantId, req.user!.tenantId))
  ).limit(1);
  if (!contact) { res.status(404).json({ error: "Contact not found" }); return; }
  res.json({ data: contact });
});

// PATCH /api/contacts/:id
router.patch("/contacts/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { displayName, email, phone, customFields } = req.body;
  const [contact] = await db.update(unifiedContactsTable).set({
    ...(displayName !== undefined && { displayName }),
    ...(email !== undefined && { email }),
    ...(phone !== undefined && { phone }),
    ...(customFields !== undefined && { customFields }),
  }).where(
    and(eq(unifiedContactsTable.id, id), eq(unifiedContactsTable.tenantId, req.user!.tenantId))
  ).returning();
  if (!contact) { res.status(404).json({ error: "Contact not found" }); return; }
  res.json({ data: contact });
});

// POST /api/contacts/:id/tags
router.post("/contacts/:id/tags", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { tags } = req.body;
  const [existing] = await db.select().from(unifiedContactsTable)
    .where(and(eq(unifiedContactsTable.id, id), eq(unifiedContactsTable.tenantId, req.user!.tenantId))).limit(1);
  if (!existing) { res.status(404).json({ error: "Contact not found" }); return; }
  const merged = Array.from(new Set([...(existing.tags ?? []), ...(tags ?? [])]));
  const [contact] = await db.update(unifiedContactsTable).set({ tags: merged })
    .where(eq(unifiedContactsTable.id, id)).returning();
  res.json({ data: contact });
});

// DELETE /api/contacts/:id/tags
router.delete("/contacts/:id/tags", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { tags } = req.body;
  const [existing] = await db.select().from(unifiedContactsTable)
    .where(and(eq(unifiedContactsTable.id, id), eq(unifiedContactsTable.tenantId, req.user!.tenantId))).limit(1);
  if (!existing) { res.status(404).json({ error: "Contact not found" }); return; }
  const filtered = (existing.tags ?? []).filter((t: string) => !(tags ?? []).includes(t));
  const [contact] = await db.update(unifiedContactsTable).set({ tags: filtered })
    .where(eq(unifiedContactsTable.id, id)).returning();
  res.json({ data: contact });
});

// POST /api/contacts/merge
router.post("/contacts/merge", requireAuth, async (req, res): Promise<void> => {
  res.json({ data: { success: true } });
});

// GET /api/brands/:id/identity-matches
router.get("/brands/:id/identity-matches", requireAuth, async (_req, res): Promise<void> => {
  res.json({ data: [] });
});

// POST /api/identity-matches/:id/dismiss
router.post("/identity-matches/:id/dismiss", requireAuth, async (_req, res): Promise<void> => {
  res.json({ data: { success: true } });
});

// POST /api/identity-matches/:id/merge
router.post("/identity-matches/:id/merge", requireAuth, async (_req, res): Promise<void> => {
  res.json({ data: { success: true } });
});

// GET /api/contacts/:id/export
router.get("/contacts/:id/export", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [contact] = await db.select().from(unifiedContactsTable)
    .where(and(eq(unifiedContactsTable.id, id), eq(unifiedContactsTable.tenantId, req.user!.tenantId))).limit(1);
  if (!contact) { res.status(404).json({ error: "Contact not found" }); return; }
  res.json({ data: { contact, exportedAt: new Date().toISOString() } });
});

// DELETE /api/contacts/:id/data
router.delete("/contacts/:id/data", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await db.update(unifiedContactsTable).set({
    displayName: null,
    email: null,
    phone: null,
    customFields: {},
    gdprDeletedAt: new Date(),
  }).where(and(eq(unifiedContactsTable.id, id), eq(unifiedContactsTable.tenantId, req.user!.tenantId)));
  res.json({ data: { success: true } });
});

export default router;
