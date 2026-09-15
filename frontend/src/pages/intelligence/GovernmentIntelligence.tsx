import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import 'leaflet/dist/leaflet.css';
import { intelligenceApi } from '../../lib/api';
import type { IntelligenceDashboard, IntelligenceSearchResult } from '../../types';
import { PageHeader, ErrorBox, Spinner, StatCard } from '../../components/ui';
import { StatusBadge, timeAgo } from '../../lib/format';

const RWANDA_CENTER: [number, number] = [-1.9499, 30.0588];
const riskColor: Record<string, string> = { CRITICAL: '#dc2626', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#16a34a' };

export default function GovernmentIntelligence() {
  const [data, setData] = useState<IntelligenceDashboard | null>(null);
  const [results, setResults] = useState<IntelligenceSearchResult[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const [category, setCategory] = useState('ALL');
  const [risk, setRisk] = useState('ALL');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    intelligenceApi.dashboard()
      .then((dashboard) => { setData(dashboard); setResults(dashboard.recent); })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Failed to load government intelligence'))
      .finally(() => setLoading(false));
  }, []);

  async function search() {
    try {
      const result = await intelligenceApi.search({ q: query || undefined, status: status === 'ALL' ? undefined : status });
      setResults(result.reports);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Search failed');
    }
  }

  function exportCsv() {
    const token = localStorage.getItem('rcpi_access_token');
    fetch('/api/v1/intelligence/reports/export.csv', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(async (response) => { if (!response.ok) throw new Error('Could not export the report'); return response.blob(); })
      .then((blob) => { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'rcpi-reports.csv'; link.click(); URL.revokeObjectURL(url); })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not export the report'));
  }

  const categoryChart = useMemo(() => data?.byCategory.slice(0, 8).map((item) => ({ name: item.label.length > 14 ? `${item.label.slice(0, 14)}...` : item.label, reports: item.count })) ?? [], [data]);
  const visiblePoints = useMemo(() => (data?.points ?? []).filter((point) => (status === 'ALL' || point.status === status) && (category === 'ALL' || point.category === category) && (risk === 'ALL' || point.priority.status === risk)), [category, data?.points, risk, status]);
  if (loading) return <Spinner label="Loading GIS and intelligence…" />;
  if (error && !data) return <ErrorBox message={error} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <PageHeader title="Government GIS & intelligence" subtitle="National, province, district and sector decision support from live report data." actions={<div className="flex flex-wrap gap-2"><Link to="/workflow" className="btn-outline">Workflow queue</Link><button className="btn-primary" onClick={exportCsv}>Download CSV</button></div>} />
      {error && <ErrorBox message={error} />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="📋" label="All reports" value={data.stats.total} tone="blue" />
        <StatCard icon="🚨" label="Critical priority" value={data.stats.critical} tone="red" />
        <StatCard icon="✅" label="Resolution rate" value={`${data.stats.resolutionRate}%`} tone="green" />
        <StatCard icon="📍" label="Mapped reports" value={data.stats.mapped} tone="amber" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.8fr_1fr]">
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5"><div><h2 className="font-bold text-slate-900">Rwanda risk map</h2><p className="mt-1 text-xs text-slate-500">Markers show report priority. Province, district, sector and cell filters are represented by each marker's location hierarchy.</p></div><div className="flex flex-wrap gap-2"><select className="input !w-36 !py-1.5 text-xs" value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">All statuses</option>{[...new Set(data.points.map((point) => point.status))].map((value) => <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>)}</select><select className="input !w-36 !py-1.5 text-xs" value={category} onChange={(event) => setCategory(event.target.value)}><option value="ALL">All categories</option>{data.byCategory.map((item) => <option key={item.label} value={item.label}>{item.label}</option>)}</select><select className="input !w-32 !py-1.5 text-xs" value={risk} onChange={(event) => setRisk(event.target.value)}><option value="ALL">All risks</option>{Object.keys(riskColor).map((value) => <option key={value} value={value}>{value}</option>)}</select></div></div>
          <MapContainer center={RWANDA_CENTER} zoom={8} className="h-[460px] w-full" scrollWheelZoom>
            <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {visiblePoints.map((point) => <CircleMarker key={point.id} center={[point.latitude, point.longitude]} radius={Math.max(6, Math.min(14, point.priority.score / 8))} pathOptions={{ color: riskColor[point.priority.status] ?? '#2563eb', fillColor: riskColor[point.priority.status] ?? '#2563eb', fillOpacity: 0.7 }}><Popup><div className="text-sm"><strong>{point.title}</strong><p>{point.reference} · {point.province} / {point.district}{point.sector ? ` / ${point.sector}` : ''}</p><p className="font-semibold">Priority {point.priority.score}/100 · {point.priority.status}</p><Link className="text-blue-700" to={`/workflow/${point.id}`}>Open report</Link></div></Popup></CircleMarker>)}
          </MapContainer>
        </section>

        <section className="card p-5"><h2 className="font-bold text-slate-900">Critical problems</h2><p className="mt-1 text-xs text-slate-500">Priority combines urgency, age, unresolved status, mapping and AI severity signals.</p><div className="mt-4 space-y-2">{data.critical.length ? data.critical.map((item) => <Link key={item.id} to={`/workflow/${item.id}`} className="block rounded-lg border border-red-100 bg-red-50 p-3 hover:border-red-300"><div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold text-slate-800">{item.title}</span><span className="font-bold text-red-700">{item.priority.score}</span></div><p className="mt-1 text-xs text-slate-500">{item.reference} · {item.category} · {item.district}</p></Link>) : <p className="text-sm text-slate-500">No critical problems in the current data.</p>}</div></section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2"><section className="card p-5"><h2 className="font-bold text-slate-900">Problem categories</h2><div className="mt-4 h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={categoryChart} layout="vertical" margin={{ left: 8, right: 12 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis dataKey="name" type="category" width={105} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="reports" fill="#0067b1" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div></section><section className="card p-5"><h2 className="font-bold text-slate-900">Prediction outlook</h2><p className="mt-1 text-xs text-slate-500">Transparent baseline projections from observed report concentration. They support review and do not make government decisions.</p><div className="mt-4 space-y-3">{data.predictions.map((prediction) => <div key={prediction.subject} className="rounded-lg border border-slate-200 p-3"><div className="flex justify-between gap-2"><strong className="text-sm text-slate-800">{prediction.subject}</strong><span className="text-xs font-semibold text-amber-700">{prediction.outlook}</span></div><p className="mt-1 text-xs text-slate-500">{prediction.basis} · {Math.round(prediction.confidence * 100)}% confidence</p></div>)}</div></section></div>

      <section className="card p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-slate-900">Search and filter reports</h2><p className="mt-1 text-xs text-slate-500">Search by reference, title or description and filter the operational queue by status.</p></div><div className="flex flex-wrap gap-2"><input className="input !w-56" placeholder="Reference or keyword" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void search(); }} /><select className="input !w-40" value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">All statuses</option><option value="SUBMITTED">Submitted</option><option value="UNDER_REVIEW">Under review</option><option value="IN_PROGRESS">In progress</option><option value="RESOLVED">Resolved</option><option value="CLOSED">Closed</option></select><button className="btn-outline" onClick={() => void search()}>Search</button></div></div><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400"><th className="px-3 py-2">Report</th><th className="px-3 py-2">Location</th><th className="px-3 py-2">Priority</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Age</th></tr></thead><tbody className="divide-y divide-slate-100">{results.map((item) => <tr key={item.id}><td className="px-3 py-3"><Link to={`/workflow/${item.id}`} className="font-semibold text-rwanda-blue hover:underline">{item.title}</Link><p className="text-xs text-slate-400">{item.reference} · {item.category}</p></td><td className="px-3 py-3 text-slate-600">{item.district}</td><td className="px-3 py-3"><span className="font-bold text-slate-800">{item.priority.score}/100</span><span className="ml-2 text-xs text-slate-500">{item.priority.status}</span></td><td className="px-3 py-3"><StatusBadge status={item.status as never} /></td><td className="px-3 py-3 text-xs text-slate-400">{timeAgo(item.updatedAt)}</td></tr>)}</tbody></table>{results.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No reports match these filters.</p>}</div></section>
    </div>
  );
}