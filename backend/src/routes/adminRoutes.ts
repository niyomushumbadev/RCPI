import { Router } from 'express';
import * as admin from '../controllers/adminController';
import { requireRole } from '../middleware/auth';

const router = Router();

// Admin-only endpoints (Task 9). All routes already authenticated at app level;
// these additionally require an admin role.
const adminOnly = requireRole('SYSTEM_ADMIN', 'NATIONAL_ADMIN', 'DISTRICT_ADMIN');

router.get('/dashboard', adminOnly, admin.getAdminDashboard);
router.get('/users', adminOnly, admin.listUsers);
router.post('/users', adminOnly, admin.createUser);
router.put('/users/:id/status', adminOnly, admin.setUserStatus);
router.get('/audit-logs', adminOnly, admin.listAuditLogs);

export default router;
