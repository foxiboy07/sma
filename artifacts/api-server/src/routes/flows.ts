import { Router } from "express";
import { db } from "@workspace/db";
import { flowsTable, flowNodesTable, flowEdgesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

// GET /api/brands/:id/flows
router.get("/brands/:id/flows", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const flows = await db.select().from(flowsTable).where(
    and(eq(flowsTable.brandId, id), eq(flowsTable.tenantId, req.user!.tenantId))
  );
  res.json({ data: flows });
});

// POST /api/brands/:id/flows
router.post("/brands/:id/flows", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { name, triggerType, templateId } = req.body;
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  const [flow] = await db.insert(flowsTable).values({
    tenantId: req.user!.tenantId,
    brandId: id,
    name,
    triggerType: triggerType ?? "MANUAL",
    status: "DRAFT",
  }).returning();
  res.status(201).json({ data: flow });
});

// GET /api/flows/:id
router.get("/flows/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [flow] = await db.select().from(flowsTable).where(
    and(eq(flowsTable.id, id), eq(flowsTable.tenantId, req.user!.tenantId))
  ).limit(1);
  if (!flow) { res.status(404).json({ error: "Flow not found" }); return; }
  const nodes = await db.select().from(flowNodesTable).where(eq(flowNodesTable.flowId, id));
  const edges = await db.select().from(flowEdgesTable).where(eq(flowEdgesTable.flowId, id));
  res.json({ data: { ...flow, nodes, edges } });
});

// PATCH /api/flows/:id
router.patch("/flows/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { name, status, triggerType, triggerConfig } = req.body;
  const [flow] = await db.update(flowsTable).set({
    ...(name && { name }),
    ...(status && { status }),
    ...(triggerType && { triggerType }),
    ...(triggerConfig && { triggerConfig }),
  }).where(and(eq(flowsTable.id, id), eq(flowsTable.tenantId, req.user!.tenantId))).returning();
  if (!flow) { res.status(404).json({ error: "Flow not found" }); return; }
  res.json({ data: flow });
});

// PUT /api/flows/:id/nodes
router.put("/flows/:id/nodes", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { nodes, edges } = req.body;
  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    res.status(400).json({ error: "nodes and edges arrays required" }); return;
  }
  // Delete existing and replace
  await db.delete(flowNodesTable).where(eq(flowNodesTable.flowId, id));
  await db.delete(flowEdgesTable).where(eq(flowEdgesTable.flowId, id));
  if (nodes.length > 0) {
    await db.insert(flowNodesTable).values(nodes.map((n: any) => ({
      id: n.id,
      flowId: id,
      tenantId: req.user!.tenantId,
      nodeType: n.type ?? n.nodeType ?? "SEND_MESSAGE",
      config: n.data ?? n.config ?? {},
      positionX: String(n.position?.x ?? n.positionX ?? 0),
      positionY: String(n.position?.y ?? n.positionY ?? 0),
    })));
  }
  if (edges.length > 0) {
    await db.insert(flowEdgesTable).values(edges.map((e: any) => ({
      id: e.id,
      flowId: id,
      tenantId: req.user!.tenantId,
      sourceNodeId: e.source ?? e.sourceNodeId,
      targetNodeId: e.target ?? e.targetNodeId,
      edgeLabel: e.label ?? e.edgeLabel,
      conditionConfig: e.data ?? e.conditionConfig ?? {},
    })));
  }
  res.json({ data: { success: true } });
});

// POST /api/flows/:id/publish
router.post("/flows/:id/publish", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [flow] = await db.update(flowsTable).set({ status: "ACTIVE" })
    .where(and(eq(flowsTable.id, id), eq(flowsTable.tenantId, req.user!.tenantId))).returning();
  if (!flow) { res.status(404).json({ error: "Flow not found" }); return; }
  res.json({ data: flow });
});

// POST /api/flows/:id/pause
router.post("/flows/:id/pause", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [flow] = await db.update(flowsTable).set({ status: "PAUSED" })
    .where(and(eq(flowsTable.id, id), eq(flowsTable.tenantId, req.user!.tenantId))).returning();
  if (!flow) { res.status(404).json({ error: "Flow not found" }); return; }
  res.json({ data: flow });
});

// POST /api/flows/:id/duplicate
router.post("/flows/:id/duplicate", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [original] = await db.select().from(flowsTable)
    .where(and(eq(flowsTable.id, id), eq(flowsTable.tenantId, req.user!.tenantId))).limit(1);
  if (!original) { res.status(404).json({ error: "Flow not found" }); return; }
  const [copy] = await db.insert(flowsTable).values({
    tenantId: original.tenantId,
    brandId: original.brandId,
    name: `${original.name} (Copy)`,
    status: "DRAFT",
    triggerType: original.triggerType,
    triggerConfig: original.triggerConfig as Record<string, unknown>,
  }).returning();
  res.status(201).json({ data: copy });
});

// DELETE /api/flows/:id
router.delete("/flows/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [flow] = await db.update(flowsTable).set({ status: "ARCHIVED" })
    .where(and(eq(flowsTable.id, id), eq(flowsTable.tenantId, req.user!.tenantId))).returning();
  if (!flow) { res.status(404).json({ error: "Flow not found" }); return; }
  res.sendStatus(204);
});

// POST /api/flows/:id/validate
router.post("/flows/:id/validate", requireAuth, async (req, res): Promise<void> => {
  res.json({ data: { valid: true, errors: [] } });
});

export default router;
