import { useEffect, useState } from 'react';
import { GeoJSON, MapContainer, TileLayer } from 'react-leaflet';
import type { GeoJsonObject } from 'geojson';
import 'leaflet/dist/leaflet.css';

const RWANDA_CENTER: [number, number] = [-1.9499, 30.0588];

export default function RwandaFooterMap() {
  const [boundary, setBoundary] = useState<GeoJsonObject | null>(null);

  useEffect(() => {
    fetch('/data/rwanda.geo.json')
      .then((response) => response.json() as Promise<GeoJsonObject>)
      .then(setBoundary)
      .catch(() => setBoundary(null));
  }, []);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-lg">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-rwanda-yellow">Service coverage</p><p className="mt-1 text-sm font-semibold text-white">Rwanda on the map</p></div>
        <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold text-blue-100">OpenStreetMap</span>
      </div>
      <MapContainer center={RWANDA_CENTER} zoom={7} zoomControl={false} dragging={false} doubleClickZoom={false} scrollWheelZoom={false} touchZoom={false} className="h-40 w-full">
        <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {boundary && <GeoJSON data={boundary} style={{ color: '#f8d34f', weight: 2, fillColor: '#0067b1', fillOpacity: 0.25 }} />}
      </MapContainer>
      <p className="px-4 py-3 text-xs leading-5 text-slate-400">Public reports and service activity are organized across Rwanda&apos;s provinces, districts and sectors.</p>
    </div>
  );
}