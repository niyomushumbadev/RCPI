// ─────────────────────────────────────────────────────────────
// R-CPI Task 3 — Canonical report types (ADDITIVE, read-only gap fill)
// This file does NOT modify existing code. It provides the naming
// required by spec §44: src/types/report.types.ts
// ─────────────────────────────────────────────────────────────

export const REPORT_STATUSES = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'VERIFIED',
  'REJECTED',
  'ASSIGNED',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
  'REOPENED',
] as const;

export type ReportStatus = (typeof REPORT_STATUSES)[number];

/** Controlled transition matrix — spec §23 (backend-enforced). */
export const REPORT_TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  SUBMITTED: ['UNDER_REVIEW'],
  UNDER_REVIEW: ['VERIFIED', 'REJECTED'],
  VERIFIED: ['ASSIGNED'],
  REJECTED: [],
  ASSIGNED: ['IN_PROGRESS'],
  IN_PROGRESS: ['RESOLVED'],
  RESOLVED: ['CLOSED'],
  CLOSED: ['REOPENED'],
  REOPENED: ['IN_PROGRESS'],
};

export function canTransitionTask3(from: string, to: string): boolean {
  const allowed = (REPORT_TRANSITIONS as Record<string, string[]>)[from] ?? [];
  return allowed.includes(to);
}

export type EvidenceType =
  | 'CITIZEN_EVIDENCE'
  | 'VERIFICATION_EVIDENCE'
  | 'INVESTIGATION_EVIDENCE'
  | 'RESOLUTION_EVIDENCE'
  | 'ADMINISTRATIVE_EVIDENCE';

export interface CreateReportInput {
  title: string;
  description: string;
  categoryId: number;
  provinceId: number;
  districtId: number;
  sectorId?: number | null;
  cellId?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  locationDescription?: string | null;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  urgency?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface ReportFilterParams extends PaginationParams {
  status?: string;
  categoryId?: number;
  districtId?: number;
  sectorId?: number;
  cellId?: number;
  priority?: string;
  urgency?: string;
  assignedOfficerId?: number;
  search?: string;
  from?: string;
  to?: string;
  sort?: 'newest' | 'oldest' | 'priority' | 'deadline' | 'updated' | 'overdue';
}
