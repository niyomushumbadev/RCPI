import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../lib/api';
import type { AdminDashboard as AdminData } from '../../types';
import { PageHeader, Spinner, DashboardError, StatCard } from '../../components/ui';
import { formatDateTime } from '../../lib/format';
import { t } from '../../translations';

export default function AdminDashboard() {
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi
      .dashboard()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : t('common.error')))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (error) return <DashboardError message={error} onRetry={() => window.location.reload()} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="gov-card p-6">
        <PageHeader
          title={t('admin.dashboardTitle')}
          subtitle={t('admin.dashboardSubtitle')}
          actions={
            <div className="flex flex-wrap gap-2">
              <Link to="/" className="btn-outline text-sm">{t('common.home')}</Link>
              <Link to="/dashboard" className="btn-outline text-sm">{t('nav.dashboard')}</Link>
              <Link to="/admin/users" className="btn-outline text-sm">{t('nav.manageUsers')}</Link>
              <Link to="/admin/audit-logs" className="btn-outline text-sm">{t('nav.auditLogs')}</Link>
              <Link to="/admin/management" className="btn-outline text-sm">{t('nav.systemManagement')}</Link>
              <Link to="/government/intelligence" className="btn-primary text-sm">{t('nav.gisIntelligence')}</Link>
            </div>
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="fa-users" label={t('admin.totalUsers')} value={data.stats.totalUsers} tone="blue" />
        <StatCard icon="fa-user-check" label={t('admin.totalCitizens')} value={data.stats.totalCitizens} tone="green" />
        <StatCard icon="fa-clipboard-list" label={t('admin.totalReports')} value={data.stats.totalReports} tone="slate" />
        <StatCard icon="⏳" label={t('admin.pendingReports')} value={data.stats.pendingReports} tone="amber" />
        <StatCard icon="fa-circle-check" label={t('citizen.resolved')} value={data.stats.resolvedReports} tone="green" />
        <StatCard icon="fa-box-archive" label={t('admin.totalCategories')} value={data.stats.totalCategories} tone="blue" />
        <StatCard icon="fa-landmark" label={t('admin.totalDepartments')} value={data.stats.totalDepartments} tone="slate" />
      </div>

      <section className="gov-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">{t('admin.recentActivity')}</h2>
          <Link to="/admin/audit-logs" className="text-sm font-semibold text-rwanda-blue hover:underline">{t('common.viewAll')}</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                <th className="px-3 py-2">{t('admin.auditTime')}</th>
                <th className="px-3 py-2">{t('admin.auditActor')}</th>
                <th className="px-3 py-2">{t('admin.auditAction')}</th>
                <th className="px-3 py-2">{t('admin.auditResource')}</th>
                <th className="px-3 py-2">{t('common.details')}</th>
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
