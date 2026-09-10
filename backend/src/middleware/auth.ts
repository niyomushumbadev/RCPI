import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';

export interface JwtPayload {
  sub: number;
  role: string;
  firstName: string;
  lastName: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpiresIn,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, env.jwt.accessSecret) as unknown as JwtPayload;
  } catch {
    return null;
  }
}

/** Require a valid access token. Blocks the request otherwise. */
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  const payload = token ? verifyAccessToken(token) : null;
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  req.user = payload;
  next();
}

/** Require any of the given roles (Task 10 — RBAC §10) */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to perform this action' });
    }
    next();
  };
}

export type AuthenticatedRequest = Request & { user: JwtPayload };
