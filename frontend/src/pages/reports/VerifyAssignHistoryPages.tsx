// ─────────────────────────────────────────────────────────────
// R-CPI Task 3 — verify / assign / history pages (ADDITIVE, §47)
// Thin pages wrapping the existing workflow API; no edits elsewhere.
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { workflowApi } from '../../lib/api';
import { PageHeader, Spinner, ErrorBox } from '../../components/ui';
import { ReportTimeline } from '../../components/reports/ReportTimeline';

export function VerifyReportPage() {
  const { id } = useParams<{ id: string }>();
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setBusy(true); setMsg('');
    try {
      await workflowApi.transition(id, 'VERIFIED', note || undefined);
      setMsg('✅ Report verified. The citizen has been notified.');
    } catch (err) { setMsg(err instanceof Error ? `⚠️ ${err.message}` : '⚠️ Failed'); } finally { setBusy(false); }
  }
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Verify report" subtitle={`Report #${id}`} />
      {msg && <div className="mb-4"><ErrorBox message={msg} /></div>}
      <form onSubmit={submit} className="card space-y-3 p-6">
        <textarea className="input min-h-24" placeholder="Verification note…" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
        <button className="btn-primary" disabled={busy}>{busy ? 'Verifying…' : 'Verify report'}</button>
      </form>
    </div>
  );
}

export function AssignReportPage() {
  const { id } = useParams<{ id: string }>();
  const [officerId, setOfficerId] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !officerId) return;
    setBusy(true); setMsg('');
    try {
      await workflowApi.transition(id, 'ASSIGNED', `Assigned to officer ${officerId}`);
      setMsg('✅ Report assigned.');
    } catch (err) { setMsg(err instanceof Error ? `⚠️ ${err.message}` : '⚠️ Failed'); } finally { setBusy(false); }
  }
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Assign report" subtitle={`Report #${id}`} />
      {msg && <div className="mb-4"><ErrorBox message={msg} /></div>}
      <form onSubmit={submit} className="card space-y-3 p-6">
        <input className="input" required placeholder="Officer user ID" value={officerId} onChange={(e) => setOfficerId(e.target.value)} />
        <button className="btn-primary" disabled={busy}>{busy ? 'Assigning…' : 'Assign report'}</button>
      </form>
    </div>
  );
}

export function ReportHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const [timeline, setTimeline] = useState<Array<{ id: number; fromStatus: string | null; toStatus: string; note: string | null; actorName: string | null; createdAt: string }>>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!id) return;
    workflowApi.report(id)
      .then((r) => setTimeline(r.report.timeline))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false));
  }, [id]);
  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} />;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Report history" subtitle={`Report #${id} — immutable audit trail`} />
      <div className="card p-6"><ReportTimeline timeline={timeline} /></div>
    </div>
  );
}
