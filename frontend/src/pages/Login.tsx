import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import RwandaFlagLogo from '../components/RwandaFlagLogo';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const loggedInUser = await login(email, password, rememberMe);
      const targetPath =
        loggedInUser.role === 'CITIZEN'
          ? '/dashboard'
          : loggedInUser.role === 'OFFICER'
            ? '/workflow'
            : '/admin';
      navigate(from.startsWith('/login') || from.startsWith('/auth/') ? targetPath : from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  const demoAccounts = [
    { label: 'Citizen', email: 'citizen@rcpi.gov.rw', password: 'Citizen@123' },
    { label: 'Officer', email: 'officer@rcpi.gov.rw', password: 'Officer@123' },
    { label: 'District Admin', email: 'district-admin@rcpi.gov.rw', password: 'District@123' },
    { label: 'National Admin', email: 'national-admin@rcpi.gov.rw', password: 'National@123' },
    { label: 'System Admin', email: 'admin@rcpi.gov.rw', password: 'Admin@123' },
    { label: 'Analyst', email: 'analyst@rcpi.gov.rw', password: 'Analyst@123' },
  ];

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
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-100">Secure access portal</p>
              <h2 className="text-3xl font-black leading-tight">Public service access for citizens, officers and administrators.</h2>
            </div>
          </div>

          <div className="space-y-4 p-8">
            {[
              ['Verified identity', 'Secure logins for authenticated public service access.'],
              ['Role-based access', 'Clear access boundaries for citizen and government workflows.'],
              ['Audit accountability', 'All security events are monitored and recorded.'],
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
            <p className="mt-3 text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Government login</p>
          </div>

          <h2 className="text-3xl font-black text-slate-900">Welcome back</h2>
          <p className="mt-2 text-sm text-slate-600">Access the Rwanda Community Problem Intelligence portal.</p>

          {error && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">⚠️ {error}</div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="email">Email or phone</label>
              <input
                id="email"
                type="text"
                className="input"
                placeholder="name@example.rw or +250788000000"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
              />
            </div>

            <div>
              <label className="label" htmlFor="password">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="input pr-11"
                  placeholder="Enter your password"
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
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 text-sm">
              <label className="flex items-center gap-2 text-slate-600">
                <input type="checkbox" className="rounded border-slate-300 text-rwanda-blue focus:ring-rwanda-blue" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                Remember me
              </label>
              <Link to="/forgot-password" className="font-semibold text-rwanda-blue hover:underline">
                Forgot password?
              </Link>
            </div>

            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? 'Signing in…' : 'Secure sign in'}
            </button>
          </form>

          <div className="mt-6 rounded-2xl border border-rwanda-yellow/40 bg-rwanda-yellow/10 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-600">Password requirements</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              <li>✓ Minimum 8 characters</li>
              <li>✓ Uppercase and lowercase letters</li>
              <li>✓ Number and special character</li>
            </ul>
          </div>

          <p className="mt-6 text-center text-sm text-slate-500">
            New to the platform?{' '}
            <Link to="/register" className="font-semibold text-rwanda-blue hover:underline">
              Create an account
            </Link>
          </p>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Demo access</p>
            <div className="space-y-2">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  className="flex w-full items-center justify-between rounded-xl bg-white px-3 py-2 text-left text-sm shadow-sm transition hover:bg-slate-100"
                  onClick={() => {
                    setEmail(acc.email);
                    setPassword(acc.password);
                  }}
                >
                  <span className="font-semibold text-slate-800">{acc.label}</span>
                  <span className="text-xs text-slate-500">{acc.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
