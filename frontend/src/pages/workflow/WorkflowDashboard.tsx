import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { workflowApi } from '../../lib/api';
import type { WorkflowStats, WorkflowReport } from '../../types';
import { StatusBadge, UrgencyBadge, timeAgo } from '../../lib/format';
import { PageHeader, Spinner, DashboardError, StatCard, EmptyState } from '../../components/ui';
import { CategoryIcon } from '../../components/icons';
import { useAuth } from '../../context/AuthContext';

type ReopenRequest = {
  id: number;
  reportId: number;
  reason: string;
  status: string;
  actorName: string | null;
  createdAt: string;
  report: { id: number; reference: string; title: string; status: string } | null;
};

// Mirrors backend TRANSITION_ROLE_MATRIX.REOPENED — who may approve.
const CAN_APPROVE = ['SECTOR_OFFICER', 'OFFICER', 'DISTRICT_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'];
const STAFF_ROLES = ['CELL_OFFICER', 'SECTOR_OFFICER', 'OFFICER', 'DISTRICT_ADMIN', 'PROVINCE_ADMIN', 'CITY_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'];
// Mirrors backend ROLE_PERMISSIONS for the quick actions used in the workbench.
const ROLE_CAN: Record<string, string[]> = {
  CELL_OFFICER: ['VERIFIED', 'REJECTED', 'RESOLVED'],
  SECTOR_OFFICER: ['VERIFIED', 'REJECTED', 'RESOLVED'],
  OFFICER: ['VERIFIED', 'REJECTED', 'RESOLVED'],
  DISTRICT_ADMIN: ['VERIFIED', 'REJECTED', 'RESOLVED'],
  PROVINCE_ADMIN: ['RESOLVED'],
  CITY_ADMIN: ['RESOLVED'],
  NATIONAL_ADMIN: ['VERIFIED', 'RESOLVED'],
  SYSTEM_ADMIN: ['VERIFIED', 'REJECTED', 'RESOLVED'],
};
const TODO_STATUSES = ['SUBMITTED', 'RECEIVED', 'PENDING_VERIFICATION', 'UNDER_REVIEW', 'WAITING_CITIZEN'];
const ACTIVE_STATUSES = ['VERIFIED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_DEPARTMENT', 'REOPENED'];
const CLOSING_STATUSES = ['RESOLVED', 'ESCALATED', 'PENDING_CLOSURE', 'REOPEN_REQUESTED'];

type StaffMember = { id: number; name: string; email: string; role: string; district: string | null };

export default function WorkflowDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<WorkflowStats['stats'] | null>(null);
  const [pending, setPending] = useState<WorkflowReport[]>([]);
  const [reopenReqs, setReopenReqs] = useState<ReopenRequest[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Review workbench: queue rows, staff directory, and inline action state.
  const [queue, setQueue] = useState<WorkflowReport[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [workbenchTab, setWorkbenchTab] = useState<'todo' | 'active' | 'closing'>('todo');
  const [assigning, setAssigning] = useState<{ id: number; officerId: string; note: string } | null>(null);
  const [acting, setActing] = useState<{ id: number; status: 'RESOLVED' | 'REJECTED'; note: string } | null>(null);
  const [busyReport, setBusyReport] = useState<number | null>(null);

  // Review state: which request is being actioned and with what decision.
  const [reviewing, setReviewing] = useState<{ id: number; decision: 'APPROVE' | 'DECLINE' } | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [actionMsg, setActionMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const canReview = user ? STAFF_ROLES.includes(user.role) : false;
  const canApprove = user ? CAN_APPROVE.includes(user.role) : false;

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([workflowApi.stats(), workflowApi.reports('ALL', 1), workflowApi.reopenRequests(), workflowApi.staff()])
      .then(([s, r, rr, st]) => {
        setStats(s.stats);
        setPending(r.reports.filter((rep: WorkflowReport) => ['SUBMITTED', 'RECEIVED', 'UNDER_REVIEW', 'REOPEN_REQUESTED'].includes(rep.status)).slice(0, 8));
        setReopenReqs(rr.requests);
        setQueue(r.reports);
        setStaffList(st.staff);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load workflow data'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submitReview() {
    if (!reviewing) return;
    setBusyId(reviewing.id);
    setActionMsg(null);
    try {
      const res = await workflowApi.reviewReopenRequest(reviewing.id, reviewing.decision, reviewNote.trim() || undefined);
      setActionMsg({ ok: true, text: res.decision === 'APPROVED' ? 'Approved — the report is reopened and the citizen has been notified.' : 'Reopen request declined — the citizen has been notified.' });
      setReviewing(null);
      setReviewNote('');
      load();
    } catch (e) {
      setActionMsg({ ok: false, text: e instanceof Error ? e.message : 'Failed to record the review decision' });
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <Spinner />;
  if (error) return <DashboardError message={error} onRetry={() => window.location.reload()} />;
  if (!stats) return null;

  const canAct = user ? Boolean(user.role && ROLE_CAN[user.role]?.length) : false;
  const allowedForMe = (status: string) => (user ? (ROLE_CAN[user.role] ?? []).includes(status) : false);
  const tabReports = (tab: 'todo' | 'active' | 'closing') => {
    const source = tab === 'todo' ? TODO_STATUSES : tab === 'active' ? ACTIVE_STATUSES : CLOSING_STATUSES;
    return queue.filter((r) => source.includes(r.status));
  };

  async function submitAssign() {
    if (!assigning) return;
    const officerId = Number(assigning.officerId);
    if (!officerId) return;
    setBusyReport(assigning.id);
    setActionMsg(null);
    try {
      await workflowApi.assign(assigning.id, officerId, assigning.note.trim() || undefined);
      setActionMsg({ ok: true, text: '✔ Report assigned — the officer has been notified.' });
      setAssigning(null);
      load();
    } catch (e) {
      setActionMsg({ ok: false, text: e instanceof Error ? e.message : 'Failed to assign the report' });
    } finally {
      setBusyReport(null);
    }
  }

  async function submitQuickAction() {
    if (!acting) return;
    setBusyReport(acting.id);
    setActionMsg(null);
    try {
      await workflowApi.transition(acting.id, acting.status, acting.note.trim() || undefined);
      setActionMsg({ ok: true, text: `✔ Report moved to ${acting.status.replace('_', ' ').toLowerCase()} — the citizen has been notified.` });
      setActing(null);
      load();
    } catch (e) {
      setActionMsg({ ok: false, text: e instanceof Error ? e.message : 'Failed to update the report' });
    } finally {
      setBusyReport(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Government workflow"
        subtitle={user ? `${user.firstName} ${user.lastName} · ${user.role.replace('_', ' ')}` : undefined}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/" className="btn-outline text-sm">Home</Link>
            <Link to="/dashboard" className="btn-outline text-sm">Dashboard</Link>
            <Link to="/workflow/reports" className="btn-primary">Open reports queue</Link>
            <Link to="/government/intelligence" className="btn-outline">GIS &amp; intelligence</Link>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon="fa-clipboard-list" label="Total reports" value={stats.total} tone="blue" />
        <StatCard icon="fa-seedling" label="Needs first review" value={stats.submitted} tone="amber" />
        <StatCard icon="fa-magnifying-glass" label="Under review" value={stats.underReview} tone="slate" />
        <StatCard icon="fa-screwdriver-wrench" label="In progress" value={stats.inProgress} tone="blue" />
        <StatCard icon="fa-boxes-stacked" label="Assigned" value={stats.assigned} tone="slate" />
        <StatCard icon="fa-circle-check" label="Resolved" value={stats.resolved} tone="green" />
        <StatCard icon="fa-triangle-exclamation" label="Escalated" value={stats.escalated} tone="red" />
        <StatCard icon="fa-rotate" label="Reopen requests" value={reopenReqs.length} tone={reopenReqs.length > 0 ? 'amber' : 'slate'} />
      </div>

      {actionMsg && (
        <div
          role="status"
          className={`mt-4 rounded-lg border px-4 py-3 text-sm ${actionMsg.ok ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-700'}`}
        >
          {actionMsg.text}
        </div>
      )}

      {/* ── Review & solve workbench ──────────────────────────────────── */}
      <section className="card mt-6 p-5">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-slate-900"><i className="fa-solid fa-clipboard-check" aria-hidden="true" /> Review &amp; solve reports</h2>
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
            {([['todo', 'To review'], ['active', 'In progress'], ['closing', 'Closing']] as const).map(([tab, label]) => {
              const count = tabReports(tab).length;
              return (
                <button
                  key={tab}
                  type="button"
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${workbenchTab === tab ? 'bg-white text-rwanda-blue shadow-sm' : 'text-slate-500 hover:text-slate-700'} ${count === 0 ? 'opacity-60' : ''}`}
                  onClick={() => setWorkbenchTab(tab)}
                >
                  {label} ({count})
                </button>
              );
            })}
          </div>
        </div>
        <p className="mb-3 text-xs text-slate-500">
          Review each report, assign it to the right officer, and resolve it when the work is done. Assignments notify the officer; resolutions notify the citizen.
        </p>

        {tabReports(workbenchTab).length === 0 ? (
          <EmptyState
            icon="fa-circle-check"
            title={workbenchTab === 'todo' ? 'Nothing waiting for review' : workbenchTab === 'active' ? 'No active work right now' : 'Nothing to close'}
            hint="Reports in this stage will appear here automatically."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {tabReports(workbenchTab).map((r) => (
              <li key={r.id} className="py-4">
                <div className="flex flex-wrap items-start gap-3">
                  <span className="w-7 text-center text-xl text-brand-primary"><CategoryIcon name={r.categoryName} dbIcon={r.categoryIcon} /></span>
                  <div className="min-w-0 flex-1">
                    <Link to={`/workflow/${r.id}`} className="font-medium text-slate-800 hover:text-rwanda-blue hover:underline">
                      {r.title}
                    </Link>
                    <p className="text-xs text-slate-400">
                      {r.reference} · {r.district}{r.sector ? ` / ${r.sector}` : ''} · {r.categoryName} · {timeAgo(r.createdAt)}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600">{r.description}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusBadge status={r.status} />
                      <UrgencyBadge urgency={r.urgency} />
                      {r.department && <span className="badge bg-slate-100 text-slate-600"><i className="fa-solid fa-building" aria-hidden="true" /> {r.department}</span>}
                      {r.assignedOfficer ? (
                        <span className="badge bg-rwanda-blue/10 text-rwanda-blue"><i className="fa-solid fa-user-shield" aria-hidden="true" /> {r.assignedOfficer.name}</span>
                      ) : (
                        <span className="badge bg-amber-100 text-amber-700"><i className="fa-solid fa-user-slash" aria-hidden="true" /> Unassigned</span>
                      )}
                    </div>
                  </div>

                  {canAct && (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn-outline text-xs"
                        disabled={busyReport === r.id}
                        onClick={() => { setAssigning(assigning?.id === r.id ? null : { id: r.id, officerId: r.assignedOfficer?.id ? String(r.assignedOfficer.id) : '', note: '' }); setActing(null); }}
                      >
                        <i className="fa-solid fa-user-plus" aria-hidden="true" /> {r.assignedOfficer ? 'Reassign' : 'Assign'}
                      </button>
                      {allowedForMe('RESOLVED') && ['IN_PROGRESS', 'ASSIGNED', 'REOPENED', 'WAITING_DEPARTMENT'].includes(r.status) && (
                        <button
                          type="button"
                          className="btn-outline text-xs !border-green-300 !text-green-700 hover:!bg-green-50"
                          disabled={busyReport === r.id}
                          onClick={() => { setActing({ id: r.id, status: 'RESOLVED', note: '' }); setAssigning(null); }}
                        >
                          <i className="fa-solid fa-circle-check" aria-hidden="true" /> Resolve
                        </button>
                      )}
                      {allowedForMe('REJECTED') && TODO_STATUSES.concat('VERIFIED').includes(r.status) && (
                        <button
                          type="button"
                          className="btn-outline text-xs !border-red-200 !text-red-600 hover:!bg-red-50"
                          disabled={busyReport === r.id}
                          onClick={() => { setActing({ id: r.id, status: 'REJECTED', note: '' }); setAssigning(null); }}
                        >
                          <i className="fa-solid fa-ban" aria-hidden="true" /> Reject
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Inline assign panel */}
                {assigning?.id === r.id && (
                  <div className="mt-3 rounded-lg border border-rwanda-blue/30 bg-rwanda-blue/5 p-4">
                    <h4 className="text-sm font-bold text-slate-800"><i className="fa-solid fa-user-shield" aria-hidden="true" /> Assign to officer / admin</h4>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <select
                        className="input"
                        value={assigning.officerId}
                        onChange={(e) => setAssigning({ ...assigning, officerId: e.target.value })}
                      >
                        <option value="">Select officer…</option>
                        {staffList.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} — {s.role.replace(/_/g, ' ').toLowerCase()}{s.district ? ` (${s.district})` : ''}
                          </option>
                        ))}
                      </select>
                      <input
                        className="input"
                        placeholder="Instruction for the officer (optional)"
                        maxLength={300}
                        value={assigning.note}
                        onChange={(e) => setAssigning({ ...assigning, note: e.target.value })}
                      />
                    </div>
                    {staffList.length === 0 && <p className="mt-2 text-xs text-amber-700">No other staff members are available — you can still solve this report yourself.</p>}
                    <div className="mt-3 flex justify-end gap-2">
                      <button type="button" className="btn-outline text-xs" onClick={() => setAssigning(null)}>Cancel</button>
                      <button
                        type="button"
                        className="btn-primary text-xs"
                        disabled={!assigning.officerId || busyReport === r.id}
                        onClick={submitAssign}
                      >
                        {busyReport === r.id ? 'Saving…' : r.assignedOfficer ? 'Confirm reassignment' : 'Confirm assignment'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Inline resolve / reject panel */}
                {acting?.id === r.id && (
                  <div className={`mt-3 rounded-lg border p-4 ${acting.status === 'RESOLVED' ? 'border-green-300 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                    <h4 className="text-sm font-bold text-slate-800">
                      {acting.status === 'RESOLVED' ? 'Resolve this report' : 'Reject this report'}
                    </h4>
                    <p className="mt-1 text-xs text-slate-500">
                      {acting.status === 'RESOLVED'
                        ? 'Only resolve when the problem is actually fixed on the ground. The citizen will be asked to confirm the result.'
                        : 'Explain why the report cannot be actioned — your note is shared with the citizen.'}
                    </p>
                    <textarea
                      className="input mt-2 min-h-20"
                      maxLength={500}
                      placeholder={acting.status === 'RESOLVED' ? 'e.g. Canal cleared and waste removed — verified on site this morning.' : 'e.g. Duplicate of RCP-2026-000004 — the same issue is already being handled.'}
                      value={acting.note}
                      onChange={(e) => setActing({ ...acting, note: e.target.value })}
                    />
                    <div className="mt-3 flex justify-end gap-2">
                      <button type="button" className="btn-outline text-xs" onClick={() => setActing(null)}>Cancel</button>
                      <button
                        type="button"
                        className={`text-xs ${acting.status === 'RESOLVED' ? 'btn-primary' : 'btn-primary !bg-red-600'}`}
                        disabled={busyReport === r.id || (acting.status === 'REJECTED' && !acting.note.trim())}
                        onClick={submitQuickAction}
                      >
                        {busyReport === r.id ? 'Saving…' : acting.status === 'RESOLVED' ? 'Confirm resolved' : 'Confirm rejection'}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Reopen requests review */}
      <section className="card mt-6 p-5">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-bold text-slate-900"><i className="fa-solid fa-rotate" aria-hidden="true" /> Reopen requests</h2>
          {reopenReqs.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
              {reopenReqs.length} pending
            </span>
          )}
        </div>
        <p className="mb-3 text-xs text-slate-500">
          Citizens asked to reopen closed reports. Approving reopens the report for further work; declining keeps it closed with an explanation.
        </p>
        {reopenReqs.length === 0 ? (
          <EmptyState icon="fa-circle-check" title="No pending reopen requests" hint="Citizen reopen requests will appear here for review." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {reopenReqs.map((req) => (
              <li key={req.id} className="py-3">
                <div className="flex flex-wrap items-start gap-3">
                  <span className="text-xl"><i className="fa-solid fa-rotate" aria-hidden="true" /></span>
                  <div className="min-w-0 flex-1">
                    {req.report ? (
                      <Link to={`/workflow/${req.report.id}`} className="font-medium text-slate-800 hover:text-rwanda-blue hover:underline">
                        {req.report.title}
                      </Link>
                    ) : (
                      <span className="font-medium text-slate-800">Report unavailable</span>
                    )}
                    <p className="text-xs text-slate-400">
                      {req.report ? `${req.report.reference} · currently ${req.report.status.replace(/_/g, ' ').toLowerCase()}` : ''} · requested {timeAgo(req.createdAt)}
                      {req.actorName ? ` by ${req.actorName}` : ''}
                    </p>
                    <blockquote className="mt-2 rounded-md border-l-4 border-amber-300 bg-amber-50 px-3 py-2 text-sm text-slate-700">
                      “{req.reason}”
                    </blockquote>
                  </div>
                  {canReview && (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {canApprove && (
                        <button
                          type="button"
                          className="btn-outline text-xs"
                          disabled={busyId === req.id}
                          onClick={() => { setReviewing({ id: req.id, decision: 'APPROVE' }); setReviewNote(''); setActionMsg(null); }}
                        >
                          Approve &amp; reopen
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn-outline text-xs"
                        disabled={busyId === req.id}
                        onClick={() => { setReviewing({ id: req.id, decision: 'DECLINE' }); setReviewNote(''); setActionMsg(null); }}
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </div>

                {reviewing?.id === req.id && (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <label className="block text-xs font-semibold text-slate-600">
                      {reviewing.decision === 'APPROVE' ? 'Approval note (optional — shared with the citizen)' : 'Decline reason (recommended — shared with the citizen)'}
                    </label>
                    <textarea
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      rows={2}
                      maxLength={500}
                      placeholder={reviewing.decision === 'APPROVE' ? 'e.g. Site revisited — drain still blocked, reopening for remediation.' : 'e.g. Verified on site: the reported issue has been fixed. See the resolution evidence.'}
                      className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm focus:border-rwanda-blue focus:outline-none"
                    />
                    <div className="mt-2 flex justify-end gap-2">
                      <button type="button" className="btn-outline text-xs" onClick={() => { setReviewing(null); setReviewNote(''); }}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        className={`btn-primary text-xs ${reviewing.decision === 'DECLINE' && !reviewNote.trim() ? 'opacity-80' : ''}`}
                        disabled={busyId === req.id}
                        onClick={submitReview}
                      >
                        {busyId === req.id ? 'Saving…' : `Confirm ${reviewing.decision === 'APPROVE' ? 'approval' : 'decline'}`}
                      </button>
                    </div>
                    {!canApprove && reviewing.decision === 'APPROVE' && (
                      <p className="mt-1 text-xs text-red-600">Your role cannot approve reopen requests — a supervisor (sector level or above) must approve.</p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card mt-6 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold text-slate-900">Awaiting action</h2>
          <Link to="/workflow/reports" className="text-sm text-rwanda-blue hover:underline">View full queue</Link>
        </div>
        {pending.length === 0 ? (
          <EmptyState icon="fa-champagne-glasses" title="Queue is clear" hint="No reports are waiting for a first review right now." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {pending.map((r) => (
              <li key={r.id}>
                <Link to={`/workflow/${r.id}`} className="flex items-center gap-4 px-2 py-3 hover:bg-slate-50">
                  <span className="w-6 text-center text-xl text-brand-primary"><CategoryIcon name={r.categoryName} dbIcon={r.categoryIcon} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-800">{r.title}</p>
                    <p className="text-xs text-slate-400">
                      {r.reference} · {r.district}{r.sector ? ` / ${r.sector}` : ''} · {timeAgo(r.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                  <UrgencyBadge urgency={r.urgency} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
