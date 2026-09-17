import { useEffect, useState } from 'react';
import { adminApi } from '../../lib/api';
import type { AuditLog } from '../../types';
import { PageHeader, Spinner, ErrorBox, EmptyState, Pagination } from '../../components/ui';
import { formatDateTime } from '../../lib/format';
import { t } from '../../translations';

const RESOURCE_TYPES = ['USER', 'REPORT', 'CATEGORY', 'DEPARTMENT', 'ALERT'];

export default function AdminAuditLogs() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [resourceType, setResourceType] = useState('');

  const [data, setData] = useState<{ logs: AuditLog[]; pagination: { page: number; totalPages: number; total: number } } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    adminApi
      .auditLogs(page, action || undefined, resourceType || undefined)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : t('common.error')))
      .finally(() => setLoading(false));
  }, [page, action, resourceType]);

  return (
    <div className="space-y-6">
      <div className="gov-card p-6">
        <PageHeader title={t('admin.auditLogsTitle')} subtitle={data ? `${data.pagination.total} ${t('common.results')}` : t('admin.auditLogsSubtitle')} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          className="input w-64"
          placeholder={t('common.searchPlaceholder')}
          value={action}
          onChange={(e) => {
            setPage(1);
            setAction(e.target.value);
          }}
        />
        <select
          className="input w-48"
          value={resourceType}
          onChange={(e) => {
            setPage(1);
            setResourceType(e.target.value);
          }}
        >
          <option value="">{t('common.all')}</option>
          {RESOURCE_TYPES.map((rt) => (
            <option key={rt} value={rt}>{rt}</option>
          ))}
        </select>
      </div>

      {error && <ErrorBox message={error} />}
      {loading && <Spinner />}

      {!loading && !error && data && data.logs.length === 0 && (
        <EmptyState icon="fa-box-archive" title={t('common.none')} hint={t('admin.auditLogsSubtitle')} />
      )}

      {!loading && !error && data && data.logs.length > 0 && (
        <div className="gov-card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                <th className="px-4 py-3">{t('admin.auditTime')}</th>
                <th className="px-4 py-3">{t('admin.auditActor')}</th>
                <th className="px-4 py-3">{t('admin.auditAction')}</th>
                <th className="px-4 py-3">{t('admin.auditResource')}</th>
                <th className="px-4 py-3">IP</th>
                <th className="px-4 py-3">{t('common.details')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">{formatDateTime(log.createdAt)}</td>
                  <td className="px-4 py-3 text-slate-700">{log.actorName ?? 'System'}</td>
                  <td className="px-4 py-3"><span className="badge bg-slate-100 font-mono text-xs text-slate-700">{log.action}</span></td>
                  <td className="px-4 py-3 text-slate-500">{log.resourceType}{log.resourceId ? ` #${log.resourceId}` : ''}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{log.ipAddress ?? '—'}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-xs text-slate-400">{log.detail ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && data && (
        <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={setPage} />
      )}
    </div>
  );
}
