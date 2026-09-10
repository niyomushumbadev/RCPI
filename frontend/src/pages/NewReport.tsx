import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createReport, geoApi, metaApi } from '../lib/api';
import type { Category, District, Province, Sector } from '../types';
import { PageHeader, ErrorBox } from '../components/ui';

export default function NewReport() {
  const navigate = useNavigate();

  const [categories, setCategories] = useState<Category[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);

  const [form, setForm] = useState({
    title: '',
    description: '',
    categoryId: '',
    urgency: 'MEDIUM',
    provinceId: '',
    districtId: '',
    sectorId: '',
    cellName: '',
    latitude: '',
    longitude: '',
    locationDescription: '',
    isAnonymous: false,
  });
  const [photoName, setPhotoName] = useState('');
  const [videoName, setVideoName] = useState('');
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    metaApi.categories().then((r) => setCategories(r.categories)).catch(() => {});
    geoApi.provinces().then((r) => setProvinces(r.provinces)).catch(() => {});
  }, []);

  useEffect(() => {
    setDistricts([]);
    setSectors([]);
    if (form.provinceId) geoApi.districts(Number(form.provinceId)).then((r) => setDistricts(r.districts)).catch(() => {});
  }, [form.provinceId]);

  useEffect(() => {
    setSectors([]);
    if (form.districtId) geoApi.sectors(Number(form.districtId)).then((r) => setSectors(r.sectors)).catch(() => {});
  }, [form.districtId]);

  const selectedCategory = useMemo(() => categories.find((c) => String(c.id) === form.categoryId), [categories, form.categoryId]);

  function set<K extends keyof typeof form>(key: K, value: string | boolean) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set('latitude', pos.coords.latitude.toFixed(6));
        set('longitude', pos.coords.longitude.toFixed(6));
        setLocating(false);
      },
      () => {
        setError('Could not get your location. You can still enter a description.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { report } = await createReport({
        title: form.title,
        description: form.description,
        categoryId: Number(form.categoryId),
        urgency: form.urgency,
        provinceId: Number(form.provinceId),
        districtId: Number(form.districtId),
        sectorId: form.sectorId ? Number(form.sectorId) : undefined,
        latitude: form.latitude ? Number(form.latitude) : undefined,
        longitude: form.longitude ? Number(form.longitude) : undefined,
        locationDescription: form.locationDescription || undefined,
        isAnonymous: form.isAnonymous,
      });
      navigate(`/reports/${report.id}?created=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit report');
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Report a problem" subtitle="Describe the issue precisely — your report goes straight to government review." />

      {error && <div className="mb-4"><ErrorBox message={error} /></div>}

      <form onSubmit={handleSubmit} className="card space-y-5 p-6">
        {/* Step 1 — what */}
        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">1 · What is the problem?</h2>

          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="title">Title *</label>
              <input
                id="title"
                className="input"
                maxLength={200}
                placeholder="e.g. Broken water pipe flooding the main road"
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                required
              />
            </div>

            <div>
              <label className="label" htmlFor="description">Description *</label>
              <textarea
                id="description"
                className="input min-h-32"
                maxLength={5000}
                placeholder="What happened? Since when? Who is affected?"
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="category">Category *</label>
                <select id="category" className="input" value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)} required>
                  <option value="">Select a category…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon ? `${c.icon} ` : ''}{c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Urgency</label>
                <div className="flex gap-2">
                  {(['LOW', 'MEDIUM', 'HIGH'] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        form.urgency === u
                          ? u === 'HIGH'
                            ? 'border-red-400 bg-red-50 text-red-700'
                            : u === 'MEDIUM'
                              ? 'border-amber-400 bg-amber-50 text-amber-700'
                              : 'border-slate-400 bg-slate-50 text-slate-700'
                          : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                      onClick={() => set('urgency', u)}
                    >
                      {u.charAt(0) + u.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <hr className="border-slate-100" />

        {/* Step 2 — where */}
        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">2 · Where is it?</h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="nr-province">Province *</label>
              <select id="nr-province" className="input" value={form.provinceId} onChange={(e) => set('provinceId', e.target.value)} required>
                <option value="">Select…</option>
                {provinces.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="nr-district">District *</label>
              <select id="nr-district" className="input" value={form.districtId} disabled={!form.provinceId} onChange={(e) => set('districtId', e.target.value)} required>
                <option value="">Select…</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="nr-sector">Sector</label>
              <select id="nr-sector" className="input" value={form.sectorId} disabled={!form.districtId} onChange={(e) => set('sectorId', e.target.value)}>
                <option value="">Select…</option>
                {sectors.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="label" htmlFor="locdesc">Landmark / location description</label>
            <input
              id="locdesc"
              className="input"
              placeholder="e.g. Near Kimironko market, opposite the church"
              value={form.locationDescription}
              onChange={(e) => set('locationDescription', e.target.value)}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="w-40">
              <label className="label" htmlFor="lat">Latitude</label>
              <input id="lat" className="input" value={form.latitude} onChange={(e) => set('latitude', e.target.value)} placeholder="-1.9441" />
            </div>
            <div className="w-40">
              <label className="label" htmlFor="lng">Longitude</label>
              <input id="lng" className="input" value={form.longitude} onChange={(e) => set('longitude', e.target.value)} placeholder="30.0619" />
            </div>
            <button type="button" className="btn-outline" onClick={handleUseMyLocation} disabled={locating}>
              {locating ? 'Locating…' : '📍 Use my location'}
            </button>
          </div>
        </section>

        <hr className="border-slate-100" />

        {/* Step 3 — evidence */}
        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">3 · Evidence</h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label" htmlFor="report-photo">Take / upload photo</label>
              <input
                id="report-photo"
                type="file"
                accept="image/*"
                capture="environment"
                className="input file:mr-3 file:rounded file:border-0 file:bg-rwanda-blue file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
                onChange={(e) => setPhotoName(e.target.files && e.target.files[0] ? e.target.files[0].name : '')}
              />
              {photoName && <p className="mt-2 text-xs text-slate-500">Selected photo: {photoName}</p>}
            </div>

            <div>
              <label className="label" htmlFor="report-video">Upload video</label>
              <input
                id="report-video"
                type="file"
                accept="video/*"
                capture="environment"
                className="input file:mr-3 file:rounded file:border-0 file:bg-rwanda-green file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
                onChange={(e) => setVideoName(e.target.files && e.target.files[0] ? e.target.files[0].name : '')}
              />
              {videoName && <p className="mt-2 text-xs text-slate-500">Selected video: {videoName}</p>}
            </div>
          </div>
        </section>

        <hr className="border-slate-100" />

        {/* Step 4 — options */}
        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">4 · Options</h2>
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-4">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={form.isAnonymous}
              onChange={(e) => set('isAnonymous', e.target.checked)}
            />
            <span className="text-sm">
              <strong className="text-slate-800">Submit anonymously</strong>
              <span className="block text-slate-500">
                Government staff will not see your name or contact details. You will still receive updates and can follow the report.
              </span>
            </span>
          </label>
        </section>

        {/* Submit */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-400">
            {selectedCategory?.nameRw ? `Icyo gihe: ${selectedCategory.nameRw}` : 'You will be notified at every step of the review.'}
          </p>
          <button type="submit" className="btn-primary px-6" disabled={busy}>
            {busy ? 'Submitting…' : 'Submit report'}
          </button>
        </div>
      </form>
    </div>
  );
}
