import { useState } from 'react';
import { Link } from 'react-router-dom';
import RwandaFlagLogo from '../components/RwandaFlagLogo';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setTimeout(() => {
      setSent(true);
      setBusy(false);
    }, 700);
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
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Password recovery</p>
          </div>

          <h1 className="text-3xl font-black text-slate-900">Forgot your password?</h1>
          <p className="mt-2 text-sm text-slate-600">
            Enter your email address and we will send reset instructions if an account exists.
          </p>

          {sent ? (
            <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
              If the account exists, password reset instructions have been sent.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="label" htmlFor="forgot-email">Email address</label>
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
                {busy ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          )}

          <div className="mt-6 flex items-center justify-between text-sm text-slate-500">
            <Link to="/login" className="inline-flex items-center font-semibold text-rwanda-blue hover:underline">
              ← Back to sign in
            </Link>
            <Link to="/" className="font-semibold text-slate-600 hover:underline">
              Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
