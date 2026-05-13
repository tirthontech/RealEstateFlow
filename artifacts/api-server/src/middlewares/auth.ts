import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export const JWT_SECRET = process.env.JWT_SECRET ?? "ef_jwt_secret_key_2024_change_in_prod";

export interface JwtPayload {
  id: number;
  username: string;
  name: string;
  role: string;
  isAdmin: boolean;
  agentId: number | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET) as JwtPayload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function adminMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!req.user?.isAdmin) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

export function ownerMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== "owner") {
    res.status(403).json({ error: "Owner access required" });
    return;
  }
  next();
}
