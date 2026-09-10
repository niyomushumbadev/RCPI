import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { citizenApi, workflowApi } from '../lib/api';
import type { ChatMessage, ReportDetail as ReportData } from '../types';
import { StatusBadge, UrgencyBadge, formatBytes, formatDateTime, timeAgo } from '../lib/format';
import { Spinner, ErrorBox } from '../components/ui';
import { useAuth } from '../context/AuthContext';

/** Citizen view of a single report — own-report only (server enforces). */
export default function ReportDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const justCreated = searchParams.get('created') === '1';

  const [report, setReport] = useState<ReportData | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

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

  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} />;
  if (!report) return null;

  const canReopen = ['RESOLVED', 'CLOSED'].includes(report.status) && !isOfficer;

  return (
    <div className="mx-auto max-w-4xl">
      {justCreated && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          ✅ Report submitted successfully! Reference: <strong>{report.reference}</strong>. We will notify you as it moves through review.
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

        {report.evidence.length > 0 && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="mb-2 text-sm font-semibold text-slate-700">📎 Evidence ({report.evidence.length})</p>
            <ul className="flex flex-wrap gap-2">
              {report.evidence.map((ev) => (
                <li key={ev.id} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600">
                  {ev.mimeType.startsWith('image/') ? '🖼️' : '📄'} {ev.fileName} <span className="text-slate-400">({formatBytes(ev.sizeBytes)})</span>
                </li>
              ))}
            </ul>
          </div>
        )}
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
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
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
        <p className="mt-2 text-lg text-amber-500">{'★'.repeat(existing.rating)}{'☆'.repeat(5 - existing.rating)}</p>
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
            ★
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
        <p className="mt-2 text-sm text-green-700">✅ Your request was submitted. Government staff will review it.</p>
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
