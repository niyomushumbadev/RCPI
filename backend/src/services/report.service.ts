import { prisma } from '../config/db';

export const REPORT_STATUSES = [
  'SUBMITTED',
  'RECEIVED',
  'UNDER_REVIEW',
  'VERIFIED',
  'REJECTED',
  'ASSIGNED',
  'IN_PROGRESS',
  'ESCALATED',
  'RESOLVED',
  'CLOSED',
  'REOPEN_REQUESTED',
  'REOPENED',
] as const;

export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const STATUS_TRANSITIONS: Record<string, string[]> = {
  SUBMITTED: ['RECEIVED', 'UNDER_REVIEW'],
  RECEIVED: ['UNDER_REVIEW', 'VERIFIED', 'REJECTED'],
  UNDER_REVIEW: ['VERIFIED', 'REJECTED'],
  VERIFIED: ['ASSIGNED'],
  REJECTED: [],
  ASSIGNED: ['IN_PROGRESS', 'ESCALATED'],
  IN_PROGRESS: ['RESOLVED', 'ESCALATED'],
  ESCALATED: ['IN_PROGRESS', 'RESOLVED'],
  RESOLVED: ['CLOSED'],
  CLOSED: ['REOPEN_REQUESTED'],
  REOPEN_REQUESTED: ['REOPENED', 'IN_PROGRESS'],
  REOPENED: ['IN_PROGRESS', 'RESOLVED'],
};

export function canTransition(fromStatus: string, toStatus: string): boolean {
  const allowed = STATUS_TRANSITIONS[fromStatus] ?? [];
  return allowed.includes(toStatus);
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
