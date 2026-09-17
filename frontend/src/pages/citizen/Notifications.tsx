import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { notificationApi } from '../../lib/api';
import type { Notification as Notif } from '../../types';
import { PageHeader, Spinner, ErrorBox, EmptyState, Pagination } from '../../components/ui';
import { Icon } from '../../components/icons';
import { timeAgo } from '../../lib/format';
import { t } from '../../translations';

export default function Notifications() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ notifications: Notif[]; unreadCount: number; pagination: { page: number; totalPages: number } } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    notificationApi
      .list(page)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : t('common.error')))
      .finally(() => setLoading(false));
  }, [page]);

  async function markRead(id: number) {
    try {
      await notificationApi.markRead(id);
      setData((d) => (d ? { ...d, notifications: d.notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n)), unreadCount: Math.max(0, d.unreadCount - 1) } : d));
    } catch {
      // ignore
    }
  }

  async function markAll() {
    try {
      await notificationApi.markAllRead();
      setData((d) => (d ? { ...d, notifications: d.notifications.map((n) => ({ ...n, isRead: true })), unreadCount: 0 } : d));
    } catch {
      // ignore
    }
  }

  async function remove(id: number) {
    try {
      await notificationApi.delete(id);
      setData((d) => (d ? { ...d, notifications: d.notifications.filter((n) => n.id !== id) } : d));
    } catch {
      // ignore
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={t('citizen.notificationsTitle')}
        subtitle={data ? `${data.unreadCount} ${t('citizen.unreadNotifications')}` : undefined}
        actions={
          <button className="btn-outline text-sm" onClick={markAll} disabled={!data || data.unreadCount === 0}>
            {t('nav.markAllRead')}
          </button>
        }
      />

      {error && <ErrorBox message={error} />}
      {loading && <Spinner />}

      {!loading && !error && data && data.notifications.length === 0 && (
        <EmptyState icon="fa-bell-slash" title={t('nav.noNotifications')} hint={t('citizen.noNotifications')} />
      )}

      {!loading && !error && data && data.notifications.length > 0 && (
        <div className="card divide-y divide-slate-100">
          {data.notifications.map((n) => (
            <div key={n.id} className={`flex items-start gap-3 p-4 ${n.isRead ? 'opacity-60' : ''}`}>
              <span className="mt-0.5 text-lg text-brand-primary"><Icon name={n.isRead ? 'fa-inbox' : 'fa-envelope'} /></span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-800">{n.title}</p>
                <p className="text-sm text-slate-600">{n.message}</p>
                <p className="mt-1 text-xs text-slate-400">{timeAgo(n.createdAt)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {n.reportId && (
                  <Link to={`/reports/${n.reportId}`} className="text-xs font-semibold text-rwanda-blue hover:underline">
                    {t('common.view')}
                  </Link>
                )}
                {!n.isRead && (
                  <button className="text-xs text-slate-400 hover:text-slate-600" onClick={() => markRead(n.id)}>
                    {t('common.close')}
                  </button>
                )}
                <button
                  className="text-xs text-slate-400 hover:text-red-600"
                  onClick={() => remove(n.id)}
                  aria-label={t('common.delete')}
                  title={t('common.delete')}
                >
                  <i className="fa-solid fa-trash-can" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && data && (
        <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={setPage} />
      )}
    </div>
  );
}
