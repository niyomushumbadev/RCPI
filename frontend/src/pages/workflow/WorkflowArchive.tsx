import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { workflowApi } from '../../lib/api';
import { StatusBadge, formatDateTime } from '../../lib/format';
import { PageHeader, Spinner, ErrorBox, EmptyState, Pagination } from '../../components/ui';
import { t } from '../../translations';

interface ArchivedReport {
  id: number;
  reference: string;
  title: string;
  status: string;
  categoryName: string;
  categoryIcon: string | null;
  district: string;
  department: string | null;
  citizenName: string;
  confirmedByName: string | null;
  confirmedAt: string | null;
  archivedAt: string | null;
  closedAt: string | null;
  resolvedAt: string | null;
  resolutionDescription: string | null;
  createdAt: string;
}

/**
 * Closed archive — every citizen-confirmed report, permanently recorded for
 * audit, accountability and analytics (spec §14). Archived reports never
 * appear in active queues; this is where they live on.
 */
export default function WorkflowArchive() {
  const [data, setData] = useState<{ reports: ArchivedReport[]; pagination: { page: number; totalPages: number; total: number } } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    workflowApi
      .archive(q || undefined, page)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : t('common.error')))
      .finally(() => setLoading(false));
  }, [q, page]);

  return (
    <div>
      <PageHeader
        title={t('workflow.archiveTitle')}
        subtitle={
          data
            ? `${data.pagination.total} ${t('workflow.archiveSubtitle')}`
            : t('workflow.archiveSubtitle')
        }
      />

      <input
        className="input mb-4 max-w-md"
        placeholder={t('common.searchPlaceholder')}
        value={q}
        onChange={(e) => {
          setPage(1);
          setQ(e.target.value);
        }}
      />

      {error && <ErrorBox message={error} />}
      {loading && <Spinner />}

      {!loading && !error && data && data.reports.length === 0 && (
        <EmptyState icon="fa-box-archive" title={t('workflow.noArchived')} hint={t('workflow.archiveSubtitle')} />
      )}

      {!loading && !error && data && data.reports.length > 0 && (
        <div className="space-y-3">
          {data.reports.map((r) => (
            <div key={r.id} className="gov-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{r.reference}</span>
                    <StatusBadge status={r.status} />
                    <span className="badge bg-slate-100 text-slate-600">{r.categoryIcon ? `${r.categoryIcon} ` : ''}{r.categoryName}</span>
                    <span className="badge bg-emerald-50 text-emerald-700">
                      <i className="fa-solid fa-box-archive" aria-hidden="true" /> {t('workflow.archived')}
                    </span>
                  </div>
                  <h2 className="mt-1 text-lg font-bold text-slate-900">{r.title}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {r.district}{r.department ? ` · ${r.department}` : ''} · Reported by {r.citizenName}
                  </p>
                  {r.resolutionDescription && (
                    <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                      <strong className="text-slate-700">{t('workflow.resolution')}:</strong> {r.resolutionDescription}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-slate-400">
                    Resolved {r.resolvedAt ? formatDateTime(r.resolvedAt) : '—'} · Confirmed by {r.confirmedByName ?? 'citizen'}{' '}
                    {r.confirmedAt ? formatDateTime(r.confirmedAt) : ''} · Archived {r.archivedAt ? formatDateTime(r.archivedAt) : '—'}
                  </p>
                </div>
                <Link to={`/workflow/reports/${r.id}`} className="btn-outline shrink-0 text-sm">
                  {t('workflow.reportDetail')} →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && data && <div className="mt-4"><Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={setPage} /></div>}
    </div>
  );
}
