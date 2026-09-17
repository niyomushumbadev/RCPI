import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { citizenApi } from '../../lib/api';
import type { ReportListItem } from '../../types';
import { StatusBadge, UrgencyBadge, formatDate } from '../../lib/format';
import { CategoryIcon } from '../../components/icons';
import { PageHeader, Spinner, ErrorBox, EmptyState, Pagination } from '../../components/ui';
import { t } from '../../translations';

export default function MyReports() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'ALL';
  const page = parseInt(params.get('page') ?? '1', 10);

  const [data, setData] = useState<{ reports: ReportListItem[]; pagination: { page: number; totalPages: number } } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    citizenApi
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

  const FILTERS = [
    { value: 'ALL', label: t('common.all') },
    { value: 'SUBMITTED', label: t('status.SUBMITTED') },
    { value: 'UNDER_REVIEW', label: t('status.UNDER_REVIEW') },
    { value: 'IN_PROGRESS', label: t('status.IN_PROGRESS') },
    { value: 'RESOLVED', label: t('status.RESOLVED') },
    { value: 'REJECTED', label: t('status.REJECTED') },
  ];

  return (
    <div>
      <PageHeader
        title={t('citizen.myReportsTitle')}
        subtitle={t('citizen.myReportsSubtitle')}
        actions={<Link to="/citizen/report/create" className="btn-primary">+ {t('citizen.newReport')}</Link>}
      />

      {/* Filter chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              status === f.value ? 'bg-rwanda-green text-white' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
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
        <EmptyState icon="fa-inbox" title={t('citizen.noReports')} hint={t('citizen.noReportsHint')} />
      )}

      {!loading && !error && data && data.reports.length > 0 && (
        <div className="card divide-y divide-slate-100">
          {data.reports.map((r) => (
            <Link key={r.id} to={`/reports/${r.id}`} className="flex items-center gap-4 p-4 hover:bg-slate-50">
              <span className="w-8 text-center text-2xl text-brand-primary"><CategoryIcon name={r.categoryName} dbIcon={r.categoryIcon} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-800">{r.title}</p>
                  <StatusBadge status={r.status} />
                  <UrgencyBadge urgency={r.urgency} />
                </div>
                <p className="mt-0.5 text-xs text-slate-400">
                  {r.reference} · {r.categoryName} · {r.districtName}{r.sectorName ? ` / ${r.sectorName}` : ''} · {t('common.submit')}: {formatDate(r.createdAt)}
                </p>
              </div>
              <span className="text-slate-300">›</span>
            </Link>
          ))}
        </div>
      )}

      {!loading && !error && data && (
        <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={(p) => update({ page: p })} />
      )}
    </div>
  );
}
