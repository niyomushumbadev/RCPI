import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
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
  const [problems, setProblems] = useState<MapProblem[]>([]);
  const [nearby, setNearby] = useState<NearbyProblem[] | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    citizenApi
      .mapProblems()
      .then((r) => setProblems(r.problems))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load map data'))
      .finally(() => setLoading(false));
  }, []);

  const points = useMemo(() => problems.filter((p) => p.latitude != null && p.longitude != null), [problems]);

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
    <div>
      <PageHeader
        title="Community map"
        subtitle="Verified and resolved problems across Rwanda. Citizen identities are never shown."
        actions={
          <button className="btn-outline" onClick={findNearby} disabled={locating}>
            {locating ? 'Locating…' : '📍 Find problems near me'}
          </button>
        }
      />

      {error && <div className="mb-4"><ErrorBox message={error} /></div>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card overflow-hidden lg:col-span-2">
          <MapContainer center={RWANDA_CENTER} zoom={8} className="h-[480px] w-full" scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {points.map((p) => (
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
          {points.length === 0 && (
            <p className="p-4 text-center text-sm text-slate-400">No mapped problems yet — reports with coordinates appear here once verified.</p>
          )}
        </div>

        {/* Nearby list */}
        <div className="card p-5">
          <h2 className="mb-3 font-bold text-slate-900">Near you (10 km)</h2>
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
        </div>
      </div>
    </div>
  );
}
