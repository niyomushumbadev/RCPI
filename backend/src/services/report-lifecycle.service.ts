// ─────────────────────────────────────────────────────────────
// R-CPI resolution workflow — pure lifecycle helpers (spec §8, §11)
// No database access here: everything is unit-testable.
// ─────────────────────────────────────────────────────────────

/**
 * The spec's RESOLVED_PENDING_CONFIRMATION maps onto the canonical RESOLVED
 * state of this codebase: an administrator marks work complete → status
 * RESOLVED = "resolution awaiting citizen confirmation". The legacy alias
 * is accepted everywhere statuses are parsed.
 */
export const STATUS_ALIAS: Record<string, string> = {
  RESOLVED_PENDING_CONFIRMATION: 'RESOLVED',
};

export function canonical(status: string): string {
  return STATUS_ALIAS[status] ?? status;
}

/** Assignment priority values accepted from the assigning officer (spec §4). */
export const ASSIGNMENT_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

/** Report statuses that block a citizen from confirming/rejecting a resolution. */
export function citizenCannotConfirm(status: string): boolean {
  return !['RESOLVED', 'CLOSED'].includes(canonical(status));
}

/** A resolved/closed report may be reopened by its citizen (spec §7 option B). */
export function canReopen(status: string): boolean {
  return ['RESOLVED', 'CLOSED', 'PENDING_CLOSURE'].includes(canonical(status));
}

/**
 * Notification routing for lifecycle events (spec §6, §7, §13).
 * 'officer' = assigned administrator/officer; 'citizen' = report owner;
 * 'staff'   = reviewing officer(s) in the report district.
 */
export function notificationRecipients(input: {
  report: { citizenId: number; assignedOfficerId: number | null; districtId: number | null };
  event: 'ASSIGNED' | 'ACCEPTED' | 'STARTED' | 'RESOLVED' | 'CONFIRMED' | 'REJECTED' | 'REOPENED';
}): Array<'citizen' | 'officer' | 'staff'> {
  const { report, event } = input;
  switch (event) {
    case 'ASSIGNED':
      return report.assignedOfficerId ? ['officer', 'citizen'] : ['citizen'];
    case 'ACCEPTED':
    case 'STARTED':
      return ['citizen'];
    case 'RESOLVED':
      return ['citizen'];
    case 'CONFIRMED':
      return report.assignedOfficerId ? ['officer'] : [];
    case 'REJECTED':
    case 'REOPENED':
      return ['officer', 'staff'];
    default:
      return [];
  }
}
