import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { citizenApi } from '../../lib/api';
import { PageHeader, Spinner, ErrorBox } from '../../components/ui';

// Task 3 §47 — EditReportPage (citizen-editable fields only, §14).
export default function EditReportPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: '', description: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    citizenApi.report(id)
      .then((r) => setForm({ title: r.report.title, description: r.report.description }))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false));
  }, [id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setBusy(true); setError('');
    try {
      await citizenApi.updateReport(id, form);
      navigate(`/reports/${id}`);
    } catch (err) { setError(err instanceof Error ? err.message : 'Update failed'); } finally { setBusy(false); }
  }

  if (loading) return <Spinner />;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Edit report" subtitle="Only title and description may be edited by citizens before verification." />
      {error && <div className="mb-4"><ErrorBox message={error} /></div>}
      <form onSubmit={submit} className="card space-y-4 p-6">
        <div><label className="label">Title</label><input className="input" required minLength={5} maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div><label className="label">Description</label><textarea className="input min-h-28" required minLength={10} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
      </form>
    </div>
  );
}
