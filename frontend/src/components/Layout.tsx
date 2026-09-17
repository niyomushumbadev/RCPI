import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { notificationApi } from '../lib/api';
import type { Notification } from '../types';
import RwandaFlagLogo from './RwandaFlagLogo';
import { getLanguage, setLanguage, t, LANGUAGES, type Language } from '../translations';

const GOV_HOME_ROLES = ['CELL_OFFICER', 'SECTOR_OFFICER', 'OFFICER', 'ANALYST'];

interface NavItem {
  to: string;
  labelKey: string;
  icon: string; // Font Awesome name (without fa-solid fa- prefix)
  roles?: string[];
}

const ALL_ROLES = ['CITIZEN', 'CELL_OFFICER', 'SECTOR_OFFICER', 'OFFICER', 'DISTRICT_ADMIN', 'PROVINCE_ADMIN', 'CITY_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN', 'ANALYST', 'EXECUTIVE'];

// Navigation mirrors the R-CPI hierarchy (master spec §3):
//   L1 CITIZEN → L2 CELL → L3 SECTOR → L4 DISTRICT → L5 PROVINCE
//   → L6 CITY → L7 NATIONAL → L8 EXECUTIVE (+ SYSTEM_ADMIN, ANALYST)
const NAV: NavItem[] = [
  // ── Level 1: Citizen portal ──
  { to: '/citizen/dashboard', labelKey: 'nav.dashboard', icon: 'house', roles: ['CITIZEN'] },
  { to: '/citizen/report/create', labelKey: 'nav.reportProblem', icon: 'file-pen', roles: ['CITIZEN'] },
  { to: '/citizen/reports', labelKey: 'nav.myReports', icon: 'clipboard-list', roles: ['CITIZEN'] },
  { to: '/citizen/assistant', labelKey: 'nav.aiAssistant', icon: 'robot', roles: ['CITIZEN'] },
  { to: '/citizen/profile', labelKey: 'nav.profile', icon: 'user', roles: ['CITIZEN'] },
  { to: '/citizen/help', labelKey: 'nav.help', icon: 'circle-question', roles: ['CITIZEN'] },

  // ── Shared: community & notifications (all levels) ──
  { to: '/map', labelKey: 'nav.communityMap', icon: 'map-location-dot', roles: ALL_ROLES },
  { to: '/community', labelKey: 'nav.community', icon: 'users', roles: ALL_ROLES },
  { to: '/notifications', labelKey: 'nav.notifications', icon: 'bell', roles: ALL_ROLES },

  // ── Levels 2-7: Government workflow ──
  { to: '/workflow', labelKey: 'nav.workflowDashboard', icon: 'inbox', roles: ['CELL_OFFICER', 'SECTOR_OFFICER', 'OFFICER', 'DISTRICT_ADMIN', 'PROVINCE_ADMIN', 'CITY_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN', 'ANALYST'] },
  { to: '/workflow/reports', labelKey: 'nav.reportsQueue', icon: 'list-check', roles: ['CELL_OFFICER', 'SECTOR_OFFICER', 'OFFICER', 'DISTRICT_ADMIN', 'PROVINCE_ADMIN', 'CITY_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN', 'ANALYST'] },
  { to: '/workflow/archive', labelKey: 'nav.closedArchive', icon: 'box-archive', roles: ['CELL_OFFICER', 'SECTOR_OFFICER', 'OFFICER', 'DISTRICT_ADMIN', 'PROVINCE_ADMIN', 'CITY_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN', 'ANALYST'] },

  // ── Levels 5-8: Intelligence & strategy ──
  { to: '/government/intelligence', labelKey: 'nav.gisIntelligence', icon: 'satellite-dish', roles: ['CELL_OFFICER', 'SECTOR_OFFICER', 'OFFICER', 'DISTRICT_ADMIN', 'PROVINCE_ADMIN', 'CITY_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN', 'ANALYST', 'EXECUTIVE'] },
  { to: '/government/ai', labelKey: 'nav.aiDashboard', icon: 'brain', roles: ['CELL_OFFICER', 'SECTOR_OFFICER', 'OFFICER', 'DISTRICT_ADMIN', 'PROVINCE_ADMIN', 'CITY_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN', 'ANALYST'] },
  { to: '/executive', labelKey: 'nav.executiveStrategy', icon: 'landmark', roles: ['NATIONAL_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE', 'ANALYST'] },

  // ── Levels 4-7: Administration ──
  { to: '/admin', labelKey: 'nav.administration', icon: 'sliders', roles: ['DISTRICT_ADMIN', 'PROVINCE_ADMIN', 'CITY_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'] },
  { to: '/admin/users', labelKey: 'nav.manageUsers', icon: 'users-gear', roles: ['DISTRICT_ADMIN', 'PROVINCE_ADMIN', 'CITY_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'] },
  { to: '/admin/audit-logs', labelKey: 'nav.auditLogs', icon: 'clipboard-check', roles: ['DISTRICT_ADMIN', 'PROVINCE_ADMIN', 'CITY_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'] },
  { to: '/admin/management', labelKey: 'nav.systemManagement', icon: 'screwdriver-wrench', roles: ['DISTRICT_ADMIN', 'PROVINCE_ADMIN', 'CITY_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [language, setSelectedLanguage] = useState<Language>(getLanguage());

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
    return item.roles?.includes(user.role) ?? false;
  });

  const homePath = user?.role === 'CITIZEN' ? '/citizen/dashboard' : user?.role === 'EXECUTIVE' ? '/executive' : GOV_HOME_ROLES.includes(user?.role ?? '') ? '/workflow' : '/admin';

  return (
    <div className="dashboard-shell min-h-screen bg-slate-100">
      <div className="gov-strip" />

      <header className="dashboard-topbar sticky top-0 z-30 text-white">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 lg:px-7">
          <div className="flex items-center gap-3">
            <button className="rounded p-1 text-white hover:bg-white/10 md:hidden" onClick={() => setMenuOpen((v) => !v)} aria-label={t('common.actions')}>
              <i className="fa-solid fa-bars" aria-hidden="true" />
            </button>
            <NavLink to={homePath} className="flex items-center gap-3">
              <RwandaFlagLogo className="border border-white/30 bg-white/10" size={36} />
              <div className="leading-none">
                <div className="text-[11px] font-black uppercase tracking-[0.14em] text-blue-200">Rwanda Community Problem Intelligence</div>
                <div className="hidden text-[10px] uppercase tracking-[0.18em] text-slate-300 sm:block">{t('nav.govPortal')}</div>
              </div>
            </NavLink>
          </div>

          {user && (
            <div className="flex items-center gap-3">
              <NavLink
                to="/"
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-200 transition hover:bg-white/10 hover:text-white"
              >
                {t('common.home')}
              </NavLink>

              <NavLink
                to={homePath}
                className="inline-flex items-center gap-1.5 rounded-full border border-brand-gold/40 bg-brand-gold/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold transition hover:bg-brand-gold/20"
              >
                {t('nav.portal')}
              </NavLink>

              <select aria-label={t('common.language')} className="rounded-full border border-white/15 bg-white/5 px-2 py-1.5 text-xs font-semibold text-slate-200" value={language} onChange={(event) => { const next = event.target.value as Language; setSelectedLanguage(next); setLanguage(next); window.location.reload(); }}>
                {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>

              <div className="relative">
                <button
                  className="relative rounded-full border border-white/15 bg-white/5 p-2 text-slate-200 transition hover:bg-white/10 hover:text-white"
                  onClick={() => setNotifOpen((v) => !v)}
                  aria-label={t('nav.notifications')}
                >
                  <i className="fa-solid fa-bell" aria-hidden="true" />
                  {unread > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-gold px-1 text-[10px] font-bold text-brand-navy">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </button>
                {notifOpen && (
                  <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-2 shadow-premium">
                    <div className="flex items-center justify-between px-2 py-1">
                      <span className="text-sm font-semibold text-brand-navy">{t('nav.notifications')}</span>
                      <button
                        className="text-xs text-brand-primary hover:underline"
                        onClick={async () => {
                          await notificationApi.markAllRead();
                          setUnread(0);
                          setNotifs((ns) => ns.map((n) => ({ ...n, isRead: true })));
                        }}
                      >
                        {t('nav.markAllRead')}
                      </button>
                    </div>
                    {notifs.length === 0 && <p className="px-2 py-4 text-center text-sm text-slate-400">{t('nav.noNotifications')}</p>}
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
                    <NavLink to="/notifications" className="block px-2 py-2 text-center text-xs text-brand-primary hover:underline" onClick={() => setNotifOpen(false)}>
                      {t('nav.viewAllNotifications')}
                    </NavLink>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-2 py-1.5">
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-semibold text-white">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-300">{t(`role.${user.role}`)}</p>
                </div>
                <button className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20" onClick={handleLogout}>
                  <i className="fa-solid fa-right-from-bracket text-[10px]" aria-hidden="true" />
                  {t('nav.logout')}
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto flex max-w-[1440px] gap-0 px-0 lg:px-7">
        <aside className={`${menuOpen ? 'block' : 'hidden'} dashboard-sidebar w-56 shrink-0 md:block`}>
          <nav className="sticky top-16 space-y-1 p-3 lg:p-4">
            {visibleNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 border-l-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive ? 'border-brand-gold bg-white/10 text-white' : 'border-transparent text-blue-100/80 hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                <i className={`fa-solid fa-${item.icon} w-4 text-center text-[13px]`} aria-hidden="true" />
                {t(item.labelKey)}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="dashboard-content min-w-0 flex-1 px-4 py-6 lg:px-7">
          <Outlet />
        </main>
      </div>

      <footer className="border-t border-white/10 bg-brand-navy text-slate-400">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-5 text-xs lg:px-7">
          <span>{t('nav.systemName')}</span>
          <span>{t('nav.secureWorkspace')}</span>
          <NavLink to="/citizen/help" className="text-brand-gold hover:text-amber-200">{t('nav.helpAndSupport')}</NavLink>
        </div>
      </footer>
    </div>
  );
}
