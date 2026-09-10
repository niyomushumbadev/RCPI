import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { prisma } from '../config/db';
import { env } from '../config/env';
import { ok, fail } from '../utils/helpers';
import { audit } from '../services/audit.service';

// GET /api/v1/admin/dashboard
export async function getAdminDashboard(req: Request, res: Response) {
  const [totalUsers, totalCitizens, totalReports, pendingReports, resolvedReports, totalCategories, totalDepartments, recentAudit] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: { name: 'CITIZEN' } } }),
    prisma.report.count(),
    prisma.report.count({ where: { status: { in: ['SUBMITTED', 'RECEIVED', 'UNDER_REVIEW'] } } }),
    prisma.report.count({ where: { status: { in: ['RESOLVED', 'CLOSED'] } } }),
    prisma.category.count(),
    prisma.department.count(),
    prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
  ]);

  return ok(res, {
    stats: { totalUsers, totalCitizens, totalReports, pendingReports, resolvedReports, totalCategories, totalDepartments },
    recentAudit: recentAudit.map((a) => ({
      id: a.id,
      actorName: a.actorName,
      action: a.action,
      resourceType: a.resourceType,
      resourceId: a.resourceId,
      detail: a.detail,
      createdAt: a.createdAt,
    })),
  });
}

// GET /api/v1/admin/users?page=&role=&q=
export async function listUsers(req: Request, res: Response) {
  const page = Math.max(1, parseInt(req.query.page as string ?? '1', 10));
  const pageSize = 15;
  const role = req.query.role as string | undefined;
  const q = (req.query.q as string | undefined)?.trim();

  const where = {
    ...(role && role !== 'ALL' ? { role: { name: role } } : {}),
    ...(q ? { OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }, { email: { contains: q } }] } : {}),
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { role: true, province: true, district: true },
    }),
  ]);

  return ok(res, {
    users: users.map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      phone: u.phone,
      role: u.role.name,
      province: u.province?.name ?? null,
      district: u.district?.name ?? null,
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
    })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

// POST /api/v1/admin/users — create staff users (officers, admins, analysts)
export async function createUser(req: Request, res: Response) {
  const { firstName, lastName, email, phone, password, roleName, provinceId, districtId } = req.body ?? {};
  if (!firstName || !lastName || !email || !password || !roleName) {
    return fail(res, 'All required fields must be provided', 422);
  }
  if (password.length < 8) return fail(res, 'Password must be at least 8 characters', 422);

  const role = await prisma.role.findUnique({ where: { name: String(roleName) } });
  if (!role) return fail(res, 'Invalid role', 422);

  const emailNorm = String(email).toLowerCase().trim();
  const exists = await prisma.user.findUnique({ where: { email: emailNorm } });
  if (exists) return fail(res, 'A user with this email already exists', 409);

  const passwordHash = await bcrypt.hash(String(password), env.bcryptRounds);
  const user = await prisma.user.create({
    data: {
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      email: emailNorm,
      phone: phone ? String(phone).trim() : null,
      passwordHash,
      roleId: role.id,
      provinceId: provinceId ? Number(provinceId) : null,
      districtId: districtId ? Number(districtId) : null,
      emailVerified: true, // staff accounts are created by admins
    },
  });

  await audit(req, { action: 'USER_CREATED', resourceType: 'USER', resourceId: String(user.id), detail: `${user.email} role=${role.name}` });
  return ok(res, { user: { id: user.id, email: user.email, role: role.name } }, 'User created successfully', 201);
}

// PUT /api/v1/admin/users/:id/status — activate/deactivate
export async function setUserStatus(req: Request, res: Response) {
  const id = Number(req.params.id);
  const { isActive } = req.body ?? {};
  if (typeof isActive !== 'boolean') return fail(res, 'isActive boolean is required', 422);

  if (req.user!.sub === id && !isActive) {
    return fail(res, 'You cannot deactivate your own account', 422);
  }

  const user = await prisma.user.update({ where: { id }, data: { isActive } });
  await prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });

  await audit(req, { action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED', resourceType: 'USER', resourceId: String(id), detail: user.email });
  return ok(res, null, `User ${isActive ? 'activated' : 'deactivated'}`);
}

// GET /api/v1/admin/audit-logs?page=&action=&resourceType=
export async function listAuditLogs(req: Request, res: Response) {
  const page = Math.max(1, parseInt(req.query.page as string ?? '1', 10));
  const pageSize = 25;
  const action = req.query.action as string | undefined;
  const resourceType = req.query.resourceType as string | undefined;

  const where = {
    ...(action ? { action: { contains: action } } : {}),
    ...(resourceType ? { resourceType } : {}),
  };

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return ok(res, { logs, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
}
