// ─────────────────────────────────────────────────────────────
// R-CPI Task 3 — canonical router (ADDITIVE, spec §42-44)
// Spec expects: src/routes/report.routes.ts
// (existing file is routes/reportRoutes.ts — untouched).
// Route order: /overdue + /statistics BEFORE /:id (§43).
// NOT mounted in app.ts yet — see TASK3-GAP-FILL.md wiring step.
// Mount with: api.use('/reports-task3', reportTask3Router)
// or merge into existing reportRoutes after review.
// ─────────────────────────────────────────────────────────────
import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validation.middleware';
import * as legacy from '../controllers/reportController';
import * as query from '../controllers/report-query.controller';
import * as lifecycle from '../controllers/report-lifecycle.controller';
import * as evidence from '../controllers/report-evidence.controller';
import {
  createReportSchema, editReportSchema, rejectSchema, assignSchema,
  statusSchema, deadlineSchema, resolveSchema, reopenSchema,
} from '../validators/report.validator';

const router = Router();
router.use(authenticate);

const STAFF = ['OFFICER', 'DISTRICT_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'];
const ANY = ['CITIZEN', 'OFFICER', 'DISTRICT_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN', 'ANALYST'];

// Specific routes BEFORE parameterized (§43)
router.get('/overdue', requireRole(...STAFF), query.listOverdueReportsTask3);
router.get('/statistics', requireRole(...STAFF), query.getReportStatistics);
router.get('/filtered', requireRole(...ANY), query.listReportsFiltered);

router.get('/', requireRole(...ANY), query.listReportsFiltered);
router.post('/', requireRole('CITIZEN'), validateBody(createReportSchema), legacy.createReport);
router.get('/:id', requireRole(...ANY), legacy.getReport);
router.put('/:id', requireRole(...ANY), validateBody(editReportSchema), lifecycle.updateReportTask3);
router.delete('/:id', requireRole('NATIONAL_ADMIN', 'SYSTEM_ADMIN'), lifecycle.deleteReportTask3);

router.get('/:id/history', requireRole(...ANY), legacy.getReportHistory);
router.post('/:id/transition', requireRole(...STAFF), legacy.transitionStatus);
router.post('/:id/verify', requireRole(...STAFF), legacy.verifyReport);
router.post('/:id/reject', requireRole(...STAFF), validateBody(rejectSchema), legacy.rejectReport);
router.post('/:id/assign', requireRole(...STAFF), validateBody(assignSchema), legacy.assignReport);

// PATCH aliases (§42)
router.patch('/:id/verify', requireRole(...STAFF), legacy.verifyReport);
router.patch('/:id/reject', requireRole(...STAFF), validateBody(rejectSchema), legacy.rejectReport);
router.patch('/:id/assign', requireRole(...STAFF), validateBody(assignSchema), legacy.assignReport);
router.patch('/:id/status', requireRole(...STAFF), validateBody(statusSchema), lifecycle.changeStatusTask3);
router.patch('/:id/deadline', requireRole(...STAFF), validateBody(deadlineSchema), lifecycle.setDeadlineTask3);
router.patch('/:id/resolve', requireRole(...STAFF), validateBody(resolveSchema), lifecycle.resolveReportTask3);
router.patch('/:id/close', requireRole(...STAFF), lifecycle.closeReportTask3);
router.patch('/:id/reopen', requireRole(...STAFF), validateBody(reopenSchema), lifecycle.reopenReportTask3);

// Evidence (§30)
router.post('/:id/evidence', requireRole(...STAFF, 'CITIZEN'), evidence.evidenceUpload.single('file'), evidence.uploadEvidenceTask3);
router.get('/:id/evidence', requireRole(...ANY), evidence.listEvidenceTask3);

export default router;
