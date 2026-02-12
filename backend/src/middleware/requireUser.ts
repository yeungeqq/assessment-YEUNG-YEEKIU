import type { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../index.js';

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
  const auth = req.header('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : null;

  if (!token) return res.status(401).json({ error: 'Missing Authorization Bearer token' });

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: 'Invalid token' });

    req.userId = data.user.id;
    req.userEmail = data.user.email || undefined;
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'Auth check failed' });
  }
}
