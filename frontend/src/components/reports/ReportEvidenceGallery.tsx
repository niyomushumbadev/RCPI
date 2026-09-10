import { formatBytes, formatDateTime } from '../../lib/format';

export interface EvidenceItem { id: number; fileName: string; mimeType: string; sizeBytes: number; uploadedAt?: string }

export function ReportEvidenceGallery({ evidence }: { evidence: EvidenceItem[] }) {
  if (!evidence.length) return <p className="text-sm text-slate-400">No evidence attached yet.</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {evidence.map((e) => (
        <div key={e.id} className="rounded-lg border border-slate-200 p-3">
          <p className="truncate text-sm font-medium text-slate-800" title={e.fileName}>
            {e.mimeType.startsWith('image/') ? '🖼️ ' : e.mimeType.startsWith('video/') ? '🎬 ' : '📄 '}{e.fileName}
          </p>
          <p className="mt-1 text-xs text-slate-400">{e.mimeType} · {formatBytes(e.sizeBytes)}</p>
          {e.uploadedAt && <p className="text-xs text-slate-400">{formatDateTime(e.uploadedAt)}</p>}
        </div>
      ))}
    </div>
  );
}
