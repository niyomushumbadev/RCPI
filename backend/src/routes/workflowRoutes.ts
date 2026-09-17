import { Router } from 'express';
import * as wf from '../controllers/workflowController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

const WORKFLOW_VIEWERS = ['CELL_OFFICER', 'SECTOR_OFFICER', 'OFFICER', 'DISTRICT_ADMIN', 'PROVINCE_ADMIN', 'CITY_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN', 'ANALYST', 'EXECUTIVE'];
const WORKFLOW_STAFF = ['CELL_OFFICER', 'SECTOR_OFFICER', 'OFFICER', 'DISTRICT_ADMIN', 'PROVINCE_ADMIN', 'CITY_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'];

router.use(authenticate);

router.get('/reopen-requests', requireRole(...WORKFLOW_VIEWERS), wf.listReopenRequests);
router.post('/reopen-requests/:id/review', requireRole(...WORKFLOW_STAFF), wf.reviewReopenRequest);
router.get('/stats', requireRole(...WORKFLOW_VIEWERS), wf.stats);
// Assignable staff list for the review workbench (any staff member can look up colleagues).
router.get('/staff', requireRole(...WORKFLOW_STAFF), wf.listStaff);
// "Assigned Reports" worklist for the signed-in administrator (spec §4, §12).
router.get('/assignments', requireRole(...WORKFLOW_STAFF), wf.listMyAssignments);
router.get('/archive', requireRole(...WORKFLOW_VIEWERS), wf.listArchivedReports);
router.get('/reports', requireRole(...WORKFLOW_VIEWERS), wf.listReports);
router.get('/reports/:id', requireRole(...WORKFLOW_VIEWERS), wf.getReport);
router.post('/reports/:id/transition', requireRole(...WORKFLOW_STAFF), wf.transition);
router.post('/reports/:id/assign', requireRole(...WORKFLOW_STAFF), wf.assignReport);
router.post('/reports/:id/deadline', requireRole(...WORKFLOW_STAFF), wf.setDeadline);
router.post('/reports/:id/internal-note', requireRole(...WORKFLOW_STAFF), wf.addInternalNote);
router.post('/reports/:id/related', requireRole(...WORKFLOW_STAFF), wf.linkRelated);
router.post('/reports/:id/updates', requireRole(...WORKFLOW_STAFF), wf.postUpdate);
router.post('/reports/:id/messages', requireRole(...WORKFLOW_STAFF), wf.replyMessage);

export default router;
