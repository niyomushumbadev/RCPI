import { Router } from 'express';
import * as support from '../controllers/supportController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// Every administrative level may manage reference data (categories,
// departments) in their dashboard; user management stays stricter.
const ADMIN_MANAGERS = requireRole('DISTRICT_ADMIN', 'PROVINCE_ADMIN', 'CITY_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN');

// ── Geography: public read for registration + reporting forms ──
export const geoRouter = Router();
geoRouter.get('/provinces', support.getProvinces);
geoRouter.get('/districts', support.getDistricts);
geoRouter.get('/sectors', support.getSectors);
geoRouter.get('/cells', support.getCells);

// ── Categories: public read (form needs it), admin write ──
export const categoryRouter = Router();
categoryRouter.get('/', support.getCategories);
categoryRouter.post('/', authenticate, ADMIN_MANAGERS, support.createCategory);
categoryRouter.put('/:id', authenticate, ADMIN_MANAGERS, support.updateCategory);
categoryRouter.delete('/:id', authenticate, ADMIN_MANAGERS, support.deleteCategory);

// ── Departments: read for workflow, admin write ──
export const departmentRouter = Router();
departmentRouter.get('/', authenticate, support.getDepartments); // ?all=true (admin) includes inactive
departmentRouter.post('/', authenticate, ADMIN_MANAGERS, support.createDepartment);
departmentRouter.put('/:id', authenticate, ADMIN_MANAGERS, support.updateDepartment);
departmentRouter.delete('/:id', authenticate, ADMIN_MANAGERS, support.deleteDepartment);

// ── Notifications: any authenticated user ──
export const notificationRouter = Router();
notificationRouter.use(authenticate);
notificationRouter.get('/', support.getNotifications);
notificationRouter.put('/read-all', support.markAllNotificationsRead);
notificationRouter.put('/:id/read', support.markNotificationRead);
notificationRouter.delete('/:id', support.deleteNotification);

// ── Community alerts ──
export const alertRouter = Router();
const alertManagers = requireRole('OFFICER', 'DISTRICT_ADMIN', 'PROVINCE_ADMIN', 'CITY_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN');
alertRouter.get('/', support.getPublicAlerts);
alertRouter.get('/manage', authenticate, alertManagers, support.listAllAlerts);
alertRouter.post('/', authenticate, alertManagers, support.createAlert);
alertRouter.put('/:id', authenticate, alertManagers, support.updateAlert);
alertRouter.delete('/:id', authenticate, alertManagers, support.deleteAlert);
