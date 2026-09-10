import { useEffect, useState } from 'react';
import { citizenApi } from '../../lib/api';
import type { ReportListItem } from '../../types';
import { PageHeader, Spinner, ErrorBox, EmptyState, Pagination } from '../../components/ui';
import { ReportCard } from '../../components/reports/ReportCard';
import { ReportFilters, ReportSearch } from '../../components/reports/ReportFilters';

// Task 3 §47 — canonical path: pages/reports/ReportListPage.tsx
// Additive: existing MyReports.tsx untouched.
export default function ReportListPage() {
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    citizenApi
      .reports(status, page)
      .then((r) => { setReports(r.reports); setTotalPages(r.pagination.totalPages); })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [status, page]);

  const visible = reports.filter((r) =>
    search.trim() ? `${r.reference} ${r.title}`.toLowerCase().includes(search.toLowerCase()) : true,
  );

  return (
    <div>
      <PageHeader title="Reports" subtitle="All reports in your scope." />
      <div className="mb-3"><ReportSearch value={search} onChange={(v) => { setSearch(v); setPage(1); }} /></div>
      <ReportFilters filters={{ status }} onChange={(s) => { setStatus(s); setPage(1); }} />
      {error && <ErrorBox message={error} />}
      {loading && <Spinner />}
      {!loading && !error && visible.length === 0 && <EmptyState icon="📭" title="No reports" hint="Try another filter or search." />}
      {!loading && !error && visible.length > 0 && (
        <div className="card divide-y divide-slate-100">
          {visible.map((r) => <ReportCard key={r.id} report={r} to={`/reports/${r.id}`} />)}
        </div>
      )}
      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
    </div>
  );
}
