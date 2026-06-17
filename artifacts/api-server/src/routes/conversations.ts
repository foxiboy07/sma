import { Router } from "express";
import { db } from "@workspace/db";
import { conversationsTable, messagesTable } from "@workspace/db";
import { eq, and, desc, lt } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

// GET /api/brands/:id/conversations
router.get("/brands/:id/conversations", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { platform, status, limit: limitStr } = req.query as Record<string, string>;
  let query = db.select().from(conversationsTable).where(
    and(
      eq(conversationsTable.brandId, id),
      eq(conversationsTable.tenantId, req.user!.tenantId),
      platform ? eq(conversationsTable.platform, platform) : undefined,
      status ? eq(conversationsTable.status, status as any) : undefined,
    )
  );
  const conversations = await query.orderBy(desc(conversationsTable.lastMessageAt)).limit(Number(limitStr ?? 50));
  res.json({ data: conversations });
});

// GET /api/conversations/:id
router.get("/conversations/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [conversation] = await db.select().from(conversationsTable).where(
    and(eq(conversationsTable.id, id), eq(conversationsTable.tenantId, req.user!.tenantId))
  ).limit(1);
  if (!conversation) { res.status(404).json({ error: "Conversation not found" }); return; }

  const messages = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, id))
    .orderBy(desc(messagesTable.createdAt)).limit(50);
  res.json({ data: { ...conversation, messages: messages.reverse() } });
});

// PATCH /api/conversations/:id
router.patch("/conversations/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { status, assignedAgentId, priorityRed } = req.body;
  const [conv] = await db.update(conversationsTable).set({
    ...(status && { status }),
    ...(assignedAgentId !== undefined && { assignedAgentId }),
    ...(priorityRed !== undefined && { priorityRed }),
  }).where(and(eq(conversationsTable.id, id), eq(conversationsTable.tenantId, req.user!.tenantId))).returning();
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }
  res.json({ data: conv });
});

// POST /api/conversations/:id/messages
router.post("/conversations/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { content, messageType } = req.body;
  if (content == null) { res.status(400).json({ error: "content is required" }); return; }
  const [message] = await db.insert(messagesTable).values({
    conversationId: id,
    tenantId: req.user!.tenantId,
    direction: "OUTBOUND",
    content,
    messageType: messageType ?? "TEXT",
    deliveryStatus: "QUEUED",
    isAiGenerated: false,
    sentAt: new Date(),
  }).returning();
  // Update lastMessageAt
  await db.update(conversationsTable).set({ lastMessageAt: new Date() })
    .where(eq(conversationsTable.id, id));
  res.status(201).json({ data: message });
});

// POST /api/conversations/:id/ai-suggest
router.post("/conversations/:id/ai-suggest", requireAuth, async (_req, res): Promise<void> => {
  res.json({ data: { suggestion: "Thank you for reaching out! How can I help you today?" } });
});

export default router;
