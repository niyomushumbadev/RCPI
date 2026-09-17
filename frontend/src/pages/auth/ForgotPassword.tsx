import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../../lib/api';
import RwandaFlagLogo from '../../components/RwandaFlagLogo';
import { t } from '../../translations';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [devToken, setDevToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      // Response data is null when the email is unknown (anti-enumeration) —
      // only a dev-mode hit returns a resetToken.
      const res = await authApi.forgotPassword(email.trim());
      if (res?.resetToken) setDevToken(res.resetToken);
      setSent(true);
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
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{t('auth.forgotTitle')}</p>
          </div>

          <h1 className="text-3xl font-black text-slate-900">{t('auth.forgotTitle')}?</h1>
          <p className="mt-2 text-sm text-slate-600">{t('auth.forgotSubtitle')}</p>

          {sent ? (
            <div className="mt-6 space-y-3">
              <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                {t('auth.resetSent')}
              </div>
              {devToken && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-semibold">{t('auth.resetLinkDev')}:</p>
                  <Link className="mt-1 inline-block break-all font-mono text-xs text-rwanda-blue underline" to={`/reset-password?token=${devToken}`}>
                    {t('auth.openResetLink')}
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
              <div>
                <label className="label" htmlFor="forgot-email">{t('auth.email')}</label>
                <input
                  id="forgot-email"
                  type="email"
                  className="input"
                  placeholder="name@example.rw"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn-primary w-full" disabled={busy}>
                {busy ? t('common.loading') : t('auth.sendResetLink')}
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
