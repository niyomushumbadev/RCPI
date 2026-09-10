// ─────────────────────────────────────────────────────────────
// R-CPI Task 3 — Canonical reference generator (ADDITIVE)
// Spec §11: RCP-YYYY-XXXXXX, immutable after creation.
// This file is additive only; existing helpers.ts is untouched.
// ─────────────────────────────────────────────────────────────
import { prisma } from '../config/db';

/** Generate next immutable reference: RCP-YYYY-XXXXXX */
export async function generateTask3Reference(): Promise<string> {
  const last = await prisma.report.findFirst({
    orderBy: { id: 'desc' },
    select: { id: true },
  });
  const nextId = (last?.id ?? 0) + 1;
  const year = new Date().getFullYear();
  return `RCP-${year}-${String(nextId).padStart(6, '0')}`;
}

/** Pure formatter (no DB) used by repository when id is known. */
export function formatTask3Reference(id: number, year?: number): string {
  const y = year ?? new Date().getFullYear();
  return `RCP-${y}-${String(id).padStart(6, '0')}`;
}
