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

export default function WorkflowDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<WorkflowStats['stats'] | null>(null);
  const [pending, setPending] = useState<WorkflowReport[]>([]);
  const [reopenReqs, setReopenReqs] = useState<ReopenRequest[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Review state: which request is being actioned and with what decision.
  const [reviewing, setReviewing] = useState<{ id: number; decision: 'APPROVE' | 'DECLINE' } | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [actionMsg, setActionMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const canReview = user ? STAFF_ROLES.includes(user.role) : false;
  const canApprove = user ? CAN_APPROVE.includes(user.role) : false;

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([workflowApi.stats(), workflowApi.reports('ALL', 1), workflowApi.reopenRequests()])
      .then(([s, r, rr]) => {
        setStats(s.stats);
        setPending(r.reports.filter((rep: WorkflowReport) => ['SUBMITTED', 'RECEIVED', 'UNDER_REVIEW', 'REOPEN_REQUESTED'].includes(rep.status)).slice(0, 8));
        setReopenReqs(rr.requests);
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
