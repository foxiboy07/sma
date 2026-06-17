import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Request, Response, NextFunction } from "express";

if (!process.env.JWT_SECRET && process.env.NODE_ENV === "production") {
  console.error("FATAL: JWT_SECRET environment variable is required in production");
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET ?? "flowpulse-dev-secret-change-in-prod";
const JWT_EXPIRES_IN = "7d";

export interface JwtPayload {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireTenantAccess(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    const tenantId = req.params.tenantId ?? req.params.brandTenantId;
    if (tenantId && req.user?.tenantId !== tenantId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  });
}
