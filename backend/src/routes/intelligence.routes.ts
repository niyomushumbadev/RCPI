import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { exportIntelligenceCsv, getIntelligenceDashboard, searchIntelligenceReports, getExecutiveDashboard } from '../controllers/intelligence.controller';

const router = Router();
const GOVERNMENT = ['CELL_OFFICER', 'SECTOR_OFFICER', 'OFFICER', 'DISTRICT_ADMIN', 'PROVINCE_ADMIN', 'CITY_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN', 'ANALYST', 'EXECUTIVE'];
router.use(authenticate, requireRole(...GOVERNMENT));
router.get('/dashboard', getIntelligenceDashboard);
router.get('/executive', requireRole('NATIONAL_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE', 'ANALYST'), getExecutiveDashboard);
router.get('/reports/search', searchIntelligenceReports);
router.get('/reports/export.csv', exportIntelligenceCsv);
export default router;