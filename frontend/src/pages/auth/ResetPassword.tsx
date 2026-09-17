import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../../lib/api';
import RwandaFlagLogo from '../../components/RwandaFlagLogo';
import { t } from '../../translations';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const token = params.get('token') ?? '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError(t('auth.confirmNewPassword') + ' ✗');
      return;
    }
    if (!token) {
      setError(t('auth.resetLinkDev'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="gov-strip" />
      <div className="mx-auto flex min-h-[calc(100vh-8px)] max-w-xl items-center justify-center px-4 py-10">
        <div className="gov-shell w-full p-8">
          <div className="mb-6 text-center">
            <Link to="/" className="inline-flex items-center gap-2">
              <RwandaFlagLogo className="border-2 border-rwanda-blue bg-rwanda-blue/5" size={40} />
              <span className="text-sm font-black uppercase tracking-[0.12em] text-rwanda-green">Rwanda Community Problem Intelligence</span>
            </Link>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{t('auth.resetButton')}</p>
          </div>

          <h1 className="text-3xl font-black text-slate-900">{t('auth.resetTitle')}</h1>
          <p className="mt-2 text-sm text-slate-600">{t('auth.resetSubtitle')}</p>

          {done ? (
            <div className="mt-6 space-y-3">
              <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                {t('auth.resetSuccess')}
              </div>
              <button className="btn-primary w-full" onClick={() => navigate('/login')}>{t('auth.backToSignIn')}</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
              {!token && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  {t('auth.resetLinkDev')}
                </div>
              )}
              <div>
                <label className="label" htmlFor="reset-password">{t('auth.newPassword')}</label>
                <input
                  id="reset-password"
                  type="password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>

              <div>
                <label className="label" htmlFor="reset-confirm">{t('auth.confirmNewPassword')}</label>
                <input
                  id="reset-confirm"
                  type="password"
                  className="input"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                />
              </div>

              <div className="rounded-2xl border border-rwanda-yellow/40 bg-rwanda-yellow/10 p-3 text-sm text-slate-700">
                {t('auth.reqMinLength')} · {t('auth.reqCase')} · {t('auth.reqNumber')}
              </div>

              <button type="submit" className="btn-primary w-full" disabled={busy}>
                {busy ? t('common.saving') : t('auth.resetButton')}
              </button>
            </form>
          )}

          <div className="mt-6 flex items-center justify-between text-sm text-slate-500">
            <Link to="/login" className="inline-flex items-center font-semibold text-rwanda-blue hover:underline">
              {t('auth.backToSignIn')}
            </Link>
            <Link to="/" className="font-semibold text-slate-600 hover:underline">
              {t('common.home')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
