import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface ReportMiniMapProps {
  latitude: number;
  longitude: number;
  title: string;
  reference: string;
  /** Pixel height of the mini-map; defaults to 220. */
  height?: number;
}

/**
 * Small read-only map showing a single report location. Used on report
 * detail pages; the full interactive map lives at /map (deep-linkable via
 * /map?reportId=<id>).
 */
export default function ReportMiniMap({ latitude, longitude, title, reference, height = 220 }: ReportMiniMapProps) {
  return (
    <MapContainer
      center={[latitude, longitude]}
      zoom={15}
      scrollWheelZoom={false}
      className="w-full rounded-lg"
      style={{ height }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <CircleMarker
        center={[latitude, longitude]}
        radius={9}
        pathOptions={{ color: '#00A1DE', fillColor: '#00A1DE', fillOpacity: 0.6, weight: 2 }}
      >
        <Popup>
          <div className="text-sm">
            <p className="font-semibold">{title}</p>
            <p className="mt-0.5 text-xs text-slate-500">{reference}</p>
          </div>
        </Popup>
      </CircleMarker>
    </MapContainer>
  );
}
