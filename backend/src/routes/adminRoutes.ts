import { Router } from 'express';
import * as admin from '../controllers/adminController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// Admin-only endpoints (Task 9). All routes already authenticated at app level;
// these additionally require an admin role.
const adminOnly = requireRole('SYSTEM_ADMIN', 'NATIONAL_ADMIN', 'DISTRICT_ADMIN', 'PROVINCE_ADMIN', 'CITY_ADMIN');

router.get('/dashboard', adminOnly, admin.getAdminDashboard);
router.get('/users', adminOnly, admin.listUsers);
router.post('/users', adminOnly, admin.createUser);
router.put('/users/:id/status', adminOnly, admin.setUserStatus);
router.delete('/users/:id', requireRole('SYSTEM_ADMIN'), admin.deleteUser);
router.put('/users/:id/role', requireRole('SYSTEM_ADMIN'), admin.setUserRole);
router.get('/permissions', requireRole('SYSTEM_ADMIN'), admin.listPermissions);
router.put('/roles/:roleId/permissions', requireRole('SYSTEM_ADMIN'), admin.setRolePermissions);
router.get('/audit-logs', adminOnly, admin.listAuditLogs);
router.post('/deadline-scan', requireRole('SYSTEM_ADMIN', 'NATIONAL_ADMIN'), admin.triggerDeadlineScan);
router.get('/settings', requireRole('SYSTEM_ADMIN', 'NATIONAL_ADMIN'), admin.listSettings);
router.put('/settings', requireRole('SYSTEM_ADMIN', 'NATIONAL_ADMIN'), admin.updateSettings);

export default router;
