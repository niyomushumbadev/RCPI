import { Router } from 'express';
import * as wf from '../controllers/workflowController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

const WORKFLOW_VIEWERS = ['OFFICER', 'DISTRICT_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN', 'ANALYST'];
const WORKFLOW_STAFF = ['OFFICER', 'DISTRICT_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'];

router.use(authenticate);

router.get('/stats', requireRole(...WORKFLOW_VIEWERS), wf.stats);
router.get('/reports', requireRole(...WORKFLOW_VIEWERS), wf.listReports);
router.get('/reports/:id', requireRole(...WORKFLOW_VIEWERS), wf.getReport);
router.post('/reports/:id/transition', requireRole(...WORKFLOW_STAFF), wf.transition);
router.post('/reports/:id/updates', requireRole(...WORKFLOW_STAFF), wf.postUpdate);
router.post('/reports/:id/messages', requireRole(...WORKFLOW_STAFF), wf.replyMessage);

export default router;
