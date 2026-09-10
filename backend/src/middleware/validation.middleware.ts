// ─────────────────────────────────────────────────────────────
// R-CPI Task 3 — validation middleware (ADDITIVE, spec §44)
// Validates req.body with a zod schema. Existing code untouched.
// Spec expects: src/middleware/validation.middleware.ts
// ─────────────────────────────────────────────────────────────
import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return res.status(422).json({
        success: false,
        message: first ? `${first.path.join('.')}: ${first.message}` : 'Validation failed',
        code: 'VALIDATION_ERROR',
      });
    }
    req.body = parsed.data;
    next();
  };
}
