import { useEffect, useState } from 'react';
import { citizenApi } from '../lib/api';
import type { CommunityInsights, CommunityAlert } from '../types';
import { PageHeader, Spinner, ErrorBox, StatCard, EmptyState } from '../components/ui';
import { timeAgo, formatDate } from '../lib/format';

const SEVERITY_STYLE: Record<string, string> = {
  INFO: 'bg-sky-100 text-sky-800',
  WARNING: 'bg-amber-100 text-amber-800',
  CRITICAL: 'bg-red-100 text-red-800',
};

export default function Community() {
  const [insights, setInsights] = useState<CommunityInsights | null>(null);
  const [alerts, setAlerts] = useState<CommunityAlert[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([citizenApi.insights(), citizenApi.alerts()])
      .then(([i, a]) => {
        setInsights(i);
        setAlerts(a.alerts);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load community data'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} />;
  if (!insights) return null;

  const resolutionRate = insights.stats.totalReports > 0
    ? Math.round((insights.stats.resolvedReports / insights.stats.totalReports) * 100)
    : 0;

  return (
    <div>
      <PageHeader title="Community insights" subtitle="Aggregated, privacy-respecting statistics from across Rwanda." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon="🌍" label="Public reports" value={insights.stats.totalReports} tone="blue" />
        <StatCard icon="✅" label="Resolved" value={insights.stats.resolvedReports} tone="green" />
        <StatCard icon="🔧" label="In progress" value={insights.stats.inProgressReports} tone="amber" />
        <StatCard icon="🔍" label="Under review" value={insights.stats.underReviewReports} tone="slate" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Most reported */}
        <section className="card p-6">
          <h2 className="mb-4 font-bold text-slate-900">Most reported problems</h2>
          {insights.mostReported.length === 0 ? (
            <p className="text-sm text-slate-400">No public reports yet.</p>
          ) : (
            <div className="space-y-3">
              {insights.mostReported.map((c) => {
                const max = Math.max(...insights.mostReported.map((x) => x.count));
                return (
                  <div key={c.name} className="flex items-center gap-3">
                    <span className="w-8 text-center text-xl">{c.icon ?? '📌'}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-slate-700">{c.name}</span>
                        <span className="text-slate-400">{c.count}</span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-slate-100">
                        <div className="h-2 rounded-full bg-rwanda-blue" style={{ width: `${(c.count / max) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="mt-4 text-xs text-slate-400">Resolution rate: <strong className="text-rwanda-green">{resolutionRate}%</strong> of public reports resolved or closed.</p>
        </section>

        {/* Recently resolved */}
        <section className="card p-6">
          <h2 className="mb-4 font-bold text-slate-900">Recently resolved 🎉</h2>
          {insights.recentlyResolved.length === 0 ? (
            <p className="text-sm text-slate-400">Nothing resolved yet — your reports make this happen!</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {insights.recentlyResolved.map((r) => (
                <li key={r.id} className="py-3">
                  <p className="font-medium text-slate-800">{r.categoryIcon ? `${r.categoryIcon} ` : ''}{r.title}</p>
                  <p className="text-xs text-slate-400">
                    {r.categoryName} · {r.district} · resolved {formatDate(r.resolvedAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Alerts */}
      <section className="mt-6">
        <h2 className="mb-4 text-lg font-bold text-slate-900">📢 Community alerts</h2>
        {alerts.length === 0 ? (
          <EmptyState icon="🔔" title="No active alerts" hint="Government-issued alerts about weather, safety and services will appear here." />
        ) : (
          <div className="space-y-3">
            {alerts.map((a) => (
              <div key={a.id} className={`card border-l-4 p-4 ${a.severity === 'CRITICAL' ? 'border-l-red-500' : a.severity === 'WARNING' ? 'border-l-amber-500' : 'border-l-sky-500'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-bold text-slate-900">{a.title}</h3>
                  <span className={`badge ${SEVERITY_STYLE[a.severity] ?? 'bg-slate-100 text-slate-600'}`}>{a.severity}</span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{a.message}</p>
                <p className="mt-2 text-xs text-slate-400">{timeAgo(a.createdAt)}{a.category ? ` · ${a.category}` : ''}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
