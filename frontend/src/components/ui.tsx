import type { ReactNode } from 'react';
import { Icon } from './icons';

export function PageHeader({ title, subtitle, icon, actions }: { title: string; subtitle?: string; icon?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4">
      <div className="flex items-center gap-3">
        {icon && (
          <span className="premium-icon-chip">
            <Icon name={icon} />
          </span>
        )}
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {actions}
    </div>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="flex flex-col items-center gap-3">
        <Icon name="fa-circle-notch" className="animate-spin text-2xl text-brand-primary" />
        <span className="text-sm text-slate-400">{label}</span>
      </div>
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <Icon name="fa-triangle-exclamation" />
      <span>{message}</span>
    </div>
  );
}

export function DashboardError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const authError = /session|sign in|authentication|permission/i.test(message);
  return (
    <section className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full text-xl ${authError ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}`}>
        <Icon name={authError ? 'fa-lock' : 'fa-triangle-exclamation'} />
      </div>
      <h2 className="mt-4 text-xl font-bold text-brand-navy">{authError ? 'Your secure session needs attention' : 'This dashboard needs a quick retry'}</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">{message}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        {onRetry && <button className="btn-primary" onClick={onRetry}>Try again</button>}
        <a className="btn-outline" href={authError ? '/login' : '/'}>{authError ? 'Sign in again' : 'Return home'}</a>
      </div>
    </section>
  );
}

export function EmptyState({ icon = 'fa-inbox', title, hint }: { icon?: string; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-400">
        <Icon name={icon} />
      </span>
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
        <Icon name="fa-arrow-left" className="text-xs" /> Previous
      </button>
      <span className="text-xs text-slate-500">
        Page {page} of {totalPages}
      </span>
      <button className="btn-outline text-xs" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        Next <Icon name="fa-arrow-right" className="text-xs" />
      </button>
    </div>
  );
}

export type StatTone = 'blue' | 'green' | 'amber' | 'red' | 'slate' | 'gold' | 'navy';

export function StatCard({ icon, label, value, tone = 'blue' }: { icon: string; label: string; value: number | string; tone?: StatTone }) {
  const tones: Record<StatTone, string> = {
    blue: 'bg-brand-primary/10 text-brand-primary',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    slate: 'bg-slate-100 text-slate-600',
    gold: 'bg-brand-gold/10 text-brand-gold-deep',
    navy: 'bg-brand-navy/10 text-brand-navy',
  };
  return (
    <div className="card group flex items-center gap-4 p-4 transition-shadow hover:shadow-[0_12px_28px_rgba(11,31,58,0.10)]">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base ${tones[tone]}`}>
        <Icon name={icon} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
        <p className="truncate text-2xl font-bold text-brand-navy">{value}</p>
      </div>
    </div>
  );
}
