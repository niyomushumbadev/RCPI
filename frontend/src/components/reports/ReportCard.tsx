import { Link } from 'react-router-dom';
import { StatusBadge, UrgencyBadge, formatDate } from '../../lib/format';
import type { ReportListItem } from '../../types';

export function ReportCard({ report, to }: { report: ReportListItem; to: string }) {
  return (
    <Link to={to} className="flex items-center gap-4 p-4 hover:bg-slate-50">
      <span className="text-2xl">{report.categoryIcon ?? '📌'}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-slate-800">{report.title}</p>
          <StatusBadge status={report.status} />
          <UrgencyBadge urgency={report.urgency} />
        </div>
        <p className="mt-0.5 text-xs text-slate-400">
          {report.reference} · {report.categoryName} · {report.districtName}
          {report.sectorName ? ` / ${report.sectorName}` : ''} · {formatDate(report.createdAt)}
        </p>
      </div>
      <span className="text-slate-300">›</span>
    </Link>
  );
}
