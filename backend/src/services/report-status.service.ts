// ─────────────────────────────────────────────────────────────
// R-CPI Task 3 — status service with role-aware transitions (ADDITIVE)
// Spec §46: canTransition(oldStatus, newStatus, userRole)
// Existing services/report.service.ts is untouched; this adds the
// role-aware wrapper + canonical transition matrix from §23.
// ─────────────────────────────────────────────────────────────
import { canTransition as baseCanTransition } from './report.service';

const ROLE_PERMISSIONS: Record<string, string[]> = {
  CITIZEN: [],
  OFFICER: ['UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REOPENED'],
  DISTRICT_ADMIN: ['UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REOPENED'],
  NATIONAL_ADMIN: ['UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REOPENED'],
  SYSTEM_ADMIN: ['UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REOPENED'],
  ANALYST: [],
};

/** Backend-enforced transition check. Never trust frontend state (§58). */
export function canTransition(oldStatus: string, newStatus: string, userRole?: string): boolean {
  if (!baseCanTransition(oldStatus, newStatus)) return false;
  if (!userRole) return true; // matrix-only check
  const allowed = ROLE_PERMISSIONS[userRole] ?? [];
  // SUBMITTED creation is handled by createReport, not transitions.
  return allowed.includes(newStatus);
}
