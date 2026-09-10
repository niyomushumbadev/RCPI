import type { ReportStatus, Urgency } from '../types';

/** Human-friendly label for a report status */
export function statusLabel(status: string): string {
  return status
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

const STATUS_STYLES: Record<string, string> = {
  SUBMITTED: 'bg-slate-100 text-slate-700',
  RECEIVED: 'bg-sky-100 text-sky-800',
  UNDER_REVIEW: 'bg-amber-100 text-amber-800',
  VERIFIED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-red-100 text-red-800',
  ASSIGNED: 'bg-indigo-100 text-indigo-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  ESCALATED: 'bg-orange-100 text-orange-800',
  RESOLVED: 'bg-green-100 text-green-800',
  CLOSED: 'bg-slate-200 text-slate-700',
  REOPEN_REQUESTED: 'bg-yellow-100 text-yellow-800',
  REOPENED: 'bg-fuchsia-100 text-fuchsia-800',
};

export function statusClass(status: string): string {
  return STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-700';
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${statusClass(status)}`}>{statusLabel(status)}</span>;
}

export function UrgencyBadge({ urgency }: { urgency: string }) {
  const cls =
    urgency === 'HIGH' ? 'bg-red-100 text-red-700' : urgency === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600';
  const icon = urgency === 'HIGH' ? '🔴' : urgency === 'MEDIUM' ? '🟡' : '🟢';
  return (
    <span className={`badge ${cls}`}>
      {icon} {urgency.charAt(0) + urgency.slice(1).toLowerCase()}
    </span>
  );
}

export function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} day${d > 1 ? 's' : ''} ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const URGENCY_OPTIONS: Array<{ value: Urgency; label: string }> = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
];

export type { ReportStatus, Urgency };
