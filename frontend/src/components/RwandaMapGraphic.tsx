import { useEffect, useState } from 'react';

type Coordinate = [number, number];
type Boundary = { geometry?: { coordinates?: Coordinate[][] } };

export default function RwandaMapGraphic() {
  const [boundary, setBoundary] = useState<Coordinate[] | null>(null);

  useEffect(() => {
    fetch('/data/rwanda.geo.json')
      .then((response) => response.json() as Promise<{ features?: Boundary[] }>)
      .then((data) => setBoundary(data.features?.[0]?.geometry?.coordinates?.[0] ?? null))
      .catch(() => setBoundary(null));
  }, []);

  const points = boundary ?? [[29.02, -2.84], [29.63, -2.92], [30.82, -1.7], [30.42, -1.13], [29.58, -1.34]] as Coordinate[];
  const longitudes = points.map(([longitude]) => longitude);
  const latitudes = points.map(([, latitude]) => latitude);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const path = points.map(([longitude, latitude], index) => {
    const x = 20 + ((longitude - minLongitude) / (maxLongitude - minLongitude)) * 180;
    const y = 12 + ((maxLatitude - latitude) / (maxLatitude - minLatitude)) * 126;
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ') + ' Z';

  return (
    <div className="relative h-36 w-48" aria-label="Map of Rwanda" role="img">
      <svg viewBox="0 0 220 150" className="h-full w-full" aria-hidden="true">
        <path
          d={path}
          fill="#0067b1"
          opacity="0.95"
        />
        <g fill="#f8d34f" stroke="#fff" strokeWidth="2">
          <circle cx="112" cy="43" r="4" /><circle cx="145" cy="63" r="4" /><circle cx="102" cy="84" r="4" />
          <circle cx="64" cy="82" r="4" /><circle cx="151" cy="98" r="4" /><circle cx="91" cy="112" r="4" />
        </g>
      </svg>
      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-blue-100">Rwanda</span>
    </div>
  );
}