import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { t } from '../../translations';

export default function ForbiddenPage() {
  const { user } = useAuth();
  // Mirrors App.tsx DashboardEntry — keeps every role out of another 403.
  const home = user?.role === 'CITIZEN'
    ? '/citizen/dashboard'
    : user?.role === 'EXECUTIVE'
      ? '/executive'
      : ['CELL_OFFICER', 'SECTOR_OFFICER', 'OFFICER', 'ANALYST'].includes(user?.role ?? '')
        ? '/workflow'
        : '/admin';
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="gov-strip" />
      <div className="mx-auto flex min-h-[calc(100vh-8px)] max-w-xl items-center justify-center px-4 py-10">
        <div className="gov-shell w-full p-8 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl"><i className="fa-solid fa-ban" aria-hidden="true" /></div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">403 {t('error.forbidden')}</p>
          <h1 className="mt-3 text-3xl font-black text-slate-900">{t('error.forbidden')}</h1>
          <p className="mt-3 text-sm text-slate-600">
            {t('error.forbidden')} <strong>{user?.role ? t(`role.${user.role}`) : t('role.CITIZEN')}</strong>.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to={home} className="btn-primary">{t('nav.dashboard')}</Link>
            <Link to="/map" className="btn-outline">{t('nav.communityMap')}</Link>
            <Link to="/login" className="btn-outline">{t('landing.ctaLogin')}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
