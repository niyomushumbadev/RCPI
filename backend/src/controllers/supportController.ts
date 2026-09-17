import type { Request, Response } from 'express';
import { prisma } from '../config/db';
import { ok, fail, notFound } from '../utils/helpers';

// ─── Geography (Task 5 / Rwanda administrative structure) ───

// GET /api/v1/geo/provinces
export async function getProvinces(_req: Request, res: Response) {
  const provinces = await prisma.province.findMany({ orderBy: { name: 'asc' } });
  return ok(res, { provinces });
}

// GET /api/v1/geo/districts?provinceId=
export async function getDistricts(req: Request, res: Response) {
  const provinceId = req.query.provinceId ? Number(req.query.provinceId) : undefined;
  const districts = await prisma.district.findMany({
    where: provinceId ? { provinceId } : {},
    orderBy: { name: 'asc' },
    include: { province: { select: { name: true } } },
  });
  return ok(res, { districts });
}

// GET /api/v1/geo/sectors?districtId=
export async function getSectors(req: Request, res: Response) {
  const districtId = req.query.districtId ? Number(req.query.districtId) : undefined;
  const sectors = await prisma.sector.findMany({
    where: districtId ? { districtId } : {},
    orderBy: { name: 'asc' },
  });
  return ok(res, { sectors });
}

// GET /api/v1/geo/cells?sectorId=
export async function getCells(req: Request, res: Response) {
  const sectorId = req.query.sectorId ? Number(req.query.sectorId) : undefined;
  const cells = await prisma.cell.findMany({
    where: sectorId ? { sectorId } : {},
    orderBy: { name: 'asc' },
  });
  return ok(res, { cells });
}

// ─── Categories (Task 9 — admin-managed, never hardcoded in frontend) ───

// GET /api/v1/categories
export async function getCategories(req: Request, res: Response) {
  const activeOnly = req.query.activeOnly !== 'false';
  const categories = await prisma.category.findMany({
    where: activeOnly ? { isActive: true } : {},
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  return ok(res, { categories });
}

// POST /api/v1/categories (admin)
export async function createCategory(req: Request, res: Response) {
  const { name, nameRw, nameFr, icon, color } = req.body ?? {};
  if (!name) return fail(res, 'Category name is required', 422);
  const exists = await prisma.category.findUnique({ where: { name: String(name).trim() } });
  if (exists) return fail(res, 'A category with this name already exists', 409);
  const category = await prisma.category.create({
    data: { name: String(name).trim(), nameRw: nameRw ?? null, nameFr: nameFr ?? null, icon: icon ?? null, color: color ?? null },
  });
  return ok(res, { category }, 'Category created', 201);
}

// PUT /api/v1/categories/:id (admin)
export async function updateCategory(req: Request, res: Response) {
  const id = Number(req.params.id);
  const { name, nameRw, nameFr, icon, color, isActive } = req.body ?? {};
  const category = await prisma.category.update({
    where: { id },
    data: {
      ...(name ? { name: String(name).trim() } : {}),
      ...(nameRw !== undefined ? { nameRw } : {}),
      ...(nameFr !== undefined ? { nameFr } : {}),
      ...(icon !== undefined ? { icon } : {}),
      ...(color !== undefined ? { color } : {}),
      ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
    },
  });
  return ok(res, { category }, 'Category updated');
}

// DELETE /api/v1/categories/:id (admin) — blocked when referenced; deactivate instead
export async function deleteCategory(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return notFound(res, 'Category not found');
  const [reports, children] = await Promise.all([
    prisma.report.count({ where: { categoryId: id } }),
    prisma.category.count({ where: { parentId: id } }),
  ]);
  if (reports > 0 || children > 0) {
    return fail(res, `Cannot delete this category: ${reports} report(s) and ${children} sub-category(ies) reference it. Deactivate it instead.`, 409);
  }
  const category = await prisma.category.delete({ where: { id } }).catch(() => null);
  if (!category) return notFound(res, 'Category not found');
  return ok(res, null, 'Category deleted');
}

// ─── Departments (admin) ───

// GET /api/v1/departments?all=true (admin) — all=true includes inactive rows
export async function getDepartments(req: Request, res: Response) {
  const includeInactive = req.query.all === 'true';
  const departments = await prisma.department.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: { name: 'asc' },
  });
  return ok(res, { departments });
}

// POST /api/v1/departments (admin)
export async function createDepartment(req: Request, res: Response) {
  const { name, nameRw, nameFr, email, phone } = req.body ?? {};
  if (!name) return fail(res, 'Department name is required', 422);
  const exists = await prisma.department.findUnique({ where: { name: String(name).trim() } });
  if (exists) return fail(res, 'A department with this name already exists', 409);
  const department = await prisma.department.create({
    data: { name: String(name).trim(), nameRw: nameRw ?? null, nameFr: nameFr ?? null, email: email ?? null, phone: phone ?? null },
  });
  return ok(res, { department }, 'Department created', 201);
}

// PUT /api/v1/departments/:id (admin)
export async function updateDepartment(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return notFound(res, 'Department not found');
  const { name, nameRw, nameFr, email, phone, isActive } = req.body ?? {};
  if (name) {
    const exists = await prisma.department.findFirst({ where: { name: String(name).trim(), id: { not: id } } });
    if (exists) return fail(res, 'A department with this name already exists', 409);
  }
  const department = await prisma.department.update({
    where: { id },
    data: {
      ...(name ? { name: String(name).trim() } : {}),
      ...(nameRw !== undefined ? { nameRw } : {}),
      ...(nameFr !== undefined ? { nameFr } : {}),
      ...(email !== undefined ? { email: email || null } : {}),
      ...(phone !== undefined ? { phone: phone || null } : {}),
      ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
    },
  }).catch(() => null);
  if (!department) return notFound(res, 'Department not found');
  return ok(res, { department }, 'Department updated');
}

// DELETE /api/v1/departments/:id (admin) — blocked when reports are assigned
export async function deleteDepartment(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return notFound(res, 'Department not found');
  const reports = await prisma.report.count({ where: { departmentId: id } });
  if (reports > 0) {
    return fail(res, `Cannot delete this department: ${reports} report(s) are assigned to it. Deactivate it instead.`, 409);
  }
  const department = await prisma.department.delete({ where: { id } }).catch(() => null);
  if (!department) return notFound(res, 'Department not found');
  return ok(res, null, 'Department deleted');
}

// ─── Notifications (any authenticated user) ───

// GET /api/v1/notifications
export async function getNotifications(req: Request, res: Response) {
  const page = Math.max(1, parseInt(req.query.page as string ?? '1', 10));
  const pageSize = 20;
  const userId = req.user!.sub;
  const [total, unreadCount, notifications] = await Promise.all([
    prisma.notification.count({ where: { userId } }),
    prisma.notification.count({ where: { userId, isRead: false } }),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return ok(res, { notifications, unreadCount, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
}

// PUT /api/v1/notifications/:id/read
export async function markNotificationRead(req: Request, res: Response) {
  const id = Number(req.params.id);
  await prisma.notification.updateMany({
    where: { id, userId: req.user!.sub },
    data: { isRead: true },
  });
  return ok(res, null, 'Notification marked as read');
}

// PUT /api/v1/notifications/read-all
export async function markAllNotificationsRead(req: Request, res: Response) {
  await prisma.notification.updateMany({
    where: { userId: req.user!.sub, isRead: false },
    data: { isRead: true },
  });
  return ok(res, null, 'All notifications marked as read');
}

// DELETE /api/v1/notifications/:id — owner only
export async function deleteNotification(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return notFound(res, 'Notification not found');
  const result = await prisma.notification.deleteMany({ where: { id, userId: req.user!.sub } });
  if (result.count === 0) return notFound(res, 'Notification not found');
  return ok(res, null, 'Notification deleted');
}

// ─── Community alerts (public) ───

// GET /api/v1/alerts (public — active & unexpired only)
export async function getPublicAlerts(_req: Request, res: Response) {
  const alerts = await prisma.communityAlert.findMany({
    where: { isActive: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  return ok(res, { alerts });
}

// GET /api/v1/alerts/manage (staff) — full list for dashboards, incl. inactive/expired
export async function listAllAlerts(_req: Request, res: Response) {
  const alerts = await prisma.communityAlert.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  return ok(res, { alerts });
}

// POST /api/v1/alerts (admin/officer) — only authorized government users issue alerts (§36)
export async function createAlert(req: Request, res: Response) {
  const { title, message, severity, category, provinceId, districtId, expiresAt } = req.body ?? {};
  if (!title || !message) return fail(res, 'Title and message are required', 422);
  const alert = await prisma.communityAlert.create({
    data: {
      title: String(title).slice(0, 200),
      message: String(message).slice(0, 1000),
      severity: ['INFO', 'WARNING', 'CRITICAL'].includes(severity) ? severity : 'INFO',
      category: category ?? null,
      provinceId: provinceId ? Number(provinceId) : null,
      districtId: districtId ? Number(districtId) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  });
  return ok(res, { alert }, 'Alert published', 201);
}

// PUT /api/v1/alerts/:id (admin/officer) — edit or deactivate an existing alert
export async function updateAlert(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return notFound(res, 'Alert not found');
  const { title, message, severity, category, provinceId, districtId, expiresAt, isActive } = req.body ?? {};
  const alert = await prisma.communityAlert.update({
    where: { id },
    data: {
      ...(title ? { title: String(title).slice(0, 200) } : {}),
      ...(message ? { message: String(message).slice(0, 1000) } : {}),
      ...(severity ? { severity: ['INFO', 'WARNING', 'CRITICAL'].includes(severity) ? severity : 'INFO' } : {}),
      ...(category !== undefined ? { category: category || null } : {}),
      ...(provinceId !== undefined ? { provinceId: provinceId ? Number(provinceId) : null } : {}),
      ...(districtId !== undefined ? { districtId: districtId ? Number(districtId) : null } : {}),
      ...(expiresAt !== undefined ? { expiresAt: expiresAt ? new Date(expiresAt) : null } : {}),
      ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
    },
  }).catch(() => null);
  if (!alert) return notFound(res, 'Alert not found');
  return ok(res, { alert }, 'Alert updated');
}

// DELETE /api/v1/alerts/:id (admin/officer)
export async function deleteAlert(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return notFound(res, 'Alert not found');
  const alert = await prisma.communityAlert.delete({ where: { id } }).catch(() => null);
  if (!alert) return notFound(res, 'Alert not found');
  return ok(res, null, 'Alert deleted');
}
