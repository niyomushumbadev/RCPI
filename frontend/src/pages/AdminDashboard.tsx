import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../lib/api';
import type { AdminDashboard as AdminData } from '../types';
import { PageHeader, Spinner, DashboardError, StatCard } from '../components/ui';
import { formatDateTime } from '../lib/format';

export default function AdminDashboard() {
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi
      .dashboard()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load admin dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (error) return <DashboardError message={error} onRetry={() => window.location.reload()} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="gov-card p-6">
        <PageHeader
          title="Administration centre"
          subtitle="Platform statistics, user oversight and service accountability."
          actions={
            <div className="flex flex-wrap gap-2">
              <Link to="/" className="btn-outline text-sm">Home</Link>
              <Link to="/dashboard" className="btn-outline text-sm">Dashboard</Link>
              <Link to="/admin/users" className="btn-outline text-sm">Manage users</Link>
              <Link to="/admin/audit-logs" className="btn-outline text-sm">Audit logs</Link>
              <Link to="/admin/management" className="btn-outline text-sm">System management</Link>
              <Link to="/government/intelligence" className="btn-primary text-sm">GIS & intelligence</Link>
            </div>
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="👥" label="Total users" value={data.stats.totalUsers} tone="blue" />
        <StatCard icon="🙋" label="Citizens" value={data.stats.totalCitizens} tone="green" />
        <StatCard icon="📋" label="Total reports" value={data.stats.totalReports} tone="slate" />
        <StatCard icon="⏳" label="Pending reports" value={data.stats.pendingReports} tone="amber" />
        <StatCard icon="✅" label="Resolved reports" value={data.stats.resolvedReports} tone="green" />
        <StatCard icon="🗂️" label="Categories" value={data.stats.totalCategories} tone="blue" />
        <StatCard icon="🏛️" label="Departments" value={data.stats.totalDepartments} tone="slate" />
      </div>

      <section className="gov-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Recent audit activity</h2>
          <Link to="/admin/audit-logs" className="text-sm font-semibold text-rwanda-blue hover:underline">View all</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Actor</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Resource</th>
                <th className="px-3 py-2">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.recentAudit.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-400">{formatDateTime(a.createdAt)}</td>
                  <td className="px-3 py-2 text-slate-700">{a.actorName ?? 'System'}</td>
                  <td className="px-3 py-2"><span className="badge bg-slate-100 font-mono text-[10px] text-slate-700">{a.action}</span></td>
                  <td className="px-3 py-2 text-slate-500">{a.resourceType}{a.resourceId ? ` #${a.resourceId}` : ''}</td>
                  <td className="max-w-xs truncate px-3 py-2 text-xs text-slate-400">{a.detail ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
