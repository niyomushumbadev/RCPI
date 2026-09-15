import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { workflowApi } from '../../lib/api';
import type { WorkflowStats, WorkflowReport } from '../../types';
import { StatusBadge, UrgencyBadge, timeAgo } from '../../lib/format';
import { PageHeader, Spinner, DashboardError, StatCard, EmptyState } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';

export default function WorkflowDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<WorkflowStats['stats'] | null>(null);
  const [pending, setPending] = useState<WorkflowReport[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([workflowApi.stats(), workflowApi.reports('ALL', 1)])
      .then(([s, r]) => {
        setStats(s.stats);
        setPending(r.reports.filter((rep: WorkflowReport) => ['SUBMITTED', 'RECEIVED', 'UNDER_REVIEW', 'REOPEN_REQUESTED'].includes(rep.status)).slice(0, 8));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load workflow data'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (error) return <DashboardError message={error} onRetry={() => window.location.reload()} />;
  if (!stats) return null;

  return (
    <div>
      <PageHeader
        title="Government workflow"
        subtitle={user ? `${user.firstName} ${user.lastName} · ${user.role.replace('_', ' ')}` : undefined}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/" className="btn-outline text-sm">Home</Link>
            <Link to="/dashboard" className="btn-outline text-sm">Dashboard</Link>
            <Link to="/workflow/reports" className="btn-primary">Open reports queue</Link>
            <Link to="/government/intelligence" className="btn-outline">GIS & intelligence</Link>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon="📋" label="Total reports" value={stats.total} tone="blue" />
        <StatCard icon="🆕" label="Needs first review" value={stats.submitted} tone="amber" />
        <StatCard icon="🔍" label="Under review" value={stats.underReview} tone="slate" />
        <StatCard icon="🔧" label="In progress" value={stats.inProgress} tone="blue" />
        <StatCard icon="📦" label="Assigned" value={stats.assigned} tone="slate" />
        <StatCard icon="✅" label="Resolved" value={stats.resolved} tone="green" />
        <StatCard icon="🚨" label="Escalated" value={stats.escalated} tone="red" />
      </div>

      <section className="card mt-6 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold text-slate-900">Awaiting action</h2>
          <Link to="/workflow/reports" className="text-sm text-rwanda-blue hover:underline">View full queue</Link>
        </div>
        {pending.length === 0 ? (
          <EmptyState icon="🎉" title="Queue is clear" hint="No reports are waiting for a first review right now." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {pending.map((r) => (
              <li key={r.id}>
                <Link to={`/workflow/${r.id}`} className="flex items-center gap-4 px-2 py-3 hover:bg-slate-50">
                  <span className="text-xl">{r.categoryIcon ?? '📌'}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-800">{r.title}</p>
                    <p className="text-xs text-slate-400">
                      {r.reference} · {r.district}{r.sector ? ` / ${r.sector}` : ''} · {timeAgo(r.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                  <UrgencyBadge urgency={r.urgency} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
