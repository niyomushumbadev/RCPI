import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { getReportAI, retryReportAI } from '../controllers/ai.controller';

const router = Router();
router.use(authenticate);
router.get('/reports/:id', requireRole('CITIZEN', 'OFFICER', 'DISTRICT_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN', 'ANALYST'), getReportAI);
router.post('/reports/:id/retry', requireRole('OFFICER', 'DISTRICT_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN', 'ANALYST'), retryReportAI);
export default router;