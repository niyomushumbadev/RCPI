import { prisma } from '../config/db';

// Master spec §6 — 16 canonical states.
export const REPORT_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'AI_ANALYSIS',
  'PENDING_VERIFICATION',
  'VERIFIED',
  'REJECTED',
  'ASSIGNED',
  'IN_PROGRESS',
  'WAITING_CITIZEN',
  'WAITING_DEPARTMENT',
  'ESCALATED',
  'RESOLVED',
  'PENDING_CLOSURE',
  'CLOSED',
  'REOPENED',
  'ARCHIVED',
  // Legacy aliases kept for backward compatibility with seeded/older rows.
  'RECEIVED',
  'UNDER_REVIEW',
  'REOPEN_REQUESTED',
] as const;

export type ReportStatus = (typeof REPORT_STATUSES)[number];

// Legacy → canonical mapping (never breaks old data).
export const LEGACY_STATUS_ALIAS: Record<string, string> = {
  RECEIVED: 'PENDING_VERIFICATION',
  UNDER_REVIEW: 'PENDING_VERIFICATION',
  REOPEN_REQUESTED: 'REOPENED',
};

export function canonicalStatus(status: string): string {
  return LEGACY_STATUS_ALIAS[status] ?? status;
}

export const STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['SUBMITTED', 'ARCHIVED'],
  SUBMITTED: ['AI_ANALYSIS', 'PENDING_VERIFICATION', 'REJECTED'],
  AI_ANALYSIS: ['PENDING_VERIFICATION', 'REJECTED'],
  PENDING_VERIFICATION: ['VERIFIED', 'REJECTED', 'WAITING_CITIZEN'],
  VERIFIED: ['ASSIGNED', 'WAITING_DEPARTMENT', 'ESCALATED'],
  REJECTED: ['ARCHIVED'],
  ASSIGNED: ['IN_PROGRESS', 'WAITING_DEPARTMENT', 'ESCALATED'],
  IN_PROGRESS: ['WAITING_CITIZEN', 'WAITING_DEPARTMENT', 'ESCALATED', 'RESOLVED'],
  WAITING_CITIZEN: ['IN_PROGRESS', 'PENDING_VERIFICATION', 'ESCALATED'],
  WAITING_DEPARTMENT: ['IN_PROGRESS', 'ESCALATED'],
  ESCALATED: ['IN_PROGRESS', 'ASSIGNED', 'RESOLVED'],
  RESOLVED: ['PENDING_CLOSURE', 'CLOSED', 'REOPENED'], // CLOSED only by supervisor roles (role gate in workflow controller)
  PENDING_CLOSURE: ['CLOSED', 'REOPENED'],
  CLOSED: ['REOPENED', 'ARCHIVED'],
  REOPENED: ['PENDING_VERIFICATION', 'IN_PROGRESS', 'ASSIGNED'],
  ARCHIVED: [],
  // Legacy sources
  RECEIVED: ['PENDING_VERIFICATION', 'VERIFIED', 'REJECTED'],
  UNDER_REVIEW: ['VERIFIED', 'REJECTED', 'WAITING_CITIZEN'],
  REOPEN_REQUESTED: ['REOPENED', 'IN_PROGRESS'],
};

export function canTransition(fromStatus: string, toStatus: string): boolean {
  const from = canonicalStatus(fromStatus);
  const to = canonicalStatus(toStatus);
  if (from === to) return false;
  const allowed = STATUS_TRANSITIONS[fromStatus] ?? STATUS_TRANSITIONS[from] ?? [];
  return allowed.includes(toStatus) || allowed.includes(to);
}

export async function getNextReferenceNumber() {
  const last = await prisma.report.findFirst({
    orderBy: { id: 'desc' },
    select: { id: true },
  });
  const nextId = (last?.id ?? 0) + 1;
  const year = new Date().getFullYear();
  return `RCP-${year}-${String(nextId).padStart(6, '0')}`;
}

export async function createStatusHistoryEntry(reportId: number, fromStatus: string | null, toStatus: string, note: string | null, actorId?: number, actorName?: string) {
  return prisma.reportStatusHistory.create({
    data: {
      reportId,
      fromStatus,
      toStatus,
      note: note ?? null,
      actorId: actorId ?? null,
      actorName: actorName ?? null,
    },
  });
}

export function escapeStatusText(status: string) {
  return status.replace(/_/g, ' ');
}
