import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, GeoJSON } from 'react-leaflet';
import type { GeoJsonObject } from 'geojson';
import { useNavigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import { citizenApi } from '../lib/api';
import type { MapProblem, NearbyProblem } from '../types';
import { StatusBadge, timeAgo } from '../lib/format';
import { PageHeader, Spinner, ErrorBox, EmptyState } from '../components/ui';

// Center of Rwanda
const RWANDA_CENTER: [number, number] = [-1.9499, 30.0588];

const STATUS_COLOR: Record<string, string> = {
  VERIFIED: '#f59e0b',
  ASSIGNED: '#6366f1',
  IN_PROGRESS: '#3b82f6',
  RESOLVED: '#22c55e',
  CLOSED: '#94a3b8',
};

export default function CommunityMap() {
  const navigate = useNavigate();
  const [problems, setProblems] = useState<MapProblem[]>([]);
  const [nearby, setNearby] = useState<NearbyProblem[] | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [rwandaBoundary, setRwandaBoundary] = useState<GeoJsonObject | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  useEffect(() => {
    citizenApi
      .mapProblems()
      .then((r) => setProblems(r.problems))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load map data'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch('/data/rwanda.geo.json')
      .then((response) => response.json() as Promise<GeoJsonObject>)
      .then(setRwandaBoundary)
      .catch(() => setRwandaBoundary(null));
  }, []);

  const points = useMemo(() => problems.filter((p) => p.latitude != null && p.longitude != null), [problems]);
  const categories = useMemo(() => [...new Set(points.map((point) => point.categoryName))].sort(), [points]);
  const filteredPoints = useMemo(() => points.filter((point) => {
    const matchesSearch = !search.trim() || `${point.title} ${point.reference} ${point.district} ${point.categoryName}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (statusFilter === 'ALL' || point.status === statusFilter) && (categoryFilter === 'ALL' || point.categoryName === categoryFilter);
  }), [categoryFilter, points, search, statusFilter]);

  function findNearby() {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { problems: near } = await citizenApi.nearby(pos.coords.latitude, pos.coords.longitude, 10);
          setNearby(near);
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Could not find nearby problems');
        } finally {
          setLocating(false);
        }
      },
      () => {
        setError('Could not get your location. Allow location access and try again.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  if (loading) return <Spinner />;
  if (error && points.length === 0) return <ErrorBox message={error} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Community map"
        subtitle="Verified and resolved problems across Rwanda. Citizen identities are never shown."
        actions={
          <div className="flex flex-wrap gap-2">
            <button className="btn-outline" onClick={() => navigate(-1)} aria-label="Go back">
              ← Back
            </button>
            <button className="btn-outline" onClick={findNearby} disabled={locating}>
              {locating ? 'Locating…' : '📍 Find problems near me'}
            </button>
          </div>
        }
      />

      {error && <div className="mb-4"><ErrorBox message={error} /></div>}

      <section className="rounded-2xl border border-blue-100 bg-slate-900 p-5 text-white shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-rwanda-yellow">Public geographic view</p><h2 className="mt-2 text-2xl font-black">Rwanda community problem map</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Explore verified public issues across Rwanda. Citizen identities and private report details are never shown.</p></div><div className="grid grid-cols-2 gap-2 text-center text-xs"><div className="rounded-xl bg-white/10 px-4 py-3"><p className="text-xl font-black text-white">{points.length}</p><p className="text-slate-300">mapped issues</p></div><div className="rounded-xl bg-white/10 px-4 py-3"><p className="text-xl font-black text-white">30</p><p className="text-slate-300">km search radius</p></div></div></div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1.4fr_0.7fr_0.7fr_auto]">
          <input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search report, district or category" aria-label="Search public map" />
          <select className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by status"><option value="ALL">All statuses</option>{[...new Set(points.map((point) => point.status))].map((status) => <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>)}</select>
          <select className="input" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filter by category"><option value="ALL">All categories</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select>
          <button className="btn-outline" onClick={() => { setSearch(''); setStatusFilter('ALL'); setCategoryFilter('ALL'); }}>Reset</button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500"><span className="rounded-full bg-slate-100 px-3 py-1">Showing {filteredPoints.length} of {points.length} mapped problems</span><span className="rounded-full bg-slate-100 px-3 py-1">Public and privacy-filtered</span></div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.65fr_0.8fr]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h2 className="font-bold text-slate-900">Live Rwanda map</h2><p className="mt-1 text-xs text-slate-500">Blue boundary shows the national outline. Markers show public problems.</p></div><div className="flex items-center gap-2 text-xs text-slate-500"><span className="h-3 w-3 rounded-full bg-rwanda-blue" /> Rwanda boundary <span className="ml-2 h-3 w-3 rounded-full bg-rwanda-yellow" /> Problem</div></div>
          <MapContainer center={RWANDA_CENTER} zoom={8} className="h-[520px] w-full" scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {rwandaBoundary && <GeoJSON data={rwandaBoundary} style={{ color: '#0067b1', weight: 3, fillColor: '#0067b1', fillOpacity: 0.08 }} />}
            {filteredPoints.map((p) => (
              <CircleMarker
                key={p.id}
                center={[p.latitude as number, p.longitude as number]}
                radius={8}
                pathOptions={{ color: p.categoryColor ?? STATUS_COLOR[p.status] ?? '#00A1DE', fillOpacity: 0.7 }}
              >
                <Popup>
                  <div className="text-sm">
                    <p className="font-semibold">{p.categoryIcon ? `${p.categoryIcon} ` : ''}{p.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{p.reference} · {p.district}</p>
                    <div className="mt-1"><StatusBadge status={p.status} /></div>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
          {filteredPoints.length === 0 && (
            <p className="p-4 text-center text-sm text-slate-400">{points.length === 0 ? 'No mapped problems yet — reports with coordinates appear here once verified.' : 'No public problems match the current search and filters.'}</p>
          )}
        </section>

        {/* Nearby list */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4"><p className="text-xs font-bold uppercase tracking-[0.16em] text-rwanda-blue">Location search</p><h2 className="mt-1 font-bold text-slate-900">Problems near you</h2><p className="mt-1 text-sm text-slate-500">Use your location to find public issues within 10 km.</p></div>
          {nearby === null ? (
            <p className="text-sm text-slate-400">Click “Find problems near me” to see verified issues within 10 km of your position.</p>
          ) : nearby.length === 0 ? (
            <EmptyState icon="🎉" title="Nothing nearby" hint="No verified problems within 10 km. Your neighbourhood looks good!" />
          ) : (
            <ul className="max-h-[420px] space-y-2 overflow-y-auto">
              {nearby.map((n) => (
                <li key={n.id} className="rounded-lg border border-slate-100 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800">{n.categoryIcon ?? '📌'} {n.title}</p>
                    <span className="shrink-0 text-xs font-medium text-rwanda-blue">{n.distanceKm} km</span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">{n.categoryName} · {n.district} · {timeAgo(n.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
