import { Router } from 'express';
import * as report from '../controllers/reportController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', requireRole('OFFICER', 'DISTRICT_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'), report.listReports);
router.get('/overdue', requireRole('OFFICER', 'DISTRICT_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'), report.listOverdueReports);
router.get('/:id', requireRole('OFFICER', 'DISTRICT_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN', 'CITIZEN'), report.getReport);
router.get('/:id/history', requireRole('OFFICER', 'DISTRICT_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN', 'CITIZEN'), report.getReportHistory);
router.post('/:id/transition', requireRole('OFFICER', 'DISTRICT_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'), report.transitionStatus);
router.post('/:id/verify', requireRole('OFFICER', 'DISTRICT_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'), report.verifyReport);
router.post('/:id/reject', requireRole('OFFICER', 'DISTRICT_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'), report.rejectReport);
router.post('/:id/assign', requireRole('OFFICER', 'DISTRICT_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'), report.assignReport);

export default router;
