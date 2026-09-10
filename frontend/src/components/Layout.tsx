import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { notificationApi } from '../lib/api';
import type { Notification } from '../types';
import RwandaFlagLogo from './RwandaFlagLogo';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  roles?: string[];
}

const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: '🏠', roles: ['CITIZEN'] },
  { to: '/workflow', label: 'Reports Queue', icon: '📥', roles: ['OFFICER', 'DISTRICT_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'] },
  { to: '/admin', label: 'Administration', icon: '⚙️', roles: ['DISTRICT_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'] },
  { to: '/citizen/report/create', label: 'Report a Problem', icon: '📝', roles: ['CITIZEN'] },
  { to: '/citizen/reports', label: 'My Reports', icon: '📋', roles: ['CITIZEN'] },
  { to: '/citizen/notifications', label: 'Notifications', icon: '🔔', roles: ['CITIZEN'] },
  { to: '/profile', label: 'Profile', icon: '👤', roles: ['CITIZEN'] },
  { to: '/citizen/help', label: 'Help', icon: '❓', roles: ['CITIZEN'] },
  { to: '/map', label: 'Community Map', icon: '🗺️', roles: ['CITIZEN', 'OFFICER', 'DISTRICT_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'] },
  { to: '/community', label: 'Community', icon: '🌍', roles: ['CITIZEN', 'OFFICER', 'DISTRICT_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'] },
  { to: '/admin/users', label: 'Manage users', icon: '👥', roles: ['DISTRICT_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'] },
  { to: '/admin/audit-logs', label: 'Audit logs', icon: '🗂️', roles: ['DISTRICT_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      try {
        const { notifications, unreadCount } = await notificationApi.list(1);
        if (!cancelled) {
          setUnread(unreadCount);
          setNotifs(notifications.slice(0, 5));
        }
        if (notifications && notifications.length > 0 && notifications.some((n) => !n.isRead)) {
          setUnread((prev) => (prev > unreadCount ? prev : unreadCount));
        }
      } catch {
        // silent — notifications are non-critical
      }
    };
    load();
    const interval = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user]);

  async function handleMarkRead(id: number) {
    try {
      await notificationApi.markRead(id);
      setNotifs((ns) => ns.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      setUnread((u) => Math.max(0, u - 1));
    } catch {
      // ignore
    }
  }

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const visibleNav = NAV.filter((item) => {
    if (!user) return false;
    if (user.role === 'CITIZEN') {
      return item.roles?.includes('CITIZEN') ?? false;
    }
    return !item.roles || item.roles.includes(user.role);
  });

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="gov-strip" />

      <header className="sticky top-0 z-30 border-b border-slate-200 bg-slate-900 text-white shadow-lg shadow-slate-900/10">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <button className="rounded p-1 text-slate-200 hover:bg-slate-800 md:hidden" onClick={() => setMenuOpen((v) => !v)} aria-label="Toggle menu">
              ☰
            </button>
            <NavLink to="/dashboard" className="flex items-center gap-3">
              <RwandaFlagLogo className="border border-white/30 bg-white/10" size={36} />
              <div className="leading-none">
                <div className="text-[11px] font-black uppercase tracking-[0.14em] text-blue-200">Rwanda Community Problem Intelligence</div>
                <div className="hidden text-[10px] uppercase tracking-[0.18em] text-slate-300 sm:block">Gov portal</div>
              </div>
            </NavLink>
          </div>

          {user && (
            <div className="flex items-center gap-3">
              <NavLink
                to="/"
                className="inline-flex items-center rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-200 hover:bg-slate-700"
              >
                Home
              </NavLink>

              <NavLink
                to="/dashboard"
                className="inline-flex items-center rounded-full border border-rwanda-blue/30 bg-rwanda-blue/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-rwanda-blue hover:bg-rwanda-blue/20"
              >
                Portal
              </NavLink>

              <div className="relative">
                <button
                  className="relative rounded-full border border-slate-700 bg-slate-800 p-2 text-slate-200 hover:bg-slate-700"
                  onClick={() => setNotifOpen((v) => !v)}
                  aria-label="Notifications"
                >
                  🔔
                  {unread > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rwanda-yellow px-1 text-[10px] font-bold text-slate-900">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </button>
                {notifOpen && (
                  <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                    <div className="flex items-center justify-between px-2 py-1">
                      <span className="text-sm font-semibold text-slate-800">Notifications</span>
                      <button
                        className="text-xs text-rwanda-blue hover:underline"
                        onClick={async () => {
                          await notificationApi.markAllRead();
                          setUnread(0);
                          setNotifs((ns) => ns.map((n) => ({ ...n, isRead: true })));
                        }}
                      >
                        Mark all read
                      </button>
                    </div>
                    {notifs.length === 0 && <p className="px-2 py-4 text-center text-sm text-slate-400">No notifications yet</p>}
                    {notifs.map((n) => (
                      <button
                        key={n.id}
                        className={`block w-full rounded-lg px-2 py-2 text-left hover:bg-slate-50 ${n.isRead ? 'opacity-60' : ''}`}
                        onClick={() => handleMarkRead(n.id)}
                      >
                        <span className="block text-sm font-medium text-slate-800">{n.title}</span>
                        <span className="block text-xs text-slate-500">{n.message}</span>
                      </button>
                    ))}
                    <NavLink to="/notifications" className="block px-2 py-2 text-center text-xs text-rwanda-blue hover:underline" onClick={() => setNotifOpen(false)}>
                      View all
                    </NavLink>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 px-2 py-1.5">
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-semibold text-white">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-300">{user.role.replace('_', ' ')}</p>
                </div>
                <button className="btn-outline !border-slate-600 !bg-slate-700 !px-3 !py-1.5 !text-xs !text-white hover:!bg-slate-600" onClick={handleLogout}>
                  Log out
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        <aside className={`${menuOpen ? 'block' : 'hidden'} w-52 shrink-0 md:block`}>
          <nav className="sticky top-20 space-y-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
            {visibleNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive ? 'bg-rwanda-blue/10 text-rwanda-green' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`
                }
              >
                <span>{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
