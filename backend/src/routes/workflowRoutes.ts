import { Router } from 'express';
import * as wf from '../controllers/workflowController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// OFFICER + admin roles can act on the government workflow (Task 7)
router.use(authenticate, requireRole('OFFICER', 'DISTRICT_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'));

router.get('/stats', wf.stats);
router.get('/reports', wf.listReports);
router.get('/reports/:id', wf.getReport);
router.post('/reports/:id/transition', wf.transition);
router.post('/reports/:id/updates', wf.postUpdate);
router.post('/reports/:id/messages', wf.replyMessage);

export default router;
