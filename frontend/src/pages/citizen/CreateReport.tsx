import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createReport, geoApi, metaApi } from '../../lib/api';
import type { Category, District, Province, Sector } from '../../types';
import { PageHeader, ErrorBox } from '../../components/ui';
import { t } from '../../translations';

function estimateAiSuggestion(title: string, description: string) {
  const text = `${title} ${description}`.toLowerCase();
  const rules = [
    { category: 'Drainage', keywords: ['drain', 'flood', 'blocked drain', 'water overflow', 'sewer', 'storm water'], severity: 'HIGH' },
    { category: 'Road', keywords: ['road', 'pothole', 'street', 'bridge', 'damage'], severity: 'MEDIUM' },
    { category: 'Waste', keywords: ['garbage', 'waste', 'rubbish', 'trash', 'dump', 'litter'], severity: 'MEDIUM' },
    { category: 'Water', keywords: ['water pipe', 'tap', 'supply', 'water leak', 'well', 'pipe'], severity: 'HIGH' },
    { category: 'Electricity', keywords: ['electric', 'power outage', 'transformer', 'cable', 'lighting'], severity: 'HIGH' },
  ];

  const matched = rules.find((rule) => rule.keywords.some((keyword) => text.includes(keyword))) ?? { category: 'General infrastructure', keywords: [], severity: 'MEDIUM' };
  const score = Math.min(96, 55 + (matched.keywords.length * 10) + (text.length > 80 ? 10 : 0));
  const urgentWords = ['urgent', 'danger', 'risk', 'blocked', 'overflow', 'unsafe', 'school', 'hospital'];
  const severity = urgentWords.some((word) => text.includes(word)) ? 'HIGH' : matched.severity;

  return {
    category: matched.category,
    confidence: Math.round(score),
    severity,
    summary: `${t('workflow.aiSuggestion')}: ${matched.category} · ${severity}`,
  };
}

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
  const aiSuggestion = useMemo(
    () => (form.title.trim() || form.description.trim() ? estimateAiSuggestion(form.title, form.description) : null),
    [form.title, form.description]
  );

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
      setError(t('common.networkError'));
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
        setError(t('common.networkError'));
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
      setError(err instanceof Error ? err.message : t('common.error'));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t('citizen.createTitle')} subtitle={t('citizen.createSubtitle')} />

      {error && <div className="mb-4"><ErrorBox message={error} /></div>}

      <form onSubmit={handleSubmit} className="card space-y-5 p-6">
        {/* Step 1 — what */}
        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">1 · {t('citizen.titleLabel')}</h2>

          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="title">{t('citizen.titleLabel')} *</label>
              <input
                id="title"
                className="input"
                maxLength={200}
                placeholder={t('citizen.titlePlaceholder')}
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                required
              />
            </div>

            <div>
              <label className="label" htmlFor="description">{t('citizen.descriptionLabel')} *</label>
              <textarea
                id="description"
                className="input min-h-32"
                maxLength={5000}
                placeholder={t('citizen.descriptionPlaceholder')}
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                required
              />
            </div>

            {aiSuggestion && (
              <div className="rounded-2xl border border-purple-200 bg-purple-50 p-4 text-sm text-purple-900">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold"><i className="fa-solid fa-robot" aria-hidden="true" /> {t('workflow.aiSuggestion')}</p>
                  <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-purple-700">{aiSuggestion.confidence}% {t('workflow.aiConfidence')}</span>
                </div>
                <p className="mt-2"><strong>{t('workflow.aiCategory')}:</strong> {aiSuggestion.category}</p>
                <p className="mt-1"><strong>{t('workflow.priority')}:</strong> {t(`urgency.${aiSuggestion.severity}`)}</p>
                <p className="mt-2 text-purple-700">{aiSuggestion.summary}</p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="category">{t('citizen.categoryLabel')} *</label>
                <select id="category" className="input" value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)} required>
                  <option value="">{t('citizen.selectCategory')}…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon ? `${c.icon} ` : ''}{c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">{t('citizen.urgencyLabel')}</label>
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
                      {t(`urgency.${u}`)}
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
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">2 · {t('citizen.locationLabel')}</h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="nr-province">{t('citizen.provinceLabel')} *</label>
              <select id="nr-province" className="input" value={form.provinceId} onChange={(e) => set('provinceId', e.target.value)} required>
                <option value="">{t('auth.selectProvince')}</option>
                {provinces.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="nr-district">{t('citizen.districtLabel')} *</label>
              <select id="nr-district" className="input" value={form.districtId} disabled={!form.provinceId} onChange={(e) => set('districtId', e.target.value)} required>
                <option value="">{t('auth.selectDistrict')}</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="nr-sector">{t('citizen.sectorLabel')}</label>
              <select id="nr-sector" className="input" value={form.sectorId} disabled={!form.districtId} onChange={(e) => set('sectorId', e.target.value)}>
                <option value="">{t('auth.selectSector')}</option>
                {sectors.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="label" htmlFor="locdesc">{t('citizen.locationDescriptionLabel')}</label>
            <input
              id="locdesc"
              className="input"
              placeholder={t('citizen.locationDescriptionPlaceholder')}
              value={form.locationDescription}
              onChange={(e) => set('locationDescription', e.target.value)}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="w-40">
              <label className="label" htmlFor="lat">{t('citizen.latitude')}</label>
              <input id="lat" className="input" value={form.latitude} onChange={(e) => set('latitude', e.target.value)} placeholder="-1.9441" />
            </div>
            <div className="w-40">
              <label className="label" htmlFor="lng">{t('citizen.longitude')}</label>
              <input id="lng" className="input" value={form.longitude} onChange={(e) => set('longitude', e.target.value)} placeholder="30.0619" />
            </div>
            <button type="button" className="btn-outline" onClick={handleUseMyLocation} disabled={locating}>
              {locating ? t('common.loading') : t('citizen.gpsAuto')}
              {!locating && <i className="fa-solid fa-location-dot ms-1" aria-hidden="true" />}
            </button>
          </div>
        </section>

        <hr className="border-slate-100" />

        {/* Step 3 — evidence */}
        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">3 · {t('citizen.evidence')}</h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label" htmlFor="report-photo">{t('citizen.evidenceLabel')}</label>
              <input
                id="report-photo"
                type="file"
                accept="image/*"
                capture="environment"
                className="input file:mr-3 file:rounded file:border-0 file:bg-rwanda-blue file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
                onChange={(e) => setPhotoName(e.target.files && e.target.files[0] ? e.target.files[0].name : '')}
              />
              {photoName && <p className="mt-2 text-xs text-slate-500">{t('citizen.evidence')}: {photoName}</p>}
            </div>

            <div>
              <label className="label" htmlFor="report-video">{t('citizen.evidenceLabel')}</label>
              <input
                id="report-video"
                type="file"
                accept="video/*"
                capture="environment"
                className="input file:mr-3 file:rounded file:border-0 file:bg-rwanda-green file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
                onChange={(e) => setVideoName(e.target.files && e.target.files[0] ? e.target.files[0].name : '')}
              />
              {videoName && <p className="mt-2 text-xs text-slate-500">{t('citizen.evidence')}: {videoName}</p>}
            </div>
          </div>
        </section>

        <hr className="border-slate-100" />

        {/* Step 4 — options */}
        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">4 · {t('common.actions')}</h2>
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-4">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={form.isAnonymous}
              onChange={(e) => set('isAnonymous', e.target.checked)}
            />
            <span className="text-sm">
              <strong className="text-slate-800">{t('citizen.anonymousLabel')}</strong>
              <span className="block text-slate-500">{t('citizen.anonymousHint')}</span>
            </span>
          </label>
        </section>

        {/* Submit */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-400">
            {selectedCategory?.nameRw ? selectedCategory.nameRw : t('citizen.reportSubmittedHint')}
          </p>
          <button type="submit" className="btn-primary px-6" disabled={busy}>
            {busy ? t('citizen.submitting') : t('citizen.submitReport')}
          </button>
        </div>
      </form>
    </div>
  );
}
