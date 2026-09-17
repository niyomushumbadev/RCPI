import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { workflowApi } from '../../lib/api';
import type { WorkflowReport } from '../../types';
import { StatusBadge, formatDate, timeAgo } from '../../lib/format';
import { PageHeader, Spinner, ErrorBox, EmptyState, Pagination } from '../../components/ui';
import { CategoryIcon } from '../../components/icons';
import { t } from '../../translations';

export default function WorkflowReports() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'ALL';
  const page = parseInt(params.get('page') ?? '1', 10);

  const [data, setData] = useState<{ reports: WorkflowReport[]; pagination: { page: number; totalPages: number; total: number } } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    workflowApi
      .reports(status, page)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : t('common.error')))
      .finally(() => setLoading(false));
  }, [status, page]);

  function update(next: { status?: string; page?: number }) {
    const nextParams = new URLSearchParams(params);
    if (next.status !== undefined) {
      nextParams.set('status', next.status);
      nextParams.delete('page');
    }
    if (next.page !== undefined) nextParams.set('page', String(next.page));
    setParams(nextParams);
  }

  return (
    <div>
      <PageHeader title={t('workflow.queueTitle')} subtitle={data ? `${data.pagination.total} ${t('common.results')}` : t('workflow.queueSubtitle')} />

      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { value: 'ALL', label: t('common.all') },
          { value: 'SUBMITTED', label: t('status.SUBMITTED') },
          { value: 'RECEIVED', label: t('status.RECEIVED') },
          { value: 'UNDER_REVIEW', label: t('status.UNDER_REVIEW') },
          { value: 'VERIFIED', label: t('status.VERIFIED') },
          { value: 'ASSIGNED', label: t('status.ASSIGNED') },
          { value: 'IN_PROGRESS', label: t('status.IN_PROGRESS') },
          { value: 'ESCALATED', label: t('status.ESCALATED') },
          { value: 'RESOLVED', label: t('status.RESOLVED') },
          { value: 'REOPEN_REQUESTED', label: t('status.REOPEN_REQUESTED') },
        ].map((f) => (
          <button
            key={f.value}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              status === f.value ? 'border-rwanda-blue bg-rwanda-blue text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
            onClick={() => update({ status: f.value })}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <ErrorBox message={error} />}
      {loading && <Spinner />}

      {!loading && !error && data && data.reports.length === 0 && (
        <EmptyState icon="fa-inbox" title={t('common.none')} hint={t('workflow.queueSubtitle')} />
      )}

      {!loading && !error && data && data.reports.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3">{t('workflow.reportDetail')}</th>
                <th className="px-4 py-3">{t('role.CITIZEN')}</th>
                <th className="px-4 py-3">{t('workflow.location')}</th>
                <th className="px-4 py-3">{t('admin.status')}</th>
                <th className="px-4 py-3">{t('common.date')}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.reports.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-800"><CategoryIcon name={r.categoryName} dbIcon={r.categoryIcon} /> {r.title}</p>
                    <p className="text-xs text-slate-400">{r.reference} · {r.categoryName}</p>
                  </td>
                  <td className="px-4 py-3">
                    {r.citizen.email ? (
                      <>
                        <p className="font-medium text-slate-700">{r.citizen.firstName} {r.citizen.lastName}</p>
                        <p className="text-xs text-slate-400">{r.citizen.email}</p>
                      </>
                    ) : (
                      <span className="badge bg-slate-100 text-slate-500"><i className="fa-solid fa-user-secret" aria-hidden="true" /> {t('workflow.anonymousCitizen')}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.district}{r.sector ? ` / ${r.sector}` : ''}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-xs text-slate-400" title={formatDate(r.createdAt)}>{timeAgo(r.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/workflow/${r.id}`} className="btn-outline !px-3 !py-1 text-xs">{t('common.view')}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && data && (
        <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={(p) => update({ page: p })} />
      )}
    </div>
  );
}
