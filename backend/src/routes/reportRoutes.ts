import { Router } from 'express';
import * as report from '../controllers/reportController';
import { authenticate, requireRole } from '../middleware/auth';
import * as evidence from '../controllers/report-evidence.controller';
import * as query from '../controllers/report-query.controller';

const router = Router();

router.use(authenticate);

const STAFF = ['CELL_OFFICER', 'SECTOR_OFFICER', 'OFFICER', 'DISTRICT_ADMIN', 'PROVINCE_ADMIN', 'CITY_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'];
const VIEWERS = [...STAFF, 'CITIZEN', 'ANALYST', 'EXECUTIVE'];

// Specific routes first (before /:id)
router.get('/', requireRole(...STAFF), report.listReports);
router.get('/overdue', requireRole(...STAFF), report.listOverdueReports);
router.get('/query', requireRole(...STAFF), query.listReportsFiltered);
router.get('/statistics', requireRole(...STAFF), query.getReportStatistics);
router.get('/:id', requireRole(...VIEWERS), report.getReport);
router.get('/:id/history', requireRole(...VIEWERS), report.getReportHistory);
router.post('/:id/transition', requireRole(...STAFF), report.transitionStatus);
router.post('/:id/verify', requireRole('CELL_OFFICER', 'SECTOR_OFFICER', 'OFFICER', 'DISTRICT_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'), report.verifyReport);
router.post('/:id/reject', requireRole('CELL_OFFICER', 'SECTOR_OFFICER', 'OFFICER', 'DISTRICT_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'), report.rejectReport);
router.post('/:id/assign', requireRole('SECTOR_OFFICER', 'OFFICER', 'DISTRICT_ADMIN', 'PROVINCE_ADMIN', 'CITY_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'), report.assignReport);
router.post('/:id/evidence', requireRole('CITIZEN', ...STAFF), evidence.evidenceUpload.single('file'), evidence.uploadEvidenceTask3);
router.get('/:id/evidence', requireRole('CITIZEN', ...VIEWERS), evidence.listEvidenceTask3);
router.get('/:id/evidence/:evidenceId/download', requireRole('CITIZEN', ...VIEWERS), evidence.downloadEvidenceTask3);
router.delete('/:id/evidence/:evidenceId', requireRole('CITIZEN', ...STAFF, 'ANALYST'), evidence.deleteEvidenceTask3);

export default router;
