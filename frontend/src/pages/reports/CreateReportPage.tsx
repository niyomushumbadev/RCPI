import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createReport, geoApi, metaApi } from '../../lib/api';
import type { Category, Province, District } from '../../types';
import { PageHeader, ErrorBox } from '../../components/ui';

// Task 3 §47 — canonical path: pages/reports/CreateReportPage.tsx
// Additive thin wrapper over the same /citizen/reports endpoint.
export default function CreateReportPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [form, setForm] = useState({ title: '', description: '', categoryId: '', provinceId: '', districtId: '', urgency: 'MEDIUM' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    metaApi.categories().then((r) => setCategories(r.categories)).catch(() => {});
    geoApi.provinces().then((r) => setProvinces(r.provinces)).catch(() => {});
  }, []);
  useEffect(() => {
    if (form.provinceId) geoApi.districts(Number(form.provinceId)).then((r) => setDistricts(r.districts)).catch(() => {});
  }, [form.provinceId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const { report } = await createReport({
        title: form.title, description: form.description,
        categoryId: Number(form.categoryId), urgency: form.urgency,
        provinceId: Number(form.provinceId), districtId: Number(form.districtId),
      });
      navigate(`/reports/${report.id}?created=1`);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Create report" subtitle="Describe the community problem." />
      {error && <div className="mb-4"><ErrorBox message={error} /></div>}
      <form onSubmit={submit} className="card space-y-4 p-6">
        <div><label className="label">Title</label><input className="input" required minLength={5} maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div><label className="label">Description</label><textarea className="input min-h-28" required minLength={10} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Category</label>
            <select className="input" required value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">Select…</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>
          <div><label className="label">Priority</label>
            <select className="input" value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value })}>
              <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option>
            </select></div>
          <div><label className="label">Province</label>
            <select className="input" required value={form.provinceId} onChange={(e) => setForm({ ...form, provinceId: e.target.value, districtId: '' })}>
              <option value="">Select…</option>{provinces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select></div>
          <div><label className="label">District</label>
            <select className="input" required value={form.districtId} onChange={(e) => setForm({ ...form, districtId: e.target.value })}>
              <option value="">Select…</option>{districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select></div>
        </div>
        <div className="flex justify-between">
          <Link to="/reports" className="btn-outline">Back</Link>
          <button className="btn-primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit report'}</button>
        </div>
      </form>
    </div>
  );
}
