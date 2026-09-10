import type { ReactNode } from 'react';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-rwanda-blue" />
        <span className="text-sm text-slate-400">{label}</span>
      </div>
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      ⚠️ {message}
    </div>
  );
}

export function EmptyState({ icon = '📭', title, hint }: { icon?: string; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
      <span className="text-4xl">{icon}</span>
      <p className="mt-3 font-semibold text-slate-700">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-slate-400">{hint}</p>}
    </div>
  );
}

export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between">
      <button className="btn-outline text-xs" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        ← Previous
      </button>
      <span className="text-xs text-slate-500">
        Page {page} of {totalPages}
      </span>
      <button className="btn-outline text-xs" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        Next →
      </button>
    </div>
  );
}

export function StatCard({ icon, label, value, tone = 'blue' }: { icon: string; label: string; value: number | string; tone?: 'blue' | 'green' | 'amber' | 'red' | 'slate' }) {
  const tones: Record<string, string> = {
    blue: 'bg-sky-50 text-sky-700',
    green: 'bg-green-50 text-green-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    slate: 'bg-slate-100 text-slate-600',
  };
  return (
    <div className="card flex items-center gap-4 p-4">
      <div className={`flex h-11 w-11 items-center justify-center rounded-lg text-xl ${tones[tone]}`}>{icon}</div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}
