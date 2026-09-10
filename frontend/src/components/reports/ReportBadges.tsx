export { StatusBadge, statusLabel, statusClass } from '../../lib/format';
export { UrgencyBadge } from '../../lib/format';

/** Priority badge — priority is aliased to urgency until the DB migration lands. */
export function ReportPriorityBadge({ priority }: { priority: string }) {
  const p = (priority ?? 'MEDIUM').toUpperCase();
  const cls = p === 'HIGH' ? 'bg-red-100 text-red-700' : p === 'LOW' ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-700';
  return <span className={`badge ${cls}`}>{p.charAt(0) + p.slice(1).toLowerCase()} priority</span>;
}

/** Text-first status badge for accessibility (§71: never color alone). */
export function ReportStatusBadge({ status }: { status: string }) {
  return (
    <span className="badge bg-slate-100 text-slate-700" role="status" aria-label={`Status: ${status.replace(/_/g, ' ')}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
