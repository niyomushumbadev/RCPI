import { useState } from 'react';
import { Link } from 'react-router-dom';
import { trackApi } from '../../lib/api';
import type { PublicTrackedReport } from '../../lib/api';
import { StatusBadge, formatDateTime, timeAgo } from '../../lib/format';

// Stage ladder used for the visual progress bar.
const STAGES = ['SUBMITTED', 'VERIFIED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
const STAGE_LABEL: Record<string, string> = {
  SUBMITTED: 'Submitted',
  RECEIVED: 'Submitted',
  AI_ANALYSIS: 'AI review',
  PENDING_VERIFICATION: 'Verification',
  UNDER_REVIEW: 'Under review',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In progress',
  WAITING_CITIZEN: 'Awaiting you',
  WAITING_DEPARTMENT: 'Awaiting department',
  ESCALATED: 'Escalated',
  REOPEN_REQUESTED: 'Reopen requested',
  RESOLVED: 'Resolved',
  PENDING_CLOSURE: 'Pending closure',
  REOPENED: 'Reopened',
  CLOSED: 'Closed',
  ARCHIVED: 'Archived',
};

function stageIndex(status: string): number {
  if (status === 'REJECTED' || status === 'ARCHIVED') return -1;
  const known = ['SUBMITTED', 'RECEIVED', 'AI_ANALYSIS', 'PENDING_VERIFICATION', 'UNDER_REVIEW'];
  if (known.includes(status)) return 0;
  return Math.max(0, STAGES.indexOf(status as (typeof STAGES)[number]));
}

const URGENCY_STYLE: Record<string, string> = {
  HIGH: 'bg-red-50 text-red-700 border-red-200',
  MEDIUM: 'bg-amber-50 text-amber-700 border-amber-200',
  LOW: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export default function TrackReport() {
  const [reference, setReference] = useState('');
  const [report, setReport] = useState<PublicTrackedReport | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState('');

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    const value = reference.trim();
    if (!value) return;
    setBusy(true);
    setError('');
    setReport(null);
    setSearched(value);
    try {
      const { report: r } = await trackApi.lookup(value);
      setReport(r);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Lookup failed');
    } finally {
      setBusy(false);
    }
  }

  const current = report ? stageIndex(report.status) : -1;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <div className="gov-strip" />

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link to="/" className="text-sm font-black uppercase tracking-[0.14em] text-rwanda-green">← R-CPI home</Link>
          <Link to="/login" className="btn-outline !py-1.5 text-xs">Sign in</Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pb-16 pt-10">
        <section className="text-center">
          <span className="gov-badge">Public service tracker</span>
          <h1 className="mt-4 text-3xl font-black text-slate-900 sm:text-4xl">Track a community report</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
            Enter the reference number you received when reporting (for example <strong>RCP-2026-000012</strong>) to see
            where the report stands. No account needed. Personal details are never shown.
          </p>
        </section>

        <form onSubmit={lookup} className="mx-auto mt-6 flex max-w-xl gap-2">
          <input
            className="input flex-1 uppercase"
            placeholder="RCP-2026-000012"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            aria-label="Report reference number"
            maxLength={20}
          />
          <button className="btn-primary" disabled={busy || !reference.trim()}>
            {busy ? 'Searching…' : 'Track'}
          </button>
        </form>

        {error && (
          <div className="mx-auto mt-4 max-w-xl rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        )}

        {report && (
          <section className="mt-8 space-y-6 text-left">
            {/* Header card */}
            <div className="gov-card p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{report.reference}</p>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">{report.categoryIcon ? `${report.categoryIcon} ` : ''}{report.title}</h2>
                  <p className="mt-1 text-sm text-slate-500">{report.categoryName} · {report.location}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StatusBadge status={report.status as never} />
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${URGENCY_STYLE[report.urgency] ?? URGENCY_STYLE.MEDIUM}`}>
                    {report.urgency} urgency
                  </span>
                </div>
              </div>

              {/* Progress ladder */}
              {current >= 0 && (
                <div className="mt-6">
                  <div className="flex items-center">
                    {STAGES.map((stage, index) => (
                      <div key={stage} className={`flex items-center ${index < STAGES.length - 1 ? 'flex-1' : ''}`}>
                        <div className="flex flex-col items-center">
                          <span
                            className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-[10px] font-black ${
                              index < current ? 'border-rwanda-green bg-rwanda-green text-white' : index === current ? 'border-rwanda-blue bg-rwanda-blue text-white' : 'border-slate-200 bg-white text-slate-300'
                            }`}
                          >
                            {index < current ? '✓' : index + 1}
                          </span>
                          <span className={`mt-1 hidden text-[9px] font-semibold uppercase tracking-wide sm:block ${index <= current ? 'text-slate-700' : 'text-slate-400'}`}>
                            {STAGE_LABEL[stage]}
                          </span>
                        </div>
                        {index < STAGES.length - 1 && (
                          <div className={`mx-1 h-0.5 flex-1 ${index < current ? 'bg-rwanda-green' : 'bg-slate-200'}`} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {report.status === 'REJECTED' && (
                <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">This report was reviewed and did not proceed. See the timeline below for the official explanation.</p>
              )}

              <dl className="mt-6 grid gap-x-8 gap-y-2 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2">
                <div className="flex gap-2"><dt className="text-slate-400">Submitted:</dt><dd className="text-slate-700">{formatDateTime(report.createdAt)}</dd></div>
                {report.resolvedAt && <div className="flex gap-2"><dt className="text-slate-400">Resolved:</dt><dd className="text-slate-700">{formatDateTime(report.resolvedAt)}</dd></div>}
                {report.department && <div className="flex gap-2"><dt className="text-slate-400">Handling department:</dt><dd className="text-slate-700">{report.department}</dd></div>}
                {report.deadline && <div className="flex gap-2"><dt className="text-slate-400">Service deadline:</dt><dd className="text-slate-700">{formatDateTime(report.deadline)}</dd></div>}
              </dl>

              <p className="mt-4 border-t border-slate-100 pt-4 text-sm leading-6 text-slate-600">{report.description}</p>
            </div>

            {/* Official updates */}
            {report.updates.length > 0 && (
              <div className="gov-card p-6">
                <h3 className="font-bold text-slate-900">Official updates</h3>
                <ul className="mt-3 space-y-3">
                  {report.updates.map((u, index) => (
                    <li key={index} className="rounded-lg bg-sky-50 p-3 text-sm">
                      <p className="text-slate-700">{u.message}</p>
                      <p className="mt-1 text-xs text-slate-400">{timeAgo(u.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Timeline */}
            <div className="gov-card p-6">
              <h3 className="font-bold text-slate-900">Progress timeline</h3>
              {report.timeline.length === 0 ? (
                <p className="mt-2 text-sm text-slate-400">No history recorded yet.</p>
              ) : (
                <ol className="relative mt-4 space-y-5 border-l-2 border-slate-100 pl-5">
                  {report.timeline.map((t, index) => (
                    <li key={index} className="relative">
                      <span className="absolute -left-[27px] top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-rwanda-blue" />
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={t.toStatus as never} />
                        <span className="text-xs text-slate-400">{formatDateTime(t.createdAt)}</span>
                      </div>
                      {t.note && <p className="mt-1 text-sm text-slate-600">{t.note}</p>}
                      {t.actorName && <p className="text-xs text-slate-400">— {t.actorName}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <p className="text-center text-xs text-slate-400">
              This is a public status view. Reporters with an account can sign in to add messages and evidence.
            </p>
          </section>
        )}

        {searched && !report && !error && !busy && (
          <p className="mt-8 text-center text-sm text-slate-400">Nothing to show yet.</p>
        )}
      </main>
    </div>
  );
}
