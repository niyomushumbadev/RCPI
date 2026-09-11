import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { exportIntelligenceCsv, getIntelligenceDashboard, searchIntelligenceReports } from '../controllers/intelligence.controller';

const router = Router();
const GOVERNMENT = ['OFFICER', 'DISTRICT_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN', 'ANALYST'];
router.use(authenticate, requireRole(...GOVERNMENT));
router.get('/dashboard', getIntelligenceDashboard);
router.get('/reports/search', searchIntelligenceReports);
router.get('/reports/export.csv', exportIntelligenceCsv);
export default router;