import type { Request, Response, NextFunction } from 'express';
import { getUserFromToken } from "../repositories/authRepository.js";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
    }
  }
}

/**
 * Verifies Supabase JWT from Authorization: Bearer <token>
 * Attaches req.userId and req.userEmail.
 */
export async function requireUser(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.get("authorization") ?? "";
  const [scheme, rawToken] = authHeader.trim().split(/\s+/);
  const token = scheme?.toLowerCase() === "bearer" ? rawToken?.trim() : null;

  if (!token) return res.status(401).json({ error: 'Missing Authorization Bearer token' });

  try {
    const { user, error } = await getUserFromToken(token);
    if (error || !user) {
      console.warn("AUTH INVALID TOKEN:", error?.message ?? "No user found");
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.userId = user.id;
    req.userEmail = user.email || undefined;
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'Auth check failed' });
  }
}
