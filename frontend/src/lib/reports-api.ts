// ─────────────────────────────────────────────────────────────
// R-CPI Task 3 — canonical REST client (ADDITIVE, spec §42)
// Uses the same envelope + refresh logic as lib/api.ts.
// Spec §42 routes: POST/GET /reports, PATCH verify/reject/assign/
// status/deadline/resolve/close/reopen, evidence, history,
// overdue, statistics. The additive router (routes/report.routes.ts)
// serves these; until mounted, calls fail with a clear message.
import { citizenApi, workflowApi } from '../lib/api';

async function failPending<T>(): Promise<T> {
  throw new Error('Task 3 canonical /reports router is not mounted yet — see TASK3-GAP-FILL.md wiring step.');
}

export const reportsApi = {
  // Reads served by the existing workflow + citizen surfaces today.
  list: citizenApi.reports,
  detail: citizenApi.report,
  history: citizenApi.timeline,
  stats: workflowApi.stats,
  transition: workflowApi.transition,
  // Mutations served by the additive Task 3 router once mounted.
  verify: failPending,
  reject: failPending,
  assign: failPending,
  update: citizenApi.updateReport,
  deadline: failPending,
  resolve: failPending,
  close: failPending,
  reopen: citizenApi.reopen,
};
