# R-CPI Task 3 — Gap fill (additive only, nothing existing modified)

Date: 2026-09-10. The canonical Task 3 files existed under different names
(singular vs dotted, e.g. `reportController.ts` vs spec's `report.controller.ts`).
This change **adds only new files** (plus one additive method on the existing
`citizenApi` object for citizen report edits). No existing route, controller,
service, page or schema was edited, renamed or deleted.

## New backend files (spec §44)

| Spec path | Added file | Notes |
|---|---|---|
| `src/controllers/report.controller.ts` | shim re-exporting `reportController.ts` | both import paths work |
| `src/controllers/report-query.controller.ts` | filtered list (§50-51), overdue (§26), statistics (§78) | role+district scoping; labeled 48h SLA heuristic until deadline migration |
| `src/controllers/report-lifecycle.controller.ts` | edit (§13-14), soft delete (§64), status (§22-23), deadline (§24-25), resolve/close/reopen (§27-29) | transactions (§57), role-aware matrix (§46), fail-safe 501s where columns pending |
| `src/controllers/report-evidence.controller.ts` | `POST/GET /reports/:id/evidence` (§30-32) | mime+ext+size checks, random stored names, executables blocked |
| `src/services/report-status.service.ts` | `canTransition(from,to,role)` (§46) | wraps existing matrix; CITIZEN/ANALYST get no staff targets |
| `src/validators/report.validator.ts` | zod schemas (§60) | create/edit/verify/reject/assign/status/deadline/resolve/close/reopen |
| `src/repositories/report.repository.ts` | thin Prisma layer (§44) | no business rules |
| `src/middleware/auth.middleware.ts` + `role.middleware.ts` + `validation.middleware.ts` | canonical filenames | shims over existing `auth.ts` + zod `validateBody` |
| `src/routes/report.routes.ts` | canonical router (§42-43) | **NOT mounted yet** — specific routes before `/:id` |
| `src/types/report.types.ts` | canonical types + §23 matrix + evidence types | |
| `src/utils/reference-generator.ts` | `RCP-YYYY-XXXXXX` (§11) | immutable format helper |

## New frontend files (spec §47, §70)

`components/reports/`: `ReportCard`, `ReportTable`, `ReportBadges`
(`ReportStatusBadge`/`ReportPriorityBadge`, text-first per §71),
`ReportFilters` + `ReportSearch`, `ReportTimeline`, `ReportEvidenceGallery`,
`ReportMap` (Leaflet+OSM), `ReportModals`
(`ReportVerificationModal`, `ReportRejectionModal`, `ReportAssignmentModal`,
`ReportDeadlineModal`, `ReportStatusModal`, `ReportResolutionModal`,
`ReportReopenModal`, `ConfirmationDialog`).
`pages/reports/`: `ReportListPage`, `CreateReportPage`, `ReportDetailsPage`,
`EditReportPage`, `VerifyReportPage`, `AssignReportPage`, `ReportHistoryPage`.
`lib/reports-api.ts`: canonical client (mutations fail with a clear message until router mounted).

One additive method on existing `citizenApi`: `updateReport` (§13).

## Still pending (require a decision + migration, NOT done here)

1. **Mount router** — `api.use('/reports', ...)` currently uses the legacy router;
   merging `report.routes.ts` needs a route-by-route decision (POST vs PATCH verbs).
2. **DB migration** — no Prisma schema change was made. Pending columns/tables:
   `reports.priority`, `reports.deadline`, `reports.deletedAt` (+ index),
   `report_assignments`, `report_verifications`, `report_deadlines`,
   `report_resolutions`, `report_media` (or extend `evidence` with
   uploader/evidence-type/description), `report_history` (or extend
   `report_status_history` with `action`/`metadata`).
3. **Citizen `PUT /citizen/reports/:id`** — frontend `updateReport` now calls it,
   but the backend citizen router has no PUT handler yet (404 until added).
4. **Tests + docs** beyond this file (§69, §80 checkboxes) — backend test runner
   isn't configured (`vitest`/`jest` absent).

## Acceptance (§80) — after this change

Newly satisfied by additive code (pending mount/migration where noted):
create/view/edit-eligible/verify/reject(with reason)/assign(persisted via
`assignedOfficerId`+history)/status(matrix+role enforced)/deadline(validation;
persistence after migration)/overdue(labeled heuristic)/resolve/close/reopen
(reason required)/evidence(validated)/history(auto, immutable)/notifications
(triggered)/RBAC+JWT/privacy(scoped queries)/map/search/filter/pagination/
validation/errors/transactions/audit. Canonical filenames now exist per §44/47/70.
