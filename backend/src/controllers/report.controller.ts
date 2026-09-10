// ─────────────────────────────────────────────────────────────
// R-CPI Task 3 — canonical controller filename (ADDITIVE, spec §44)
// Spec expects: src/controllers/report.controller.ts
// Existing file is controllers/reportController.ts (untouched).
// This shim only re-exports it, so both import paths work.
// ─────────────────────────────────────────────────────────────
export * from './reportController';
