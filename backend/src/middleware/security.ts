import rateLimit from 'express-rate-limit';
import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

/** General API rate limiter (Task 10 §33) */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.rateLimit.apiMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please slow down and try again later.' },
});

/** 404 for unknown API routes */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ success: false, message: 'Endpoint not found' });
}

/** Central error handler — never leaks stack traces or internals (Task 10 §86) */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  // Log details server-side only
  console.error('[error]', err);

  const anyErr = err as { status?: number; message?: string; code?: string } | null;

  if (anyErr?.code === 'P2002') {
    return res.status(409).json({ success: false, message: 'This record already exists' });
  }
  if (anyErr?.code === 'P2025') {
    return res.status(404).json({ success: false, message: 'Record not found' });
  }

  const status = typeof anyErr?.status === 'number' ? anyErr.status : 500;
  const message = status < 500 && anyErr?.message ? anyErr.message : 'Something went wrong. Please try again.';
  res.status(status).json({ success: false, message });
}
