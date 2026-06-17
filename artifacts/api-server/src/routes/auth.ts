import { Router } from "express";
import { db } from "@workspace/db";
import { tenantsTable, usersTable, brandsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword, comparePassword, signToken, requireAuth } from "../lib/auth";
import { logger } from "../lib/logger";

const router = Router();

// POST /api/auth/signup
router.post("/auth/signup", async (req, res): Promise<void> => {
  const { email, password, name, tenantName } = req.body;
  if (!email || !password || !name || !tenantName) {
    res.status(400).json({ error: "email, password, name, and tenantName are required" });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = await hashPassword(password);

  const [tenant] = await db.insert(tenantsTable).values({ name: tenantName }).returning();
  const [user] = await db.insert(usersTable).values({
    tenantId: tenant.id,
    email: email.toLowerCase(),
    name,
    passwordHash,
    role: "OWNER",
  }).returning();

  // Create a default brand for the tenant
  await db.insert(brandsTable).values({
    tenantId: tenant.id,
    name: tenantName,
    timezone: "UTC",
  });

  const token = signToken({ userId: user.id, tenantId: tenant.id, email: user.email, role: user.role });

  req.log.info({ userId: user.id, tenantId: tenant.id }, "User signed up");
  res.status(201).json({
    data: {
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      tenant: { id: tenant.id, name: tenant.name, plan: tenant.plan },
    }
  });
});

// POST /api/auth/signin
router.post("/auth/signin", async (req, res): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, user.tenantId)).limit(1);

  const token = signToken({ userId: user.id, tenantId: user.tenantId, email: user.email, role: user.role });

  req.log.info({ userId: user.id }, "User signed in");
  res.json({
    data: {
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      tenant: { id: tenant.id, name: tenant.name, plan: tenant.plan },
    }
  });
});

// GET /api/auth/me
router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, user.tenantId)).limit(1);
  res.json({
    data: {
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      tenant: { id: tenant.id, name: tenant.name, plan: tenant.plan },
    }
  });
});

// POST /api/auth/signout
router.post("/auth/signout", requireAuth, (_req, res): void => {
  res.json({ data: { success: true } });
});

export default router;
