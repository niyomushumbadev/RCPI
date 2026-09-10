import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { metaApi, workflowApi } from '../lib/api';
import type { Department, WorkflowReportDetail } from '../types';
import { StatusBadge, UrgencyBadge, formatDateTime, timeAgo } from '../lib/format';
import { Spinner, ErrorBox } from '../components/ui';
import { useAuth } from '../context/AuthContext';

export default function WorkflowReportDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [report, setReport] = useState<WorkflowReportDetail | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // transition form state
  const [targetStatus, setTargetStatus] = useState('');
  const [note, setNote] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [transitionBusy, setTransitionBusy] = useState(false);
  const [transitionError, setTransitionError] = useState('');

  // update/message state
  const [updateMsg, setUpdateMsg] = useState('');
  const [chatMsg, setChatMsg] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const { report: r } = await workflowApi.report(id);
      setReport(r);
      setTargetStatus('');
      setNote('');
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    load();
    metaApi.departments().then((r) => setDepartments(r.departments)).catch(() => {});
  }, [load]);

  async function handleTransition(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !targetStatus) return;
    setTransitionBusy(true);
    setTransitionError('');
    try {
      await workflowApi.transition(id, targetStatus, note || undefined, departmentId ? Number(departmentId) : undefined);
      await load();
    } catch (err) {
      setTransitionError(err instanceof Error ? err.message : 'Transition failed');
    } finally {
      setTransitionBusy(false);
    }
  }

  async function postUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !updateMsg.trim()) return;
    setActionBusy(true);
    setActionMsg('');
    try {
      await workflowApi.postUpdate(id, updateMsg.trim());
      setUpdateMsg('');
      await load();
      setActionMsg('✅ Update posted — the citizen has been notified.');
    } catch (err) {
      setActionMsg(err instanceof Error ? `⚠️ ${err.message}` : '⚠️ Could not post update');
    } finally {
      setActionBusy(false);
    }
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !chatMsg.trim()) return;
    setActionBusy(true);
    setActionMsg('');
    try {
      await workflowApi.replyMessage(id, chatMsg.trim());
      setChatMsg('');
      await load();
      setActionMsg('✅ Message sent to the citizen.');
    } catch (err) {
      setActionMsg(err instanceof Error ? `⚠️ ${err.message}` : '⚠️ Could not send message');
    } finally {
      setActionBusy(false);
    }
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} />;
  if (!report) return null;

  const needsDepartment = targetStatus === 'ASSIGNED';

  return (
    <div className="mx-auto max-w-5xl">
      <Link to="/workflow/reports" className="mb-3 inline-block text-sm text-rwanda-blue hover:underline">← Back to queue</Link>

      {/* Header */}
      <div className="card mb-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{report.reference}</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{report.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={report.status} />
              <UrgencyBadge urgency={report.urgency} />
              <span className="badge bg-slate-100 text-slate-600">{report.categoryName}</span>
              {report.isAnonymous && <span className="badge bg-slate-100 text-slate-500">🕶️ Anonymous</span>}
            </div>
          </div>
          <div className="text-right text-sm text-slate-500">
            <p>Submitted {formatDateTime(report.createdAt)}</p>
            <p>Updated {timeAgo(report.updatedAt)}</p>
          </div>
        </div>

        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{report.description}</p>

        <dl className="mt-4 grid gap-x-8 gap-y-2 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2">
          <div className="flex gap-2">
            <dt className="text-slate-400">Citizen:</dt>
            <dd className="text-slate-700">
              {report.citizen ? (
                <>
                  {report.citizen.firstName} {report.citizen.lastName} · <a className="text-rwanda-blue hover:underline" href={`mailto:${report.citizen.email}`}>{report.citizen.email}</a>
                  {report.citizen.phone ? ` · ${report.citizen.phone}` : ''}
                </>
              ) : (
                'Anonymous — identity hidden'
              )}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-slate-400">Location:</dt>
            <dd className="text-slate-700">
              {[report.location.sector, report.location.district, report.location.province].filter(Boolean).join(' / ')}
              {report.location.description ? ` — ${report.location.description}` : ''}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-slate-400">Coordinates:</dt>
            <dd className="text-slate-700">
              {report.location.latitude && report.location.longitude
                ? `${Number(report.location.latitude).toFixed(5)}, ${Number(report.location.longitude).toFixed(5)}`
                : '—'}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-slate-400">Department:</dt>
            <dd className="text-slate-700">{report.department ?? 'Not assigned'}</dd>
          </div>
        </dl>

        {/* AI suggestion (if present) */}
        {report.aiSuggestion.category && (
          <div className="mt-4 rounded-lg border border-purple-200 bg-purple-50 p-3 text-sm text-purple-800">
            🤖 <strong>AI suggestion:</strong> {report.aiSuggestion.category} ({report.aiSuggestion.confidence ? `${Number(report.aiSuggestion.confidence).toFixed(0)}% confidence` : 'confidence n/a'})
            {report.aiSuggestion.summary ? ` — ${report.aiSuggestion.summary}` : ''}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Action panel */}
        <section className="card p-6">
          <h2 className="mb-4 font-bold text-slate-900">Actions</h2>

          {actionMsg && <div className="mb-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{actionMsg}</div>}

          {/* Status transition */}
          <form onSubmit={handleTransition} className="rounded-lg border border-slate-200 p-4">
            <h3 className="text-sm font-bold text-slate-800">Move status forward</h3>
            {transitionError && <div className="mt-2"><ErrorBox message={transitionError} /></div>}
            {report.allowedTransitions.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">No transitions available from {report.status}.</p>
            ) : (
              <>
                <div className="mt-3 flex flex-wrap gap-2">
                  {report.allowedTransitions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                        targetStatus === s ? 'border-rwanda-blue bg-rwanda-blue/10 text-rwanda-green' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                      onClick={() => setTargetStatus(s)}
                    >
                      {s.replace(/_/g, ' ').toLowerCase()}
                    </button>
                  ))}
                </div>

                {needsDepartment && (
                  <div className="mt-3">
                    <label className="label" htmlFor="dept">Assign to department *</label>
                    <select id="dept" className="input" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} required>
                      <option value="">Select department…</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="mt-3">
                  <label className="label" htmlFor="tnote">Note to citizen</label>
                  <textarea
                    id="tnote"
                    className="input min-h-20"
                    maxLength={500}
                    placeholder="Optional — shown to the citizen as an official update"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>

                <button type="submit" className="btn-primary mt-3" disabled={!targetStatus || transitionBusy}>
                  {transitionBusy ? 'Applying…' : `Move to ${targetStatus.replace(/_/g, ' ').toLowerCase() || '…'}`}
                </button>
              </>
            )}
          </form>

          {/* Public update */}
          <form onSubmit={postUpdate} className="mt-4 rounded-lg border border-slate-200 p-4">
            <h3 className="text-sm font-bold text-slate-800">Post public update</h3>
            <textarea
              className="input mt-3 min-h-20"
              maxLength={1000}
              placeholder="Progress update visible to the citizen…"
              value={updateMsg}
              onChange={(e) => setUpdateMsg(e.target.value)}
            />
            <button type="submit" className="btn-outline mt-3" disabled={actionBusy || !updateMsg.trim()}>
              Post update
            </button>
          </form>
        </section>

        {/* Timeline + chat */}
        <section className="space-y-6">
          <div className="card p-6">
            <h2 className="mb-4 font-bold text-slate-900">Status history</h2>
            <ol className="relative space-y-4 border-l-2 border-slate-100 pl-5">
              {report.timeline.map((t) => (
                <li key={t.id} className="relative">
                  <span className="absolute -left-[27px] top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-slate-400" />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-700">{t.fromStatus ? `${t.fromStatus.replace(/_/g, ' ')} → ` : ''}{t.toStatus.replace(/_/g, ' ')}</span>
                    <span className="text-xs text-slate-400">{formatDateTime(t.createdAt)}</span>
                  </div>
                  {t.note && <p className="mt-0.5 text-sm text-slate-500">{t.note}</p>}
                  {t.actorName && <p className="text-xs text-slate-400">— {t.actorName}</p>}
                </li>
              ))}
            </ol>

            {report.feedback && (
              <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm">
                <strong className="text-amber-700">Citizen feedback:</strong> {'★'.repeat(report.feedback.rating)}{'☆'.repeat(5 - report.feedback.rating)}
                {report.feedback.comment ? ` — “${report.feedback.comment}”` : ''}
              </div>
            )}
          </div>

          <div className="card p-6">
            <h2 className="mb-4 font-bold text-slate-900">Conversation with citizen</h2>
            <div className="max-h-64 space-y-3 overflow-y-auto">
              {report.messages.length === 0 ? (
                <p className="text-sm text-slate-400">No messages yet.</p>
              ) : (
                report.messages.map((m) => (
                  <div key={m.id} className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${m.senderRole === 'GOVERNMENT' ? 'ml-auto bg-rwanda-green text-white' : 'bg-slate-100 text-slate-700'}`}>
                    <p className="whitespace-pre-wrap">{m.message}</p>
                    <p className={`mt-1 text-[10px] ${m.senderRole === 'GOVERNMENT' ? 'text-green-100' : 'text-slate-400'}`}>
                      {m.senderRole === 'GOVERNMENT' ? (user ? `${user.firstName}` : 'Government') : 'Citizen'} · {timeAgo(m.createdAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
            <form onSubmit={sendReply} className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
              <input className="input" placeholder="Reply to citizen…" maxLength={2000} value={chatMsg} onChange={(e) => setChatMsg(e.target.value)} />
              <button className="btn-primary" disabled={actionBusy || !chatMsg.trim()}>Send</button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
