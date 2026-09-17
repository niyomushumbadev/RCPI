import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import RwandaFlagLogo from '../../components/RwandaFlagLogo';
import { t, getLanguage, setLanguage, LANGUAGES, type Language } from '../../translations';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/citizen/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [language, setSelectedLanguage] = useState<Language>(getLanguage());

  useEffect(() => {
    if ((location.state as { reason?: string } | null)?.reason === 'session-expired') {
      setError(t('error.sessionExpired'));
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [location.state]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const loggedInUser = await login(email, password, rememberMe);
      // Land every role on the dashboard that matches its access level.
      const roleDashboards: Record<string, string> = {
        CITIZEN: '/citizen/dashboard',
        CELL_OFFICER: '/workflow',
        SECTOR_OFFICER: '/workflow',
        OFFICER: '/workflow',
        ANALYST: '/workflow',
        DISTRICT_ADMIN: '/admin',
        PROVINCE_ADMIN: '/admin',
        CITY_ADMIN: '/admin',
        NATIONAL_ADMIN: '/admin',
        SYSTEM_ADMIN: '/admin',
        EXECUTIVE: '/executive',
      };
      const targetPath = roleDashboards[loggedInUser.role] ?? '/citizen/dashboard';
      navigate(from.startsWith('/login') || from.startsWith('/auth/') ? targetPath : from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error.invalidCredentials'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="gov-strip" />

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[1.05fr_0.95fr] lg:py-12">
        <aside className="gov-shell hidden overflow-hidden lg:flex lg:flex-col">
          <div className="gov-header p-8 text-white">
            <div className="flex items-center gap-3">
              <RwandaFlagLogo className="border border-white/30 bg-white/10" size={48} />
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-100">Rwanda</p>
                <h1 className="text-lg font-black uppercase tracking-[0.12em]">Rwanda Community Problem Intelligence</h1>
              </div>
            </div>

            <div className="mt-8 space-y-3">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-100">{t('auth.secureAccess')}</p>
              <h2 className="text-3xl font-black leading-tight">{t('auth.secureAccessTitle')}</h2>
            </div>
          </div>

          <div className="space-y-4 p-8">
            {[
              [t('auth.verifiedIdentity'), t('auth.verifiedIdentityText')],
              [t('auth.roleBasedAccess'), t('auth.roleBasedAccessText')],
              [t('auth.auditAccountability'), t('auth.auditAccountabilityText')],
            ].map(([title, text]) => (
              <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">{title}</p>
                <p className="mt-1 text-sm text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </aside>

        <div className="gov-shell p-6 sm:p-8 lg:p-10">
          <div className="mb-6 text-center lg:text-left">
            <Link to="/" className="inline-flex items-center gap-2">
              <RwandaFlagLogo className="border-2 border-rwanda-blue bg-rwanda-blue/5" size={40} />
              <span className="text-sm font-black uppercase tracking-[0.12em] text-rwanda-green">Rwanda Community Problem Intelligence</span>
            </Link>
            <p className="mt-3 text-sm font-medium uppercase tracking-[0.2em] text-slate-500">{t('nav.govPortal')}</p>
          </div>

          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-3xl font-black text-slate-900">{t('auth.loginTitle')}</h2>
            <select
              aria-label={t('common.language')}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600"
              value={language}
              onChange={(event) => {
                const next = event.target.value as Language;
                setSelectedLanguage(next);
                setLanguage(next);
                window.location.reload();
              }}
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>
          <p className="-mt-2 text-sm text-slate-600">{t('auth.loginSubtitle')}</p>

          {error && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> {error}</div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="email">{t('auth.emailOrPhone')}</label>
              <input
                id="email"
                type="text"
                className="input"
                placeholder={t('auth.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
              />
            </div>

            <div>
              <label className="label" htmlFor="password">{t('auth.password')}</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="input pr-11"
                  placeholder={t('auth.passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-3 flex items-center text-xs font-semibold uppercase tracking-[0.14em] text-slate-500"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? t('common.close') : t('common.view')}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 text-sm">
              <label className="flex items-center gap-2 text-slate-600">
                <input type="checkbox" className="rounded border-slate-300 text-rwanda-blue focus:ring-rwanda-blue" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                {t('auth.rememberMe')}
              </label>
              <Link to="/forgot-password" className="font-semibold text-rwanda-blue hover:underline">
                {t('auth.forgotPassword')}
              </Link>
            </div>

            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? t('auth.signingIn') : t('auth.signIn')}
            </button>
          </form>

          <div className="mt-6 rounded-2xl border border-rwanda-yellow/40 bg-rwanda-yellow/10 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-600">{t('auth.passwordRequirements')}</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              <li><i className="fa-solid fa-check" aria-hidden="true" /> {t('auth.reqMinLength')}</li>
              <li><i className="fa-solid fa-check" aria-hidden="true" /> {t('auth.reqCase')}</li>
              <li><i className="fa-solid fa-check" aria-hidden="true" /> {t('auth.reqNumber')}</li>
            </ul>
          </div>

          <p className="mt-6 text-center text-sm text-slate-500">
            {t('auth.newHere')}{' '}
            <Link to="/register" className="font-semibold text-rwanda-blue hover:underline">
              {t('auth.createAccount')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
