import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { StatusBadge } from '../../lib/format';

export interface ReportMapPoint { id: number; reference: string; title: string; status: string; district: string; latitude: number | null; longitude: number | null }

export function ReportMap({ points }: { points: ReportMapPoint[] }) {
  const valid = points.filter((p) => p.latitude != null && p.longitude != null);
  return (
    <MapContainer center={[-1.9499, 30.0588]} zoom={8} className="h-[380px] w-full" scrollWheelZoom>
      <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {valid.map((p) => (
        <CircleMarker key={p.id} center={[p.latitude as number, p.longitude as number]} radius={8} pathOptions={{ fillOpacity: 0.7 }}>
          <Popup>
            <div className="text-sm">
              <p className="font-semibold">{p.title}</p>
              <p className="mt-0.5 text-xs text-slate-500">{p.reference} · {p.district}</p>
              <div className="mt-1"><StatusBadge status={p.status} /></div>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
