import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { aiApi, metaApi, workflowApi } from '../../lib/api';
import type { Department, WorkflowReportDetail } from '../../types';
import { StatusBadge, UrgencyBadge, formatDateTime, timeAgo } from '../../lib/format';
import { Spinner, ErrorBox } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { t } from '../../translations';

const STAFF_ROLES = ['CELL_OFFICER', 'SECTOR_OFFICER', 'OFFICER', 'DISTRICT_ADMIN', 'PROVINCE_ADMIN', 'CITY_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'];

export default function WorkflowReportDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const isStaff = user ? STAFF_ROLES.includes(user.role) : false;

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

  // deadline / note / related / priority state (must be declared before any
  // conditional return — React hooks rules)
  const [deadline, setDeadline] = useState('');
  const [deadlineReason, setDeadlineReason] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [relatedId, setRelatedId] = useState('');
  const [relatedType, setRelatedType] = useState('RELATED');
  const [priority, setPriority] = useState<{ score: number; level: string; computedLevel: string; officerOverride: string | null; overrideReason: string | null; reasons: string[] } | null>(null);
  const [newPriority, setNewPriority] = useState('');
  const [priorityReason, setPriorityReason] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState('');

  // Assignment state — (re)assign to a specific officer/admin.
  const [staffList, setStaffList] = useState<Array<{ id: number; name: string; email: string; role: string; district: string | null }>>([]);
  const [assignOfficerId, setAssignOfficerId] = useState('');
  const [assignNote, setAssignNote] = useState('');
  const [assignPriority, setAssignPriority] = useState('');
  const [assignDeadline, setAssignDeadline] = useState('');
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignMsg, setAssignMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Administrator lifecycle state — accept / start / resolve (spec §5).
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [resolutionText, setResolutionText] = useState('');
  const [showResolveForm, setShowResolveForm] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const { report: r } = await workflowApi.report(id);
      setReport(r);
      setTargetStatus('');
      setNote('');
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    load();
    metaApi.departments().then((r) => setDepartments(r.departments)).catch(() => {});
    if (id) aiApi.priority(Number(id)).then((r) => setPriority(r.priority)).catch(() => {});
    if (isStaff) workflowApi.staff().then((r) => setStaffList(r.staff)).catch(() => {});
  }, [load, isStaff]);

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !assignOfficerId) return;
    setAssignBusy(true);
    setAssignMsg(null);
    try {
      const res = await workflowApi.assign(id, Number(assignOfficerId), assignNote.trim() || undefined, assignPriority || undefined, assignDeadline || undefined);
      setAssignMsg({ ok: true, text: `✔ Assignment saved for ${res.report?.reference ?? 'the report'} — the officer has been notified.` });
      setAssignNote('');
      setAssignOfficerId('');
      setAssignPriority('');
      setAssignDeadline('');
      await load();
    } catch (err) {
      setAssignMsg({ ok: false, text: err instanceof Error ? err.message : t('common.error') });
    } finally {
      setAssignBusy(false);
    }
  }

  // ── Administrator lifecycle actions (spec §5): accept → start → resolve ──
  async function runLifecycleAction(action: () => Promise<unknown>, success: string) {
    if (!id) return;
    setLifecycleBusy(true);
    setActionMsg('');
    try {
      await action();
      setActionMsg(success);
      setShowResolveForm(false);
      setResolutionText('');
      await load();
    } catch (err) {
      setActionMsg(`✖ ${err instanceof Error ? err.message : t('common.error')}`);
    } finally {
      setLifecycleBusy(false);
    }
  }

  async function handleTransition(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !targetStatus) return;
    setTransitionBusy(true);
    setTransitionError('');
    try {
      await workflowApi.transition(id, targetStatus, note || undefined, departmentId ? Number(departmentId) : undefined);
      await load();
    } catch (err) {
      setTransitionError(err instanceof Error ? err.message : t('common.error'));
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
      setActionMsg('✔ Update posted — the citizen has been notified.');
    } catch (err) {
      setActionMsg(err instanceof Error ? `✖ ${err.message}` : `✖ ${t('common.error')}`);
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
      setActionMsg('✔ Message sent to the citizen.');
    } catch (err) {
      setActionMsg(err instanceof Error ? `✖ ${err.message}` : `✖ ${t('common.error')}`);
    } finally {
      setActionBusy(false);
    }
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} />;
  if (!report) return null;

  const needsDepartment = targetStatus === 'ASSIGNED';
  const canAct = user?.role !== 'ANALYST' && user?.role !== 'EXECUTIVE' && user?.role !== 'CITIZEN';
  // Executives get aggregated intelligence only — the backend denies object-level AI analysis.
  const canViewAI = user?.role !== 'EXECUTIVE';

  return (
    <div className="mx-auto max-w-5xl">
      <Link to="/workflow/reports" className="mb-3 inline-block text-sm text-rwanda-blue hover:underline">← {t('nav.reportsQueue')}</Link>

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
              {report.isAnonymous && <span className="badge bg-slate-100 text-slate-500"><i className="fa-solid fa-user-secret" aria-hidden="true" /> {t('workflow.anonymousCitizen')}</span>}
            </div>
          </div>
          <div className="text-right text-sm text-slate-500">
            <p>{t('common.date')} {formatDateTime(report.createdAt)}</p>
            <p>{t('workflow.reportUpdated') || t('status.UNDER_REVIEW')} {timeAgo(report.updatedAt)}</p>
          </div>
        </div>

        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{report.description}</p>

        <dl className="mt-4 grid gap-x-8 gap-y-2 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2">
          <div className="flex gap-2">
            <dt className="text-slate-400">{t('role.CITIZEN')}:</dt>
            <dd className="text-slate-700">
              {report.citizen ? (
                <>
                  {report.citizen.firstName} {report.citizen.lastName} · <a className="text-rwanda-blue hover:underline" href={`mailto:${report.citizen.email}`}>{report.citizen.email}</a>
                  {report.citizen.phone ? ` · ${report.citizen.phone}` : ''}
                </>
              ) : (
                t('workflow.anonymousCitizen')
              )}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-slate-400">{t('workflow.location')}:</dt>
            <dd className="text-slate-700">
              {[report.location.sector, report.location.district, report.location.province].filter(Boolean).join(' / ')}
              {report.location.description ? ` — ${report.location.description}` : ''}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-slate-400">{t('citizen.gpsLabel')}:</dt>
            <dd className="text-slate-700">
              {report.location.latitude && report.location.longitude
                ? `${Number(report.location.latitude).toFixed(5)}, ${Number(report.location.longitude).toFixed(5)}`
                : '—'}
            </dd>
          </div>
          {report.location.latitude != null && report.location.longitude != null && (
            <div className="flex gap-2">
              <dt className="text-slate-400">{t('community.map')}:</dt>
              <dd><Link to={`/map?reportId=${report.id}`} className="text-sm font-semibold text-rwanda-blue hover:underline">{t('nav.communityMap')} →</Link></dd>
            </div>
          )}
          <div className="flex gap-2">
            <dt className="text-slate-400">{t('admin.departments')}:</dt>
            <dd className="text-slate-700">{report.department ?? t('common.none')}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-slate-400">{t('workflow.assignedToMe')}:</dt>
            <dd className="text-slate-700">
              {report.assignedOfficer ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rwanda-blue/10 px-2 py-0.5 text-xs font-semibold text-rwanda-blue">
                  <i className="fa-solid fa-user-shield" aria-hidden="true" /> {report.assignedOfficer.name}
                </span>
              ) : (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">{t('common.none')}</span>
              )}
            </dd>
          </div>
        </dl>

        {/* AI suggestion (if present) */}
        {report.aiSuggestion.category && (
          <div className="mt-4 rounded-lg border border-purple-200 bg-purple-50 p-3 text-sm text-purple-800">
            <i className="fa-solid fa-robot" aria-hidden="true" /> <strong>{t('workflow.aiSuggestion')}:</strong> {report.aiSuggestion.category} ({report.aiSuggestion.confidence ? `${Number(report.aiSuggestion.confidence).toFixed(0)}% ${t('workflow.aiConfidence')}` : '—'})
            {report.aiSuggestion.summary ? ` — ${report.aiSuggestion.summary}` : ''}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Action panel */}
        <section className="card p-6">
          <h2 className="mb-4 font-bold text-slate-900">{t('common.actions')}</h2>

          {actionMsg && (
            <div className={`mb-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${actionMsg.startsWith('✔') ? 'bg-emerald-50 text-emerald-800' : actionMsg.startsWith('✖') ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-600'}`}>
              {actionMsg.startsWith('✔') && <i className="fa-solid fa-circle-check" aria-hidden="true" />}
              {actionMsg.startsWith('✖') && <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />}
              <span>{actionMsg.replace(/^[✔✖]\s*/, '')}</span>
            </div>
          )}

          {/* Assign / reassign to a specific officer or admin */}
          {canAct && isStaff && (
            <form onSubmit={handleAssign} className="rounded-lg border border-rwanda-blue/30 bg-rwanda-blue/5 p-4">
              <h3 className="text-sm font-bold text-slate-800"><i className="fa-solid fa-user-shield" aria-hidden="true" /> {report.assignedOfficer ? `${t('workflow.reassignTitle')}${report.assignedOfficer.name})` : t('workflow.assignTitle')}</h3>
              {assignMsg && (
                <div className={`mt-2 rounded-lg px-3 py-2 text-sm ${assignMsg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{assignMsg.text}</div>
              )}
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <select className="input" value={assignOfficerId} onChange={(e) => setAssignOfficerId(e.target.value)} required>
                  <option value="">{t('workflow.assignSelect')}</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {s.role.replace(/_/g, ' ').toLowerCase()}{s.district ? ` (${s.district})` : ''}
                    </option>
                  ))}
                </select>
                <input className="input" placeholder={t('workflow.assignInstructions')} maxLength={300} value={assignNote} onChange={(e) => setAssignNote(e.target.value)} />
                <select className="input" value={assignPriority} onChange={(e) => setAssignPriority(e.target.value)}>
                  <option value="">{t('workflow.assignPriority')}</option>
                  <option value="LOW">{t('priority.LOW')}</option>
                  <option value="MEDIUM">{t('priority.MEDIUM')}</option>
                  <option value="HIGH">{t('priority.HIGH')}</option>
                  <option value="CRITICAL">{t('priority.CRITICAL')}</option>
                </select>
                <input className="input" type="date" aria-label={t('workflow.assignDeadline')} value={assignDeadline} onChange={(e) => setAssignDeadline(e.target.value)} />
              </div>
              {staffList.length === 0 && <p className="mt-2 text-xs text-amber-700">{t('workflow.noStaffAvailable')}</p>}
              <button type="submit" className="btn-primary mt-3" disabled={!assignOfficerId || assignBusy}>
                {assignBusy ? t('common.saving') : report.assignedOfficer ? t('workflow.confirmReassign') : t('workflow.confirmAssign')}
              </button>
              <p className="mt-2 text-xs text-slate-400">{t('workflow.assignHint')}</p>
            </form>
          )}

          {/* Administrator lifecycle actions — accept / start / resolve (spec §5) */}
          {canAct && isStaff && report.assignedOfficer && (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50/60 p-4">
              <h3 className="text-sm font-bold text-slate-800"><i className="fa-solid fa-diagram-project" aria-hidden="true" /> {t('workflow.assignmentActions')}</h3>
              <p className="mt-1 text-xs text-slate-500">{t('workflow.assignmentActionsHint')}<strong>{t(`status.${report.status}`)}</strong>. {t('workflow.followWorkflow')}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {report.status === 'ASSIGNED' && (
                  <>
                    <button type="button" className="btn-primary !py-1.5 text-xs" disabled={lifecycleBusy} onClick={() => runLifecycleAction(() => workflowApi.acceptAssignment(id!), `✔ ${t('workflow.acceptAssignment')}`)}>{t('workflow.acceptAssignment')}</button>
                    <button type="button" className="btn-outline !py-1.5 text-xs" disabled={lifecycleBusy} onClick={() => runLifecycleAction(() => workflowApi.startWork(id!), `✔ ${t('workflow.startWork')}`)}>{t('workflow.startWork')}</button>
                  </>
                )}
                {['IN_PROGRESS', 'ASSIGNED', 'REOPENED', 'ESCALATED'].includes(report.status) && (
                  <button type="button" className="btn-success !py-1.5 text-xs" disabled={lifecycleBusy} onClick={() => setShowResolveForm((v) => !v)}>{showResolveForm ? t('common.cancel') : t('workflow.markResolved')}</button>
                )}
              </div>
              {showResolveForm && (
                <form className="mt-3 space-y-2" onSubmit={(e) => { e.preventDefault(); if (resolutionText.trim()) void runLifecycleAction(() => workflowApi.resolveReport(id!, resolutionText.trim()), '✔ Report resolved — the citizen has been asked to confirm.'); }}>
                  <label className="label">{t('workflow.resolutionLabel')}</label>
                  <textarea className="input min-h-24" maxLength={4000} value={resolutionText} onChange={(e) => setResolutionText(e.target.value)} required placeholder={t('workflow.resolutionPlaceholder')} />
                  <p className="text-xs text-slate-400">{t('workflow.resolutionHint')}</p>
                  <button type="submit" className="btn-success" disabled={lifecycleBusy || !resolutionText.trim()}>{lifecycleBusy ? t('common.saving') : t('workflow.submitResolution')}</button>
                </form>
              )}
            </div>
          )}

          {/* Status transition */}
          {canAct ? <form onSubmit={handleTransition} className="rounded-lg border border-slate-200 p-4">
            <h3 className="text-sm font-bold text-slate-800">{t('workflow.transitionTitle')}</h3>
            {transitionError && <div className="mt-2"><ErrorBox message={transitionError} /></div>}
            {report.allowedTransitions.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">{t('workflow.noTransitions')}{t(`status.${report.status}`)}.</p>
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
                      {t(`status.${s}`)}
                    </button>
                  ))}
                </div>

                {needsDepartment && (
                  <div className="mt-3">
                    <label className="label" htmlFor="dept">{t('admin.departments')} *</label>
                    <select id="dept" className="input" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} required>
                      <option value="">{t('workflow.assignSelect')}</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="mt-3">
                  <label className="label" htmlFor="tnote">{t('workflow.addUpdate')}</label>
                  <textarea
                    id="tnote"
                    className="input min-h-20"
                    maxLength={500}
                    placeholder={t('workflow.updatePlaceholder')}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>

                <button type="submit" className="btn-primary mt-3" disabled={!targetStatus || transitionBusy}>
                  {transitionBusy ? t('common.saving') : `${t('workflow.transitionTitle')}: ${targetStatus ? t(`status.${targetStatus}`) : '…'}`}
                </button>
              </>
            )}
          </form> : <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">{t('error.forbidden')}</p>}

          {/* Deadline / SLA */}
          {canAct && <form onSubmit={async (e) => { e.preventDefault(); if (!id || !deadline) return; setActionBusy(true); setActionMsg(''); try { await workflowApi.setDeadline(id, new Date(deadline).toISOString(), deadlineReason || undefined); setActionMsg('✔ Deadline saved.'); setDeadline(''); setDeadlineReason(''); } catch (err) { setActionMsg(err instanceof Error ? `✖ ${err.message}` : '✖ Could not save deadline'); } finally { setActionBusy(false); } }} className="mt-4 rounded-lg border border-slate-200 p-4">
            <h3 className="text-sm font-bold text-slate-800">{t('workflow.setDeadline')}</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <input type="datetime-local" className="input" value={deadline} onChange={(e) => setDeadline(e.target.value)} required />
              <input className="input" placeholder={t('workflow.deadlineReason')} value={deadlineReason} onChange={(e) => setDeadlineReason(e.target.value)} />
            </div>
            <button type="submit" className="btn-outline mt-3" disabled={actionBusy || !deadline}>{t('common.save')}</button>
          </form>}

          {/* Internal note */}
          {canAct && <form onSubmit={async (e) => { e.preventDefault(); if (!id || !internalNote.trim()) return; setActionBusy(true); setActionMsg(''); try { await workflowApi.internalNote(id, internalNote.trim()); setInternalNote(''); setActionMsg('✔ Internal note saved (staff only).'); } catch (err) { setActionMsg(err instanceof Error ? `✖ ${err.message}` : '✖ Could not save note'); } finally { setActionBusy(false); } }} className="mt-4 rounded-lg border border-slate-200 p-4">
            <h3 className="text-sm font-bold text-slate-800">{t('workflow.internalNotes')}</h3>
            <textarea className="input mt-3 min-h-20" maxLength={2000} placeholder={t('workflow.internalNotePlaceholder')} value={internalNote} onChange={(e) => setInternalNote(e.target.value)} />
            <button type="submit" className="btn-outline mt-3" disabled={actionBusy || !internalNote.trim()}>{t('common.save')}</button>
          </form>}

          {/* Related / duplicate */}
          {canAct && <form onSubmit={async (e) => { e.preventDefault(); if (!id || !relatedId) return; setActionBusy(true); setActionMsg(''); try { await workflowApi.linkRelated(id, Number(relatedId), relatedType); setActionMsg(relatedType === 'DUPLICATE' ? '✔ Marked as possible duplicate (advisory — nothing auto-closed).' : '✔ Related report linked.'); setRelatedId(''); } catch (err) { setActionMsg(err instanceof Error ? `✖ ${err.message}` : '✖ Could not link reports'); } finally { setActionBusy(false); } }} className="mt-4 rounded-lg border border-slate-200 p-4">
            <h3 className="text-sm font-bold text-slate-800">{t('workflow.assignmentHistory')}</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <input className="input" placeholder={t('workflow.reportDetail')} value={relatedId} onChange={(e) => setRelatedId(e.target.value)} />
              <select className="input" value={relatedType} onChange={(e) => setRelatedType(e.target.value)}><option value="RELATED">{t('workflow.instructions')}</option><option value="DUPLICATE">{t('common.all')}</option></select>
            </div>
            <button type="submit" className="btn-outline mt-3" disabled={actionBusy || !relatedId}>{t('common.save')}</button>
          </form>}

          {/* Priority */}
          <div className="mt-4 rounded-lg border border-purple-200 bg-purple-50/50 p-4">
            <h3 className="text-sm font-bold text-slate-800">{t('workflow.priority')}</h3>
            {priority ? (
              <div className="mt-2 text-sm text-slate-600">
                <p><strong className="text-slate-900">{priority.score}/100 · {priority.level}</strong>{priority.officerOverride ? ` (officer override: ${priority.officerOverride} — ${priority.overrideReason ?? 'no reason recorded'})` : ` (computed: ${priority.computedLevel})`}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">{priority.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
              </div>
            ) : <p className="mt-2 text-sm text-slate-400">Loading priority…</p>}
            {canAct && <form onSubmit={async (e) => { e.preventDefault(); if (!id || !newPriority || !priorityReason.trim()) return; setAiBusy(true); setAiMsg(''); try { await aiApi.setPriority(Number(id), newPriority, priorityReason.trim()); const r = await aiApi.priority(Number(id)); setPriority(r.priority); setNewPriority(''); setPriorityReason(''); setAiMsg('✔ Priority updated with audit record.'); } catch (err) { setAiMsg(err instanceof Error ? `✖ ${err.message}` : '✖ Could not update priority'); } finally { setAiBusy(false); } }} className="mt-3 grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
              <select className="input" value={newPriority} onChange={(e) => setNewPriority(e.target.value)}><option value="">{t('workflow.assignPriority')}</option><option value="LOW">{t('priority.LOW')}</option><option value="MEDIUM">{t('priority.MEDIUM')}</option><option value="HIGH">{t('priority.HIGH')}</option><option value="CRITICAL">{t('priority.CRITICAL')}</option></select>
              <input className="input" placeholder={t('workflow.deadlineReason')} value={priorityReason} onChange={(e) => setPriorityReason(e.target.value)} />
              <button className="btn-outline" disabled={aiBusy || !newPriority || !priorityReason.trim()}>{t('common.edit')}</button>
            </form>}
            {aiMsg && (
              <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                {aiMsg.startsWith('✔') && <i className="fa-solid fa-circle-check text-emerald-600" aria-hidden="true" />}
                {aiMsg.startsWith('✖') && <i className="fa-solid fa-triangle-exclamation text-red-600" aria-hidden="true" />}
                <span>{aiMsg.replace(/^[✔✖]\s*/, '')}</span>
              </p>
            )}
            {canViewAI && <Link to={`/ai/reports/${id}`} className="mt-2 inline-block text-sm font-semibold text-brand-primary hover:underline">{t('workflow.aiSummary')} →</Link>}
          </div>

          {/* Public update */}
          {canAct && <form onSubmit={postUpdate} className="mt-4 rounded-lg border border-slate-200 p-4">
            <h3 className="text-sm font-bold text-slate-800">{t('workflow.addUpdate')}</h3>
            <textarea
              className="input mt-3 min-h-20"
              maxLength={1000}
              placeholder={t('workflow.updatePlaceholder')}
              value={updateMsg}
              onChange={(e) => setUpdateMsg(e.target.value)}
            />
            <button type="submit" className="btn-outline mt-3" disabled={actionBusy || !updateMsg.trim()}>
              {t('workflow.postUpdate')}
            </button>
          </form>}
        </section>

        {/* Timeline + chat */}
        <section className="space-y-6">
          <div className="card p-6">
            <h2 className="mb-4 font-bold text-slate-900">{t('citizen.timeline')}</h2>
            <ol className="relative space-y-4 border-l-2 border-slate-100 pl-5">
              {report.timeline.map((entry) => (
                <li key={entry.id} className="relative">
                  <span className="absolute -left-[27px] top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-slate-400" />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-700">{entry.fromStatus ? `${t(`status.${entry.fromStatus}`)} → ` : ''}{t(`status.${entry.toStatus}`)}</span>
                    <span className="text-xs text-slate-400">{formatDateTime(entry.createdAt)}</span>
                  </div>
                  {entry.note && <p className="mt-0.5 text-sm text-slate-500">{entry.note}</p>}
                  {entry.actorName && <p className="text-xs text-slate-400">— {entry.actorName}</p>}
                </li>
              ))}
            </ol>

            {report.feedback && (
              <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm">
                <strong className="text-amber-700">{t('citizen.feedbackLabel')}:</strong>{' '}<span className="text-amber-500">{Array.from({ length: report.feedback.rating }, (_, i) => <i key={`sf${i}`} className="fa-solid fa-star" aria-hidden="true" />)}{Array.from({ length: 5 - report.feedback.rating }, (_, i) => <i key={`se${i}`} className="fa-regular fa-star" aria-hidden="true" />)}</span>
                {report.feedback.comment ? ` — “${report.feedback.comment}”` : ''}
              </div>
            )}
          </div>

          <div className="card p-6">
            <h2 className="mb-4 font-bold text-slate-900">{t('citizen.messages')}</h2>
            <div className="max-h-64 space-y-3 overflow-y-auto">
              {report.messages.length === 0 ? (
                <p className="text-sm text-slate-400">{t('common.none')}</p>
              ) : (
                report.messages.map((m) => (
                  <div key={m.id} className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${m.senderRole === 'GOVERNMENT' ? 'ml-auto bg-rwanda-green text-white' : 'bg-slate-100 text-slate-700'}`}>
                    <p className="whitespace-pre-wrap">{m.message}</p>
                    <p className={`mt-1 text-[10px] ${m.senderRole === 'GOVERNMENT' ? 'text-green-100' : 'text-slate-400'}`}>
                      {m.senderRole === 'GOVERNMENT' ? (user ? `${user.firstName}` : t('notif.govMessage')) : t('role.CITIZEN')} · {timeAgo(m.createdAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
            {canAct && <form onSubmit={sendReply} className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
              <input className="input" placeholder={t('workflow.replyToCitizen')} maxLength={2000} value={chatMsg} onChange={(e) => setChatMsg(e.target.value)} />
              <button className="btn-primary" disabled={actionBusy || !chatMsg.trim()}>{t('common.send')}</button>
            </form>}
          </div>
        </section>
      </div>
    </div>
  );
}
