import { formatDateTime } from '../../lib/format';
import type { TimelineEntry } from '../../types';

export function ReportTimeline({ timeline }: { timeline: TimelineEntry[] }) {
  if (!timeline.length) return <p className="text-sm text-slate-400">No history yet.</p>;
  return (
    <ol className="relative space-y-4 border-l-2 border-slate-100 pl-5">
      {timeline.map((t) => (
        <li key={t.id} className="relative">
          <span className="absolute -left-[27px] top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-slate-400" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-700">
              {t.fromStatus ? `${t.fromStatus.replace(/_/g, ' ')} → ` : ''}{t.toStatus.replace(/_/g, ' ')}
            </span>
            <span className="text-xs text-slate-400">{formatDateTime(t.createdAt)}</span>
          </div>
          {t.note && <p className="mt-0.5 text-sm text-slate-500">{t.note}</p>}
          {t.actorName && <p className="text-xs text-slate-400">— {t.actorName}</p>}
        </li>
      ))}
    </ol>
  );
}
