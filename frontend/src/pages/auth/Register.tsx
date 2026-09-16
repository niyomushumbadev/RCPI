import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { geoApi } from '../../lib/api';
import type { District, Province, Sector } from '../../types';
import RwandaFlagLogo from '../../components/RwandaFlagLogo';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirm: '',
    preferredLanguage: 'rw',
  });
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [provinceId, setProvinceId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [sectorId, setSectorId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    geoApi.provinces().then((r) => setProvinces(r.provinces)).catch(() => {});
  }, []);

  useEffect(() => {
    setDistricts([]);
    setSectors([]);
    setDistrictId('');
    setSectorId('');
    if (provinceId) geoApi.districts(Number(provinceId)).then((r) => setDistricts(r.districts)).catch(() => {});
  }, [provinceId]);

  useEffect(() => {
    setSectors([]);
    setSectorId('');
    if (districtId) geoApi.sectors(Number(districtId)).then((r) => setSectors(r.sectors)).catch(() => {});
  }, [districtId]);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setError('Passwords do not match');
      return;
    }
    setBusy(true);
    try {
      await register({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || undefined,
        password: form.password,
        preferredLanguage: form.preferredLanguage,
        provinceId: provinceId ? Number(provinceId) : undefined,
        districtId: districtId ? Number(districtId) : undefined,
        sectorId: sectorId ? Number(sectorId) : undefined,
      });
      navigate('/citizen/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="gov-strip" />

      <div className="mx-auto max-w-5xl px-4 py-8 lg:py-12">
        <div className="gov-shell overflow-hidden">
          <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
            <aside className="gov-header p-8 text-white">
              <div className="flex items-center gap-3">
                <RwandaFlagLogo className="border border-white/30 bg-white/10" size={48} />
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-100">Rwanda</p>
                  <h1 className="text-2xl font-black">R-CPI</h1>
                </div>
              </div>

              <div className="mt-8">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-100">Citizen registration</p>
                <h2 className="mt-3 text-3xl font-black leading-tight">Create your secure public access account.</h2>
                <p className="mt-4 text-sm leading-6 text-blue-50">
                  Register to access the citizen portal, submit service needs and stay informed about community improvements in your area.
                </p>
              </div>

              <div className="mt-8 space-y-3 text-sm text-blue-50">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3"><i className="fa-solid fa-check" aria-hidden="true" /> Secure account setup</div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3"><i className="fa-solid fa-check" aria-hidden="true" /> Role-based public service access</div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3"><i className="fa-solid fa-check" aria-hidden="true" /> Verified district visibility</div>
              </div>
            </aside>

            <div className="p-6 sm:p-8">
              <div className="mb-6 flex items-center justify-between gap-3">
                <div className="text-center lg:text-left">
                  <Link to="/" className="inline-flex items-center gap-2">
                    <RwandaFlagLogo className="border-2 border-rwanda-blue bg-rwanda-blue/5" size={40} />
                    <span className="text-sm font-black uppercase tracking-[0.12em] text-rwanda-green">Rwanda Community Problem Intelligence</span>
                  </Link>
                  <p className="mt-3 text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Create account</p>
                </div>
                <Link to="/login" className="inline-flex items-center text-sm font-semibold text-rwanda-blue hover:underline">
                  ← Back to login
                </Link>
              </div>

              {error && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> {error}</div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="firstName">First name *</label>
                    <input id="firstName" className="input" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} required />
                  </div>
                  <div>
                    <label className="label" htmlFor="lastName">Last name *</label>
                    <input id="lastName" className="input" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} required />
                  </div>
                </div>

                <div>
                  <label className="label" htmlFor="reg-email">Email *</label>
                  <input id="reg-email" type="email" className="input" value={form.email} onChange={(e) => set('email', e.target.value)} required />
                </div>

                <div>
                  <label className="label" htmlFor="phone">Phone (+250…)</label>
                  <input id="phone" className="input" placeholder="+250788000000" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="reg-password">Password *</label>
                    <input id="reg-password" type="password" className="input" value={form.password} onChange={(e) => set('password', e.target.value)} required minLength={8} />
                  </div>
                  <div>
                    <label className="label" htmlFor="confirm">Confirm password *</label>
                    <input id="confirm" type="password" className="input" value={form.confirm} onChange={(e) => set('confirm', e.target.value)} required />
                  </div>
                </div>

                <div className="rounded-2xl border border-rwanda-yellow/40 bg-rwanda-yellow/10 p-3 text-sm text-slate-700">
                  <p className="font-semibold">Password requirements</p>
                  <ul className="mt-1 list-inside list-disc space-y-1">
                    <li>Minimum 8 characters</li>
                    <li>Uppercase and lowercase letters</li>
                    <li>Number and special character</li>
                  </ul>
                </div>

                <div>
                  <label className="label" htmlFor="lang">Preferred language</label>
                  <select id="lang" className="input" value={form.preferredLanguage} onChange={(e) => set('preferredLanguage', e.target.value)}>
                    <option value="rw">Kinyarwanda</option>
                    <option value="en">English</option>
                    <option value="fr">Français</option>
                  </select>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="label" htmlFor="province">Province</label>
                    <select id="province" className="input" value={provinceId} onChange={(e) => setProvinceId(e.target.value)}>
                      <option value="">Select…</option>
                      {provinces.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="district">District</label>
                    <select id="district" className="input" value={districtId} disabled={!provinceId} onChange={(e) => setDistrictId(e.target.value)}>
                      <option value="">Select…</option>
                      {districts.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="sector">Sector</label>
                    <select id="sector" className="input" value={sectorId} disabled={!districtId} onChange={(e) => setSectorId(e.target.value)}>
                      <option value="">Select…</option>
                      {sectors.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button type="submit" className="btn-primary w-full" disabled={busy}>
                  {busy ? 'Creating account…' : 'Create citizen account'}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-slate-500">
                Already have an account?{' '}
                <Link to="/login" className="font-semibold text-rwanda-blue hover:underline">
                  Log in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
