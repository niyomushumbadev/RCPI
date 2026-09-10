// ─────────────────────────────────────────────────────────────
// R-CPI Task 3 — auth middleware shim (ADDITIVE, spec §44)
// Canonical filename. Delegates to existing auth.ts — no behavior change.
// Spec expects: src/middleware/auth.middleware.ts
// ─────────────────────────────────────────────────────────────
export { authenticate, requireRole, signAccessToken, verifyAccessToken } from '../middleware/auth';
export type { JwtPayload, AuthenticatedRequest } from '../middleware/auth';
