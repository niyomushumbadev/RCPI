import { useState } from 'react';
import type { ReactNode } from 'react';

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="font-bold text-slate-900">{title}</h2>
        <div className="mt-3">{children}</div>
        <button className="btn-outline mt-4 w-full" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

export function ConfirmationDialog({ title, message, confirmLabel, onConfirm, onClose }: {
  title: string; message: string; confirmLabel: string; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-sm text-slate-600">{message}</p>
      <button className="btn-danger mt-4 w-full" onClick={onConfirm}>{confirmLabel}</button>
    </Modal>
  );
}

export function ReasonModal({ title, placeholder, confirmLabel, onConfirm, onClose }: {
  title: string; placeholder: string; confirmLabel: string; onConfirm: (reason: string) => void; onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <Modal title={title} onClose={onClose}>
      <textarea className="input min-h-24" required placeholder={placeholder} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
      <button className="btn-danger mt-4 w-full" disabled={!reason.trim()} onClick={() => onConfirm(reason.trim())}>{confirmLabel}</button>
    </Modal>
  );
}

export function ReportVerificationModal(props: { onConfirm: (note: string) => void; onClose: () => void }) {
  return <ReasonModal title="Verify report?" placeholder="Verification note (e.g. confirmed during field inspection)…" confirmLabel="Verify report" {...props} />;
}
export function ReportRejectionModal(props: { onConfirm: (reason: string) => void; onClose: () => void }) {
  return <ReasonModal title="Reject report?" placeholder="Rejection reason (required)…" confirmLabel="Reject report" {...props} />;
}
export function ReportReopenModal(props: { onConfirm: (reason: string) => void; onClose: () => void }) {
  return <ReasonModal title="Reopen report?" placeholder="Reason required…" confirmLabel="Reopen report" {...props} />;
}
export function ReportResolutionModal(props: { onConfirm: (resolution: string) => void; onClose: () => void }) {
  return <ReasonModal title="Resolve report" placeholder="Resolution description…" confirmLabel="Mark resolved" {...props} />;
}
export function ReportStatusModal({ allowed, onConfirm, onClose }: { allowed: string[]; onConfirm: (s: string) => void; onClose: () => void }) {
  const [s, setS] = useState(allowed[0] ?? '');
  return (
    <Modal title="Change status" onClose={onClose}>
      <select className="input" value={s} onChange={(e) => setS(e.target.value)}>
        {allowed.map((a) => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
      </select>
      <button className="btn-primary mt-4 w-full" disabled={!s} onClick={() => onConfirm(s)}>Confirm</button>
    </Modal>
  );
}
export function ReportDeadlineModal({ onConfirm, onClose }: { onConfirm: (d: string) => void; onClose: () => void }) {
  const [d, setD] = useState('');
  return (
    <Modal title="Set deadline" onClose={onClose}>
      <input type="datetime-local" className="input" value={d} onChange={(e) => setD(e.target.value)} />
      <button className="btn-primary mt-4 w-full" disabled={!d} onClick={() => onConfirm(new Date(d).toISOString())}>Set deadline</button>
    </Modal>
  );
}
export function ReportAssignmentModal({ onConfirm, onClose }: { onConfirm: (officerId: number) => void; onClose: () => void }) {
  const [id, setId] = useState('');
  return (
    <Modal title="Assign report" onClose={onClose}>
      <input className="input" placeholder="Officer user ID" value={id} onChange={(e) => setId(e.target.value)} />
      <button className="btn-primary mt-4 w-full" disabled={!id} onClick={() => onConfirm(Number(id))}>Assign</button>
    </Modal>
  );
}
