import { useEffect, useState } from 'react';
import { citizenApi, authApi, geoApi } from '../../lib/api';
import type { District, Province, Sector } from '../../types';
import { PageHeader, Spinner, ErrorBox } from '../../components/ui';
import { formatDate } from '../../lib/format';

interface ProfileData {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  preferredLanguage: string;
  province: string | null;
  district: string | null;
  sector: string | null;
  provinceId: number | null;
  districtId: number | null;
  sectorId: number | null;
  createdAt: string;
}

export default function Profile() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', preferredLanguage: 'rw' });
  const [provinceId, setProvinceId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [sectorId, setSectorId] = useState('');
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  // Password change
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { profile: p } = await citizenApi.profile();
        setProfile(p);
        setForm({
          firstName: p.firstName,
          lastName: p.lastName,
          phone: p.phone ?? '',
          preferredLanguage: p.preferredLanguage,
        });
        if (p.provinceId) setProvinceId(String(p.provinceId));
        if (p.districtId) setDistrictId(String(p.districtId));
        if (p.sectorId) setSectorId(String(p.sectorId));
        const [{ provinces: ps }, { districts: ds }] = await Promise.all([
          geoApi.provinces(),
          p.provinceId ? geoApi.districts(p.provinceId) : Promise.resolve({ districts: [] }),
        ]);
        setProvinces(ps);
        setDistricts(ds);
        if (p.districtId) {
          const { sectors: ss } = await geoApi.sectors(p.districtId);
          setSectors(ss);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!provinceId) return;
    geoApi.districts(Number(provinceId)).then((r) => setDistricts(r.districts)).catch(() => {});
  }, [provinceId]);

  useEffect(() => {
    if (!districtId) return;
    geoApi.sectors(Number(districtId)).then((r) => setSectors(r.sectors)).catch(() => {});
  }, [districtId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSaved(false);
    setError('');
    try {
      await citizenApi.updateProfile({
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || null,
        preferredLanguage: form.preferredLanguage,
        provinceId: provinceId ? Number(provinceId) : null,
        districtId: districtId ? Number(districtId) : null,
        sectorId: sectorId ? Number(sectorId) : null,
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile');
    } finally {
      setBusy(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (pw.next !== pw.confirm) {
      setPwMsg({ ok: false, text: 'New passwords do not match' });
      return;
    }
    setPwBusy(true);
    try {
      await authApi.changePassword(pw.current, pw.next);
      setPwMsg({ ok: true, text: 'Password changed. You have been logged out — please log in again.' });
      setPw({ current: '', next: '', confirm: '' });
    } catch (err) {
      setPwMsg({ ok: false, text: err instanceof Error ? err.message : 'Could not change password' });
    } finally {
      setPwBusy(false);
    }
  }

  if (loading) return <Spinner />;
  if (error && !profile) return <ErrorBox message={error} />;
  if (!profile) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="gov-card p-6">
        <PageHeader title="My profile" subtitle={`Member since ${formatDate(profile.createdAt)}`} />
      </div>

      <form onSubmit={handleSave} className="gov-card space-y-5 p-6">
        {error && <ErrorBox message={error} />}
        {saved && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">✅ Profile updated successfully.</div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="pf-first">First name</label>
            <input id="pf-first" className="input" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} required />
          </div>
          <div>
            <label className="label" htmlFor="pf-last">Last name</label>
            <input id="pf-last" className="input" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} required />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="pf-email">Email</label>
          <input id="pf-email" className="input bg-slate-50" value={profile.email} disabled />
          <p className="mt-1 text-xs text-slate-400">Email cannot be changed. Contact support if needed.</p>
        </div>

        <div>
          <label className="label" htmlFor="pf-phone">Phone</label>
          <input id="pf-phone" className="input" placeholder="+250788000000" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        </div>

        <div>
          <label className="label" htmlFor="pf-lang">Preferred language</label>
          <select id="pf-lang" className="input" value={form.preferredLanguage} onChange={(e) => setForm((f) => ({ ...f, preferredLanguage: e.target.value }))}>
            <option value="rw">Kinyarwanda</option>
            <option value="en">English</option>
            <option value="fr">Français</option>
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="pf-province">Province</label>
            <select id="pf-province" className="input" value={provinceId} onChange={(e) => { setProvinceId(e.target.value); setDistrictId(''); setSectorId(''); }}>
              <option value="">Select…</option>
              {provinces.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="pf-district">District</label>
            <select id="pf-district" className="input" value={districtId} disabled={!provinceId} onChange={(e) => { setDistrictId(e.target.value); setSectorId(''); }}>
              <option value="">Select…</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="pf-sector">Sector</label>
            <select id="pf-sector" className="input" value={sectorId} disabled={!districtId} onChange={(e) => setSectorId(e.target.value)}>
              <option value="">Select…</option>
              {sectors.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </form>

      {/* Password change */}
      <div className="gov-card p-6">
        <h2 className="text-lg font-bold text-slate-900">Change password</h2>
        {pwMsg && (
          <div className={`mt-3 rounded-lg px-4 py-3 text-sm ${pwMsg.ok ? 'border border-green-200 bg-green-50 text-green-800' : 'border border-red-200 bg-red-50 text-red-700'}`}>
            {pwMsg.text}
          </div>
        )}
        <form onSubmit={handleChangePassword} className="mt-4 space-y-4">
          <div>
            <label className="label" htmlFor="pw-current">Current password</label>
            <input id="pw-current" type="password" className="input" value={pw.current} onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="pw-next">New password</label>
              <input id="pw-next" type="password" className="input" value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} required minLength={8} />
            </div>
            <div>
              <label className="label" htmlFor="pw-confirm">Confirm new password</label>
              <input id="pw-confirm" type="password" className="input" value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} required />
            </div>
          </div>
          <button type="submit" className="btn-outline" disabled={pwBusy}>
            {pwBusy ? 'Changing…' : 'Change password'}
          </button>
        </form>
      </div>
    </div>
  );
}
