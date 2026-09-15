// ─────────────────────────────────────────────────────────────
// R-CPI Task 3 — status service with role-aware transitions (ADDITIVE)
// Canonical 16-state matrix (master spec §6) + hierarchy roles (§3).
// CITIZEN/ANALYST/EXECUTIVE get no staff mutation targets.
// Legacy aliases accepted via canonicalStatus().
// ─────────────────────────────────────────────────────────────
import { canTransition as baseCanTransition, canonicalStatus } from './report.service';

const ROLE_PERMISSIONS: Record<string, string[]> = {
  CITIZEN: [],
  CELL_OFFICER: ['PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_CITIZEN', 'WAITING_DEPARTMENT', 'ESCALATED', 'RESOLVED'],
  SECTOR_OFFICER: ['PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_CITIZEN', 'WAITING_DEPARTMENT', 'ESCALATED', 'RESOLVED', 'PENDING_CLOSURE'],
  OFFICER: ['PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_CITIZEN', 'WAITING_DEPARTMENT', 'ESCALATED', 'RESOLVED', 'PENDING_CLOSURE'],
  DISTRICT_ADMIN: ['PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_CITIZEN', 'WAITING_DEPARTMENT', 'ESCALATED', 'RESOLVED', 'PENDING_CLOSURE', 'CLOSED', 'REOPENED', 'ARCHIVED'],
  PROVINCE_ADMIN: ['ESCALATED', 'IN_PROGRESS', 'RESOLVED', 'PENDING_CLOSURE', 'CLOSED', 'REOPENED'],
  CITY_ADMIN: ['ESCALATED', 'IN_PROGRESS', 'RESOLVED', 'PENDING_CLOSURE', 'CLOSED', 'REOPENED'],
  NATIONAL_ADMIN: ['VERIFIED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_DEPARTMENT', 'ESCALATED', 'RESOLVED', 'PENDING_CLOSURE', 'CLOSED', 'REOPENED', 'ARCHIVED'],
  EXECUTIVE: [],
  SYSTEM_ADMIN: ['PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_CITIZEN', 'WAITING_DEPARTMENT', 'ESCALATED', 'RESOLVED', 'PENDING_CLOSURE', 'CLOSED', 'REOPENED', 'ARCHIVED'],
  ANALYST: [],
};

/** Exact role permission matrix for UI + docs (master spec §3). */
export const ROLE_STATUS_MATRIX: Record<string, string[]> = ROLE_PERMISSIONS;

/** Backend-enforced transition check. Never trust frontend state (§58). */
export function canTransition(oldStatus: string, newStatus: string, userRole?: string): boolean {
  if (!baseCanTransition(oldStatus, newStatus)) return false;
  if (!userRole) return true; // matrix-only check
  const target = canonicalStatus(newStatus);
  const allowed = ROLE_PERMISSIONS[userRole] ?? [];
  // SUBMITTED creation is handled by createReport, not transitions.
  return allowed.includes(newStatus) || allowed.includes(target);
}

/**
 * Targets a given staff role may actually move a report to from `current`.
 * Combines the lifecycle matrix (§23) with the role matrix (§46). Used by the
 * workflow API to give the UI only transitions the caller can truly perform.
 */
export function allowedTargetsForRole(current: string, userRole: string): string[] {
  const targets = new Set<string>();
  const matrix = STATUS_TRANSITIONS_LOCAL[current] ?? STATUS_TRANSITIONS_LOCAL[canonicalStatus(current)] ?? [];
  const roleAllowed = ROLE_PERMISSIONS[userRole] ?? [];
  for (const target of matrix) {
    if (roleAllowed.includes(target)) targets.add(target);
  }
  return [...targets];
}

// Local re-import to avoid a circular import with report.service (which the
// base canTransition above already re-exports safely).
import { STATUS_TRANSITIONS as STATUS_TRANSITIONS_LOCAL } from './report.service';
