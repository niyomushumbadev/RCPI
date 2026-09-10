import { Link } from 'react-router-dom';
import { StatusBadge, UrgencyBadge, formatDate } from '../../lib/format';
import type { ReportListItem } from '../../types';

export function ReportTable({ reports, basePath }: { reports: ReportListItem[]; basePath: string }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
            <th className="px-4 py-3">Reference</th>
            <th className="px-4 py-3">Title</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Priority</th>
            <th className="px-4 py-3">Submitted</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {reports.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.reference}</td>
              <td className="px-4 py-3 font-medium text-slate-800">{r.title}</td>
              <td className="px-4 py-3 text-slate-600">{r.categoryName}</td>
              <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
              <td className="px-4 py-3"><UrgencyBadge urgency={r.urgency} /></td>
              <td className="px-4 py-3 text-xs text-slate-400">{formatDate(r.createdAt)}</td>
              <td className="px-4 py-3 text-right">
                <Link to={`${basePath}/${r.id}`} className="btn-outline !px-3 !py-1 text-xs">Open</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
