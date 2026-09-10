// ─────────────────────────────────────────────────────────────
// R-CPI Task 3 — role middleware shim (ADDITIVE, spec §44)
// Canonical filename. Delegates to existing auth.ts — no behavior change.
// Spec expects: src/middleware/role.middleware.ts
// ─────────────────────────────────────────────────────────────
export { requireRole } from '../middleware/auth';
