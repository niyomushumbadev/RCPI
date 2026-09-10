import { Router } from 'express';
import * as support from '../controllers/supportController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// ── Geography: public read for registration + reporting forms ──
export const geoRouter = Router();
geoRouter.get('/provinces', support.getProvinces);
geoRouter.get('/districts', support.getDistricts);
geoRouter.get('/sectors', support.getSectors);
geoRouter.get('/cells', support.getCells);

// ── Categories: public read (form needs it), admin write ──
export const categoryRouter = Router();
categoryRouter.get('/', support.getCategories);
categoryRouter.post('/', authenticate, requireRole('SYSTEM_ADMIN', 'NATIONAL_ADMIN'), support.createCategory);
categoryRouter.put('/:id', authenticate, requireRole('SYSTEM_ADMIN', 'NATIONAL_ADMIN'), support.updateCategory);

// ── Departments: read for workflow, admin write ──
export const departmentRouter = Router();
departmentRouter.get('/', authenticate, support.getDepartments);
departmentRouter.post('/', authenticate, requireRole('SYSTEM_ADMIN', 'NATIONAL_ADMIN'), support.createDepartment);

// ── Notifications: any authenticated user ──
export const notificationRouter = Router();
notificationRouter.use(authenticate);
notificationRouter.get('/', support.getNotifications);
notificationRouter.put('/read-all', support.markAllNotificationsRead);
notificationRouter.put('/:id/read', support.markNotificationRead);

// ── Community alerts ──
export const alertRouter = Router();
alertRouter.get('/', support.getPublicAlerts);
alertRouter.post('/', authenticate, requireRole('OFFICER', 'DISTRICT_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'), support.createAlert);
