import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { aiApi, citizenApi, evidenceApi, workflowApi } from '../../lib/api';
import type { AIAnalysis, ChatMessage, ReportDetail as ReportData } from '../../types';
import { StatusBadge, UrgencyBadge, formatBytes, formatDateTime, timeAgo } from '../../lib/format';
import { Icon } from '../../components/icons';
import { Spinner, ErrorBox } from '../../components/ui';
import ReportMiniMap from '../../components/ReportMiniMap';
import { useAuth } from '../../context/AuthContext';

/** Citizen view of a single report — own-report only (server enforces). */
export default function ReportDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const justCreated = searchParams.get('created') === '1';

  const [report, setReport] = useState<ReportData | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceBusy, setEvidenceBusy] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  // Resolution review (spec §7): confirm with rating/feedback, or reject with a reason.
  const [confirmRating, setConfirmRating] = useState(0);
  const [confirmComment, setConfirmComment] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [reviewMsg, setReviewMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const isOfficer = user && ['OFFICER', 'DISTRICT_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'].includes(user.role);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      if (isOfficer) {
        const { report: r } = await workflowApi.report(id);
        setReport({
          id: r.id,
          reference: r.reference,
          title: r.title,
          description: r.description,
          status: r.status,
          urgency: r.urgency,
          categoryName: r.categoryName,
          categoryIcon: null,
          location: r.location,
          evidence: r.evidence,
          timeline: r.timeline,
          updates: r.updates,
          feedback: r.feedback,
          resolutionConfirmedAt: r.resolutionConfirmedAt ?? null,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          resolvedAt: null,
        } satisfies ReportData);
        setMessages(r.messages ?? []);
      } else {
        const [{ report: r }, { messages: m }] = await Promise.all([citizenApi.report(id), citizenApi.messages(id)]);
        setReport(r);
        setMessages(m);
      }
      setError('');
      try {
        const result = await aiApi.getReportAnalysis(Number(id));
        setAiAnalysis(result.analysis);
      } catch {
        setAiAnalysis(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [id, isOfficer]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !id) return;
    setSending(true);
    try {
      if (isOfficer) {
        await workflowApi.replyMessage(id, draft.trim());
      } else {
        await citizenApi.sendMessage(id, draft.trim());
      }
      setDraft('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send message');
    } finally {
      setSending(false);
    }
  }

  async function handleEvidenceUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!evidenceFile || !report) return;
    setEvidenceBusy(true);
    try {
      await evidenceApi.upload(report.id, evidenceFile);
      setEvidenceFile(null);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not upload evidence');
    } finally {
      setEvidenceBusy(false);
    }
  }

  async function handleEvidenceDelete(evidenceId: number) {
    if (!report || !window.confirm('Delete this evidence file? This cannot be undone.')) return;
    try {
      await evidenceApi.remove(report.id, evidenceId);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not delete evidence');
    }
  }

  async function handleConfirmResolution() {
    if (!report) return;
    setConfirmBusy(true);
    setReviewMsg(null);
    try {
      await workflowApi.confirmResolution(report.id, confirmRating || undefined, confirmComment.trim() || undefined);
      setReviewMsg({ ok: true, text: 'Thank you! The report is now closed and archived in your history.' });
      await load();
    } catch (reason) {
      setReviewMsg({ ok: false, text: reason instanceof Error ? reason.message : 'Could not confirm resolution' });
    } finally {
      setConfirmBusy(false);
    }
  }

  async function handleRejectResolution(e: React.FormEvent) {
    e.preventDefault();
    if (!report || !rejectReason.trim()) return;
    setConfirmBusy(true);
    setReviewMsg(null);
    try {
      await workflowApi.rejectResolution(report.id, rejectReason.trim());
      setReviewMsg({ ok: true, text: 'Report reopened — government staff have been notified and will reassign or continue the work.' });
      setRejectOpen(false);
      await load();
    } catch (reason) {
      setReviewMsg({ ok: false, text: reason instanceof Error ? reason.message : 'Could not reopen the report' });
    } finally {
      setConfirmBusy(false);
    }
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} />;
  if (!report) return null;

  const canReopen = ['RESOLVED', 'CLOSED'].includes(report.status) && !isOfficer;
  const isSolved = !isOfficer && ['RESOLVED', 'CLOSED'].includes(report.status) && !report.resolutionConfirmedAt;
  const lat = report.location.latitude != null ? Number(report.location.latitude) : null;
  const lng = report.location.longitude != null ? Number(report.location.longitude) : null;
  const hasCoords = lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng);

  return (
    <div className="mx-auto max-w-4xl">
      {justCreated && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <i className="fa-solid fa-circle-check" aria-hidden="true" /> Report submitted successfully! Reference: <strong>{report.reference}</strong>. We will notify you as it moves through review.
        </div>
      )}

      {/* Resolution review — confirm (§7 option A) or reject (§7 option B) */}
      {isSolved && (
        <div className="gov-card mb-6 overflow-hidden border-0 bg-gradient-to-r from-green-600 to-emerald-500 p-0 text-white">
          <div className="flex flex-wrap items-start gap-4 p-6">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-3xl" aria-hidden="true">🎉</span>
            <div className="min-w-64 flex-1">
              <h2 className="text-xl font-bold">Good news — your report has been resolved!</h2>
              <p className="mt-1 text-sm text-green-50">
                Government staff marked <strong>{report.reference}</strong> as solved{report.resolvedAt ? ` on ${formatDateTime(report.resolvedAt)}` : ''}. Please review the resolution below and tell us whether the problem is really fixed on the ground.
              </p>
              {reviewMsg && <div className={`mt-3 rounded-lg px-3 py-2 text-sm ${reviewMsg.ok ? 'bg-white text-green-800' : 'bg-red-100 text-red-800'}`}>{reviewMsg.text}</div>}
              <div className="mt-4 rounded-xl bg-white/10 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-green-50">Option A — Problem solved</p>
                <p className="mt-1 text-xs text-green-50">Optional: rate the service and leave feedback. Your confirmation closes and archives the report.</p>
                <div className="mt-2 flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" aria-label={`${n} star${n > 1 ? 's' : ''}`} className="text-2xl leading-none transition hover:scale-110" onClick={() => setConfirmRating((r) => (r === n ? 0 : n))}>
                      <span className={n <= confirmRating ? 'text-amber-300' : 'text-white/40'}>★</span>
                    </button>
                  ))}
                </div>
                <textarea className="mt-2 w-full rounded-lg border border-white/30 bg-white/10 p-2 text-sm text-white placeholder-green-100" rows={2} maxLength={1000} placeholder="Optional feedback (what was done well / what could improve)" value={confirmComment} onChange={(e) => setConfirmComment(e.target.value)} />
                <button className="mt-2 rounded-lg bg-white px-4 py-2 text-sm font-bold text-green-700 shadow-sm transition hover:bg-green-50 disabled:opacity-60" disabled={confirmBusy} onClick={handleConfirmResolution}>
                  {confirmBusy ? 'Saving…' : '✓ Problem Solved / Confirm Resolution'}
                </button>
              </div>
              <div className="mt-3 rounded-xl bg-white/10 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-green-50">Option B — Problem not solved</p>
                {!rejectOpen ? (
                  <>
                    <p className="mt-1 text-xs text-green-50">If the problem is not fixed, tell us why — the report returns to the system officer for reassignment or further work.</p>
                    <button className="mt-2 rounded-lg border border-white/40 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-60" disabled={confirmBusy} onClick={() => setRejectOpen(true)}>
                      Problem Not Solved
                    </button>
                  </>
                ) : (
                  <form className="mt-2" onSubmit={handleRejectResolution}>
                    <input className="w-full rounded-lg border border-white/30 bg-white/10 p-2 text-sm text-white placeholder-green-100" maxLength={1000} required placeholder="Example: The streetlight is still not working at night." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
                    <div className="mt-2 flex gap-2">
                      <button type="submit" className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-red-700 shadow-sm transition hover:bg-red-50 disabled:opacity-60" disabled={confirmBusy || !rejectReason.trim()}>Reopen report</button>
                      <button type="button" className="rounded-lg border border-white/40 bg-white/10 px-3 py-2 text-sm font-semibold text-white" onClick={() => { setRejectOpen(false); setRejectReason(''); }}>Cancel</button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {reviewMsg && !isSolved && (
        <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${reviewMsg.ok ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-700'}`}>{reviewMsg.text}</div>
      )}
      {isSolved && report.resolutionConfirmedAt && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <i className="fa-solid fa-circle-check" aria-hidden="true" /> <strong>Closed the loop:</strong> you confirmed this problem is solved on {formatDateTime(report.resolutionConfirmedAt)}. Thank you for helping verify government action!
        </div>
      )}

      {/* Header */}
      <div className="card mb-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{report.reference}</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{report.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={report.status} />
              <UrgencyBadge urgency={report.urgency} />
              <span className="badge bg-slate-100 text-slate-600">{report.categoryIcon ? `${report.categoryIcon} ` : ''}{report.categoryName}</span>
            </div>
          </div>
          {isOfficer && (
            <Link to={`/workflow/${report.id}`} className="btn-outline text-sm">
              Officer actions →
            </Link>
          )}
        </div>

        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{report.description}</p>

        {aiAnalysis ? (
          <div className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-bold text-indigo-900"><i className="fa-solid fa-robot" aria-hidden="true" /> AI decision support</h2>
              <Link to={`/ai/reports/${report.id}`} className="text-sm font-semibold text-indigo-700 hover:underline">View full analysis →</Link>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-indigo-600">Classification</p>
                <p className="mt-1 text-base font-semibold">{aiAnalysis.predictions.find((p) => p.predictionType === 'CATEGORY')?.predictionValue ?? 'Pending'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-indigo-600">Severity</p>
                <p className="mt-1 text-base font-semibold">{aiAnalysis.predictions.find((p) => p.predictionType === 'SEVERITY')?.predictionValue ?? 'Pending'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-indigo-600">Confidence</p>
                <p className="mt-1 text-base font-semibold">{Math.round((aiAnalysis.overallConfidence ?? 0) * 100)}%</p>
              </div>
            </div>
            {aiAnalysis.explanation && <p className="mt-3 text-indigo-700">{aiAnalysis.explanation}</p>}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <i className="fa-solid fa-robot" aria-hidden="true" /> AI analysis is being prepared for this report. <Link to={`/ai/reports/${report.id}`} className="font-semibold text-rwanda-blue hover:underline">Check the AI status</Link>
          </div>
        )}

        <dl className="mt-4 grid gap-x-8 gap-y-2 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2">
          <div className="flex gap-2">
            <dt className="text-slate-400">Location:</dt>
            <dd className="text-slate-700">
              {[report.location.sector, report.location.district, report.location.province].filter(Boolean).join(' / ') || '—'}
              {report.location.description ? ` — ${report.location.description}` : ''}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-slate-400">Submitted:</dt>
            <dd className="text-slate-700">{formatDateTime(report.createdAt)}</dd>
          </div>
          {report.resolvedAt && (
            <div className="flex gap-2">
              <dt className="text-slate-400">Resolved:</dt>
              <dd className="text-slate-700">{formatDateTime(report.resolvedAt)}</dd>
            </div>
          )}
        </dl>

        {hasCoords && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-700"><i className="fa-solid fa-location-dot" aria-hidden="true" /> Location on map</p>
              <Link to={`/map?reportId=${report.id}`} className="text-sm font-semibold text-rwanda-blue hover:underline">Open full map →</Link>
            </div>
            <ReportMiniMap latitude={lat as number} longitude={lng as number} title={report.title} reference={report.reference} />
            <p className="mt-2 text-xs text-slate-400">{lat?.toFixed(5)}, {lng?.toFixed(5)}</p>
          </div>
        )}

        {report.evidence.length > 0 && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="mb-2 text-sm font-semibold text-slate-700"><i className="fa-solid fa-paperclip" aria-hidden="true" /> Evidence ({report.evidence.length})</p>
            <ul className="flex flex-wrap gap-2">
              {report.evidence.map((ev) => (
                <li key={ev.id} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600">
                  <a href={evidenceApi.downloadUrl(report.id, ev.id)} className="hover:text-brand-primary hover:underline"><Icon name={ev.mimeType.startsWith('image/') ? 'fa-image' : 'fa-file-lines'} /> {ev.fileName}</a> <span className="text-slate-400">({formatBytes(ev.sizeBytes)})</span>
                  <button className="ml-2 text-slate-400 hover:text-red-600" aria-label={`Delete ${ev.fileName}`} title="Delete evidence" onClick={() => handleEvidenceDelete(ev.id)}>
                    <i className="fa-solid fa-trash-can" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <form onSubmit={handleEvidenceUpload} className="mt-4 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-64 flex-1"><label className="label" htmlFor="report-evidence">Add evidence</label><input id="report-evidence" type="file" className="input" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,video/mp4,video/webm,video/quicktime" onChange={(event) => setEvidenceFile(event.target.files?.[0] ?? null)} /></div>
            <button className="btn-outline" disabled={!evidenceFile || evidenceBusy}>{evidenceBusy ? 'Uploading…' : 'Upload evidence'}</button>
          </div>
          <p className="mt-1 text-xs text-slate-400">Images, PDF, text and video files up to 10 MB. Evidence is access-controlled.</p>
        </form>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Timeline */}
        <section className="card p-6">
          <h2 className="mb-4 font-bold text-slate-900">Progress timeline</h2>
          {report.timeline.length === 0 ? (
            <p className="text-sm text-slate-400">No history yet.</p>
          ) : (
            <ol className="relative space-y-5 border-l-2 border-slate-100 pl-5">
              {report.timeline.map((t) => (
                <li key={t.id} className="relative">
                  <span className="absolute -left-[27px] top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-rwanda-blue" />
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={t.toStatus} />
                    <span className="text-xs text-slate-400">{formatDateTime(t.createdAt)}</span>
                  </div>
                  {t.note && <p className="mt-1 text-sm text-slate-600">{t.note}</p>}
                  {t.actorName && <p className="text-xs text-slate-400">— {t.actorName}</p>}
                </li>
              ))}
            </ol>
          )}

          {/* Updates */}
          {report.updates.length > 0 && (
            <div className="mt-6 border-t border-slate-100 pt-4">
              <h3 className="mb-3 text-sm font-bold text-slate-900">Official updates</h3>
              <ul className="space-y-3">
                {report.updates.map((u) => (
                  <li key={u.id} className="rounded-lg bg-sky-50 p-3 text-sm">
                    <p className="text-slate-700">{u.message}</p>
                    <p className="mt-1 text-xs text-slate-400">{u.authorName ?? 'Government'} · {timeAgo(u.createdAt)}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Messages */}
        <section className="card flex flex-col p-6">
          <h2 className="mb-4 font-bold text-slate-900">Messages</h2>
          <div className="max-h-96 flex-1 space-y-3 overflow-y-auto">
            {messages.length === 0 ? (
              <p className="text-sm text-slate-400">No messages yet. Use the box below to ask about this report.</p>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${m.senderRole === 'CITIZEN' ? 'ml-auto bg-rwanda-blue text-white' : 'bg-slate-100 text-slate-700'}`}>
                  <p className="whitespace-pre-wrap">{m.message}</p>
                  <p className={`mt-1 text-[10px] ${m.senderRole === 'CITIZEN' ? 'text-sky-100' : 'text-slate-400'}`}>
                    {m.senderRole === 'CITIZEN' ? 'You' : 'Government'} · {timeAgo(m.createdAt)}
                  </p>
                </div>
              ))
            )}
          </div>
          <form onSubmit={handleSend} className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
            <input
              className="input"
              placeholder="Write a message…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={2000}
            />
            <button className="btn-primary" disabled={sending || !draft.trim()}>
              {sending ? '…' : 'Send'}
            </button>
          </form>
        </section>
      </div>

      {/* Feedback & reopen — citizen only, after resolution */}
      {!isOfficer && ['RESOLVED', 'CLOSED'].includes(report.status) && (
        <div id="reopen-section" className="mt-6 grid gap-6 lg:grid-cols-2">
          <FeedbackCard reportId={report.id} existing={report.feedback} onDone={load} />
          <ReopenCard reportId={report.id} visible={canReopen} onDone={load} />
        </div>
      )}
    </div>
  );
}

function FeedbackCard({ reportId, existing, onDone }: { reportId: number; existing: { rating: number; comment: string | null } | null; onDone: () => void }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (existing) {
    return (
      <div className="card p-6">
        <h2 className="font-bold text-slate-900">Your feedback</h2>
        <p className="mt-2 text-lg text-amber-500">{Array.from({ length: existing.rating }, (_, i) => <i key={`f${i}`} className="fa-solid fa-star" aria-hidden="true" />)}{Array.from({ length: 5 - existing.rating }, (_, i) => <i key={`e${i}`} className="fa-regular fa-star" aria-hidden="true" />)}</p>
        {existing.comment && <p className="mt-2 text-sm text-slate-600">“{existing.comment}”</p>}
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await citizenApi.feedback(reportId, rating, comment || undefined);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit feedback');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-6">
      <h2 className="font-bold text-slate-900">Rate the resolution</h2>
      <p className="mt-1 text-sm text-slate-500">How satisfied are you with how this problem was handled?</p>
      {error && <div className="mt-3"><ErrorBox message={error} /></div>}
      <div className="mt-3 flex gap-1 text-3xl">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" className={`transition-transform hover:scale-110 ${n <= rating ? 'text-amber-400' : 'text-slate-300'}`} onClick={() => setRating(n)}>
            <i className="fa-solid fa-star" aria-hidden="true" />
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="mt-3 space-y-3">
        <textarea
          className="input min-h-20"
          placeholder="Optional comment…"
          value={comment}
          maxLength={1000}
          onChange={(e) => setComment(e.target.value)}
        />
        <button className="btn-success" disabled={busy || rating < 1}>
          {busy ? 'Submitting…' : 'Submit feedback'}
        </button>
      </form>
    </div>
  );
}

function ReopenCard({ reportId, visible, onDone }: { reportId: number; visible: boolean; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  if (!visible) return null;
  if (done) {
    return (
      <div className="card p-6">
        <h2 className="font-bold text-slate-900">Reopen request</h2>
        <p className="mt-2 text-sm text-green-700"><i className="fa-solid fa-circle-check" aria-hidden="true" /> Your request was submitted. Government staff will review it.</p>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await citizenApi.reopen(reportId, reason.trim());
      setDone(true);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit request');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-6">
      <h2 className="font-bold text-slate-900">Problem not fixed?</h2>
      <p className="mt-1 text-sm text-slate-500">Request reopening — a government officer will review your explanation.</p>
      {error && <div className="mt-3"><ErrorBox message={error} /></div>}
      <form onSubmit={submit} className="mt-3 space-y-3">
        <textarea
          className="input min-h-20"
          placeholder="Explain what is still wrong…"
          value={reason}
          maxLength={500}
          onChange={(e) => setReason(e.target.value)}
          required
        />
        <button className="btn-danger" disabled={busy}>
          {busy ? 'Sending…' : 'Request reopen'}
        </button>
      </form>
    </div>
  );
}
