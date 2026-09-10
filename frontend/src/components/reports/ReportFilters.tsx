export function ReportFilters({
  filters, onChange,
}: {
  filters: { status: string };
  onChange: (status: string) => void;
}) {
  const FILTERS = [
    { value: 'ALL', label: 'All' },
    { value: 'SUBMITTED', label: 'Submitted' },
    { value: 'UNDER_REVIEW', label: 'Under review' },
    { value: 'VERIFIED', label: 'Verified' },
    { value: 'ASSIGNED', label: 'Assigned' },
    { value: 'IN_PROGRESS', label: 'In progress' },
    { value: 'RESOLVED', label: 'Resolved' },
    { value: 'CLOSED', label: 'Closed' },
    { value: 'REJECTED', label: 'Rejected' },
    { value: 'REOPENED', label: 'Reopened' },
  ];
  return (
    <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter reports by status">
      {FILTERS.map((f) => (
        <button
          key={f.value}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${filters.status === f.value ? 'border-rwanda-blue bg-rwanda-blue text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
          onClick={() => onChange(f.value)}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

export function ReportSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      className="input"
      placeholder="Search by reference (RCP-2026-…) or title…"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Search reports"
    />
  );
}
