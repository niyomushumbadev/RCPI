import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { getReportAI, retryReportAI, assistText, reviewAI, reportPriority, setPriority } from '../controllers/ai.controller';

const router = Router();
router.use(authenticate);
const VIEWERS = ['CITIZEN', 'CELL_OFFICER', 'SECTOR_OFFICER', 'OFFICER', 'DISTRICT_ADMIN', 'PROVINCE_ADMIN', 'CITY_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN', 'ANALYST', 'EXECUTIVE'];
const STAFF = ['CELL_OFFICER', 'SECTOR_OFFICER', 'OFFICER', 'DISTRICT_ADMIN', 'PROVINCE_ADMIN', 'CITY_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN', 'ANALYST'];
router.post('/assist', requireRole(...VIEWERS), assistText);
router.get('/reports/:id', requireRole(...VIEWERS), getReportAI);
router.post('/reports/:id/retry', requireRole(...STAFF), retryReportAI);
router.post('/reports/:id/review', requireRole(...STAFF), reviewAI);
router.get('/reports/:id/priority', requireRole(...VIEWERS), reportPriority);
router.put('/reports/:id/priority', requireRole(...STAFF), setPriority);
export default router;