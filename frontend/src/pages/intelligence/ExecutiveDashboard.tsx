import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { intelligenceApi } from '../../lib/api';
import type { ExecutiveDashboard as ExecutiveData } from '../../types';
import { PageHeader, ErrorBox, Spinner, StatCard } from '../../components/ui';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function ExecutiveDashboard() {
  const [data, setData] = useState<ExecutiveData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    intelligenceApi.executive()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load executive dashboard'))
      .finally(() => setLoading(false));
  }, []);

  function exportCsv() {
    const token = localStorage.getItem('rcpi_access_token');
    fetch('/api/v1/intelligence/reports/export.csv', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(async (r) => { if (!r.ok) throw new Error('Export failed'); return r.blob(); })
      .then((blob) => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'rcpi-executive.csv'; a.click(); URL.revokeObjectURL(url); })
      .catch((e) => setError(e instanceof Error ? e.message : 'Export failed'));
  }

  if (loading) return <Spinner label="Loading executive strategy…" />;
  if (error && !data) return <ErrorBox message={error} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Executive strategic dashboard"
        subtitle="Level 8 — aggregated national intelligence for senior decision-makers. No personal citizen details."
        actions={<div className="flex flex-wrap gap-2"><Link to="/government/intelligence" className="btn-outline">GIS & intelligence</Link><button className="btn-primary" onClick={exportCsv}>Download executive brief (CSV)</button></div>}
      />
      {error && <ErrorBox message={error} />}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Demo data notice:</strong> {data.notice} Figures are computed live from the database and are not official government statistics.
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="fa-clipboard-list" label="Verified reports (total)" value={data.stats.total} tone="blue" />
        <StatCard icon="fa-lock-open" label="Open reports" value={data.stats.open} tone="amber" />
        <StatCard icon="fa-circle-check" label="Resolved reports" value={data.stats.resolved} tone="green" />
        <StatCard icon="fa-triangle-exclamation" label="Critical load" value={data.stats.critical} tone="red" />
        <StatCard icon="fa-clock" label="Overdue (48h+)" value={data.stats.overdue} tone="red" />
        <StatCard icon="fa-arrow-trend-up" label="Resolution rate" value={`${data.stats.resolutionRate}%`} tone="slate" />
        <StatCard icon="fa-stopwatch" label="Avg resolution (h)" value={data.stats.avgResolutionHours ?? '—'} tone="slate" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-bold text-slate-900">Most affected provinces</h2>
          <div className="mt-4 h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.byProvince} layout="vertical" margin={{ left: 8, right: 12 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis dataKey="label" type="category" width={110} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="count" fill="#0067b1" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div>
        </section>
        <section className="card p-5">
          <h2 className="font-bold text-slate-900">Most affected districts</h2>
          <div className="mt-4 h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.byDistrict} layout="vertical" margin={{ left: 8, right: 12 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis dataKey="label" type="category" width={110} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="count" fill="#008001" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-bold text-slate-900">Recurring national problems</h2>
          <ul className="mt-3 space-y-2">{data.byCategory.map((c) => <li key={c.label} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm"><span className="font-medium text-slate-700">{c.label}</span><span className="font-bold text-slate-900">{c.count}</span></li>)}</ul>
        </section>
        <section className="card p-5">
          <h2 className="font-bold text-slate-900">Resource allocation recommendations</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">{data.recommendations.map((r) => <li key={r}>{r}</li>)}</ul>
          <h3 className="mt-4 font-bold text-slate-900">Workflow overview</h3>
          <div className="mt-2 flex flex-wrap gap-2">{data.byStatus.map((s) => <span key={s.label} className="badge bg-slate-100 text-slate-700">{s.label.replace(/_/g, ' ')}: {s.count}</span>)}</div>
        </section>
      </div>
    </div>
  );
}
