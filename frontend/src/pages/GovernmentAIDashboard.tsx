import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { intelligenceApi } from '../lib/api';
import type { IntelligenceDashboard } from '../types';
import { DashboardError, PageHeader, Spinner, StatCard } from '../components/ui';

export default function GovernmentAIDashboard() {
  const [data, setData] = useState<IntelligenceDashboard | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    intelligenceApi.dashboard()
      .then(setData)
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load AI dashboard'));
  }, []);

  if (error) return <DashboardError message={error} onRetry={() => window.location.reload()} />;
  if (!data) return <Spinner label="Loading AI intelligence dashboard…" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI intelligence dashboard"
        subtitle="Decision support for classification, severity, risk, priority and recommended action. Human review remains required."
        actions={<Link to="/government/intelligence" className="btn-outline">Open GIS intelligence</Link>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="🤖" label="Reports assessed" value={data.stats.total} tone="blue" />
        <StatCard icon="🚨" label="AI priority critical" value={data.stats.critical} tone="red" />
        <StatCard icon="📍" label="Location-aware reports" value={data.stats.mapped} tone="amber" />
        <StatCard icon="✅" label="Resolved outcomes" value={data.stats.resolved} tone="green" />
      </div>

      <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-bold">AI is advisory decision support</p><p className="mt-1 max-w-3xl text-blue-800">Predictions help teams prioritize review. Officers and authorized administrators remain responsible for verification, assignment, communication and final decisions.</p></div><Link to="/workflow" className="btn-primary">Open review queue</Link></div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="card p-5"><div className="flex items-center justify-between"><div><h2 className="font-bold text-slate-900">AI review queue</h2><p className="mt-1 text-xs text-slate-500">Open a report to inspect classification, severity, spam risk, duplicates and recommendations.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{data.recent.length} reports</span></div><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-slate-200 text-[11px] uppercase tracking-[0.14em] text-slate-400"><th className="px-3 py-2">Report</th><th className="px-3 py-2">Category</th><th className="px-3 py-2">Priority</th><th className="px-3 py-2" /></tr></thead><tbody className="divide-y divide-slate-100">{data.recent.slice(0, 12).map((report) => <tr key={report.id}><td className="px-3 py-3"><p className="font-semibold text-slate-800">{report.title}</p><p className="text-xs text-slate-400">{report.reference} · {report.district}</p></td><td className="px-3 py-3 text-slate-600">{report.category}</td><td className="px-3 py-3"><span className="font-bold text-slate-800">{report.priority.score}/100</span><span className={`ml-2 text-xs font-semibold ${report.priority.status === 'CRITICAL' ? 'text-red-700' : 'text-amber-700'}`}>{report.priority.status}</span></td><td className="px-3 py-3 text-right"><Link to={`/ai/reports/${report.id}`} className="btn-outline !px-3 !py-1 text-xs">View AI</Link></td></tr>)}</tbody></table>{data.recent.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No reports are available for AI review yet.</p>}</div></section>

        <section className="card p-5"><h2 className="font-bold text-slate-900">Prediction signals</h2><p className="mt-1 text-xs text-slate-500">Transparent baseline signals derived from current report concentration.</p><div className="mt-4 space-y-3">{data.predictions.map((prediction) => <div key={prediction.subject} className="rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-2"><strong className="text-sm text-slate-800">{prediction.subject}</strong><span className="text-xs font-bold text-rwanda-blue">{prediction.outlook}</span></div><p className="mt-2 text-xs leading-5 text-slate-500">{prediction.basis}</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-rwanda-blue" style={{ width: `${Math.round(prediction.confidence * 100)}%` }} /></div><p className="mt-1 text-right text-[11px] text-slate-400">{Math.round(prediction.confidence * 100)}% confidence</p></div>)}</div></section>
      </div>

      <section className="card p-5"><h2 className="font-bold text-slate-900">AI capability coverage</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[['Classification', 'Suggests the most likely problem category.'], ['Severity and risk', 'Highlights urgent and high-impact reports.'], ['Similarity checks', 'Surfaces possible duplicate reports for review.'], ['Recommendations', 'Suggests responsible action and department routing.']].map(([title, text]) => <div key={title} className="rounded-xl bg-slate-50 p-4"><p className="font-semibold text-slate-800">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div>)}</div></section>
    </div>
  );
}