import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { citizenApi } from '../../lib/api';
import type { ReportDetail as Detail } from '../../types';
import { StatusBadge, UrgencyBadge, formatDateTime } from '../../lib/format';
import { PageHeader, Spinner, ErrorBox } from '../../components/ui';
import { ReportTimeline } from '../../components/reports/ReportTimeline';
import { ReportEvidenceGallery } from '../../components/reports/ReportEvidenceGallery';

// Task 3 §47 + §16 — canonical ReportDetailsPage (additive).
export default function ReportDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    citizenApi.report(id)
      .then((r) => setReport(r.report))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} />;
  if (!report) return null;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={`${report.reference} — ${report.title}`} subtitle={`${report.categoryName} · submitted ${formatDateTime(report.createdAt)}`} actions={<Link to={`/reports/${report.id}/edit`} className="btn-outline text-sm">Edit</Link>} />
      <div className="card flex flex-wrap gap-2 p-4">
        <StatusBadge status={report.status} />
        <UrgencyBadge urgency={report.urgency} />
      </div>
      <section className="card mt-4 p-6">
        <h2 className="font-bold text-slate-900">Description</h2>
        <p className="mt-2 whitespace-pre-wrap text-slate-700">{report.description}</p>
        <h2 className="mt-6 font-bold text-slate-900">Evidence</h2>
        <div className="mt-2"><ReportEvidenceGallery evidence={report.evidence} /></div>
        <h2 className="mt-6 font-bold text-slate-900">Timeline</h2>
        <div className="mt-2"><ReportTimeline timeline={report.timeline} /></div>
      </section>
    </div>
  );
}
