import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { citizenApi } from '../lib/api';
import type { CitizenDashboard as DashboardData } from '../types';
import { StatusBadge } from '../lib/format';
import { PageHeader, Spinner, DashboardError, StatCard, EmptyState } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { getLanguage, translations } from '../translations';

export default function CitizenDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const language = getLanguage();
  const t = translations[language];

  useEffect(() => {
    citizenApi.dashboard()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (error) return <DashboardError message={error} onRetry={() => window.location.reload()} />;
  if (!data) return null;

  const quickAccessCards = [
    { to: '/citizen/report/create', label: 'Report a problem', icon: '📝', hint: 'Problem category + description' },
    { to: '/citizen/report/create', label: 'Take/upload photo', icon: '📷', hint: 'Attach supporting evidence' },
    { to: '/citizen/report/create', label: 'Upload video', icon: '🎥', hint: 'Add a short video clip' },
    { to: '/citizen/report/create', label: 'GPS location', icon: '📍', hint: 'Use current location' },
    { to: '/citizen/reports', label: 'My reports', icon: '📋', hint: 'Track all submissions' },
    { to: '/citizen/assistant', label: 'AI assistant', icon: '🤖', hint: 'Ask how to use R-CPI' },
    { to: '/notifications', label: 'Notifications', icon: '🔔', hint: 'Status updates and alerts' },
    { to: '/profile', label: 'Profile', icon: '👤', hint: 'Account and contact info' },
  ];

  return (
    <div>
      <PageHeader
        title={`${t.welcome} ${data.citizen.firstName} 👋`}
        subtitle={t.dashboardSubtitle}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/" className="btn-outline text-sm">Home</Link>
            <Link to="/dashboard" className="btn-outline text-sm">Dashboard</Link>
            <Link to="/citizen/report/create" className="btn-primary">
              + {t.reportProblem}
            </Link>
          </div>
        }
      />

      <div className="mb-6 card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Citizen application</h2>
          <span className="rounded-full bg-rwanda-blue/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-rwanda-blue">
            Rwanda
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {quickAccessCards.map((card) => (
            <Link
              key={card.label}
              to={card.to}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-rwanda-blue/30 hover:bg-rwanda-blue/5"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-xl shadow-sm">
                {card.icon}
              </div>
              <div className="font-semibold text-slate-800">{card.label}</div>
              <div className="mt-1 text-xs text-slate-500">{card.hint}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard icon="📋" label={t.totalReports} value={data.stats.total} tone="blue" />
        <StatCard icon="⏳" label={t.awaitingReview} value={data.stats.submitted} tone="amber" />
        <StatCard icon="🔍" label={t.underReview} value={data.stats.underReview} tone="blue" />
        <StatCard icon="🔧" label={t.inProgress} value={data.stats.inProgress} tone="slate" />
        <StatCard icon="✅" label={t.resolved} value={data.stats.resolved} tone="green" />
        <StatCard icon="🚫" label={t.rejected} value={data.stats.rejected} tone="red" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Recent reports */}
        <div className="card p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-slate-900">{t.recentReports}</h2>
            <Link to="/citizen/reports" className="text-sm text-rwanda-blue hover:underline">{t.viewAll}</Link>
          </div>
          {data.recentReports.length === 0 ? (
            <EmptyState
              icon="📝"
              title="No reports yet"
              hint="When you notice a problem in your community — a broken water point, a damaged road — submit your first report."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.recentReports.map((r) => (
                <li key={r.id}>
                  <Link to={`/reports/${r.id}`} className="flex items-center justify-between gap-3 rounded-lg px-2 py-3 hover:bg-slate-50">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800">{r.title}</p>
                      <p className="text-xs text-slate-400">
                        {r.reference} · {r.categoryName} · {r.districtName}
                      </p>
                    </div>
                    <StatusBadge status={r.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Quick links */}
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="mb-3 font-bold text-slate-900">Quick actions</h2>
            <div className="space-y-2">
              <Link to="/citizen/report/create" className="btn-primary w-full">📝 {t.reportProblem}</Link>
              <Link to="/map" className="btn-outline w-full">🗺️ {t.communityMap}</Link>
              <Link to="/community" className="btn-outline w-full">🌍 {t.communityInsights}</Link>
            </div>
          </div>
          <div className="card bg-rwanda-blue/5 p-5">
            <h2 className="mb-2 font-bold text-slate-900">🔔 Notifications</h2>
            <p className="text-sm text-slate-600">
              You have <strong>{data.unreadNotifications}</strong> unread notification{data.unreadNotifications === 1 ? '' : 's'}.
            </p>
            <Link to="/notifications" className="mt-3 inline-block text-sm font-semibold text-rwanda-blue hover:underline">
              Check notifications →
            </Link>
          </div>
          {user?.role === 'CITIZEN' && (
            <div className="card bg-green-50 p-5">
              <p className="text-sm text-slate-600">
                <strong>Did you know?</strong> You can submit reports anonymously. Your identity is never shown to
                government staff when anonymity is chosen.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
