import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { prisma } from '../config/db';
import { env } from '../config/env';
import { ok, fail, notFound } from '../utils/helpers';
import { audit } from '../services/audit.service';
import { sendCredentialsEmail, emailConfigured } from '../services/email.service';
import { runDeadlineScan } from '../services/deadline.service';
import { sendSMS, smsConfigured, normalizeRwandanPhone } from '../services/sms.service';

// POST /api/v1/admin/deadline-scan — manual trigger for the deadline monitor.
// The scheduler runs automatically every 30 min; this lets SYSTEM_ADMIN /
// NATIONAL_ADMIN force a pass (e.g. after mass deadline edits) and read the
// counts. Full results land in each recipient's notification list.
export async function triggerDeadlineScan(_req: Request, res: Response) {
  const result = await runDeadlineScan();
  return ok(res, result, `Deadline scan complete: ${result.approaching} approaching, ${result.overdue} overdue (of ${result.scanned} reports with deadlines)`);
}

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

  // Email the sign-in credentials (Resend when configured; console log in dev).
  const emailSent = await sendCredentialsEmail({
    to: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: role.name,
    temporaryPassword: String(password),
  });

  // SMS the temporary password too when a Rwandan phone was provided and
  // Twilio is configured (best-effort — never blocks account creation).
  let smsSent = false;
  const normalizedPhone = phone ? normalizeRwandanPhone(String(phone)) : null;
  if (normalizedPhone && smsConfigured()) {
    smsSent = await sendSMS({
      to: normalizedPhone,
      message: `R-CPI: Account created (${role.name}). Email ${user.email}, temp password ${password}. Sign in at ${env.frontendUrl}/login and change it immediately.`,
    });
  }

  return ok(
    res,
    {
      user: { id: user.id, email: user.email, role: role.name },
      credentialsEmail: emailSent ? 'SENT' : emailConfigured() ? 'FAILED' : 'DEV_LOGGED',
      credentialsSMS: smsSent ? 'SENT' : smsConfigured() ? 'SKIPPED_NO_PHONE' : 'DEV_LOGGED',
    },
    emailSent || smsSent
      ? 'User created successfully. Sign-in credentials delivered.'
      : 'User created successfully. Email/SMS not configured — credentials shown in the app / dev console.',
    201
  );
}

// DELETE /api/v1/admin/users/:id — permanently remove a user account.
// Guards:
//   • SYSTEM_ADMIN only (route-level) and never the caller's own account.
//   • Users who are the citizen of record on reports cannot be deleted —
//     reports must keep their author for integrity; deactivate instead.
//   • Sessions (refresh tokens) and role links are removed with the account.
//   • Action is written to the audit log before the row disappears.
export async function deleteUser(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return fail(res, 'Invalid user id', 422);
  if (req.user!.sub === id) return fail(res, 'You cannot delete your own account', 422);

  const user = await prisma.user.findUnique({ where: { id }, include: { role: true } });
  if (!user) return notFound(res, 'User not found');

  const reportCount = await prisma.report.count({ where: { citizenId: id } });
  if (reportCount > 0) {
    return fail(res, `This user has ${reportCount} report(s) filed under their account and cannot be deleted. Deactivate the account instead to preserve report history.`, 409);
  }

  await prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
  await audit(req, { action: 'USER_DELETED', resourceType: 'USER', resourceId: String(id), detail: `${user.email} role=${user.role.name}` });
  await prisma.user.delete({ where: { id } });

  return ok(res, null, `User ${user.firstName} ${user.lastName} (${user.email}) deleted`);
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

// PUT /api/v1/admin/users/:id/role — system administrators can delegate a role.
export async function setUserRole(req: Request, res: Response) {
  const id = Number(req.params.id);
  const roleName = String(req.body?.roleName ?? '').trim();
  const role = await prisma.role.findUnique({ where: { name: roleName } });
  if (!role) return fail(res, 'Invalid role', 422);
  if (id === req.user!.sub && role.name !== 'SYSTEM_ADMIN') return fail(res, 'You cannot remove your own system-admin role', 422);
  const user = await prisma.user.update({ where: { id }, data: { roleId: role.id }, include: { role: true } });
  await audit(req, { action: 'USER_ROLE_CHANGED', resourceType: 'USER', resourceId: String(id), detail: `${user.email} role=${role.name}` });
  return ok(res, { user: { id: user.id, email: user.email, role: user.role.name } }, 'User role updated');
}

export async function listPermissions(_req: Request, res: Response) {
  const [permissions, roles] = await Promise.all([
    prisma.permission.findMany({ orderBy: { code: 'asc' } }),
    prisma.role.findMany({ orderBy: { name: 'asc' }, include: { permissions: { include: { permission: true } } } }),
  ]);
  return ok(res, { permissions, roles: roles.map((role) => ({ id: role.id, name: role.name, description: role.description, permissions: role.permissions.map((item) => item.permission.code) })) });
}

export async function setRolePermissions(req: Request, res: Response) {
  const roleId = Number(req.params.roleId);
  const codes = Array.isArray(req.body?.permissionCodes) ? req.body.permissionCodes.map(String) : [];
  const [role, permissions] = await Promise.all([
    prisma.role.findUnique({ where: { id: roleId } }),
    prisma.permission.findMany({ where: { code: { in: codes } } }),
  ]);
  if (!role) return fail(res, 'Role not found', 404);
  await prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId } });
    if (permissions.length) await tx.rolePermission.createMany({ data: permissions.map((permission) => ({ roleId, permissionId: permission.id })) });
  });
  await audit(req, { action: 'ROLE_PERMISSIONS_CHANGED', resourceType: 'ROLE', resourceId: String(roleId), detail: `${role.name}: ${permissions.map((permission) => permission.code).join(', ')}` });
  return ok(res, { role: role.name, permissionCodes: permissions.map((permission) => permission.code) }, 'Role permissions updated');
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

// GET /api/v1/admin/settings — system configuration (master spec §15).
export async function listSettings(_req: Request, res: Response) {
  const settings = await prisma.systemSetting.findMany({ orderBy: { key: 'asc' } });
  const defaults: Record<string, string> = {
    OPENAI_MODEL: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    AI_ENABLED: process.env.OPENAI_API_KEY ? 'true' : 'false',
    SLA_HOURS: '48',
    DATA_RETENTION_DAYS: '1825',
    MAINTENANCE_MODE: 'false',
  };
  const merged = Object.entries(defaults).map(([key, fallback]) => {
    const stored = settings.find((s) => s.key === key);
    return { key, value: stored?.value ?? fallback };
  });
  for (const s of settings) {
    if (!merged.find((m) => m.key === s.key)) merged.push({ key: s.key, value: s.value ?? '' });
  }
  return ok(res, { settings: merged });
}

// PUT /api/v1/admin/settings — update system configuration (audited).
export async function updateSettings(req: Request, res: Response) {
  const { settings } = req.body ?? {};
  if (!settings || typeof settings !== 'object') return fail(res, 'A settings object is required', 422);
  const entries = Object.entries(settings as Record<string, unknown>).slice(0, 50);
  for (const [key, value] of entries) {
    const cleanKey = String(key).trim().slice(0, 80).toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    if (!cleanKey) continue;
    await prisma.systemSetting.upsert({
      where: { key: cleanKey },
      update: { value: String(value ?? '').slice(0, 2000), updatedBy: req.user!.sub },
      create: { key: cleanKey, value: String(value ?? '').slice(0, 2000), updatedBy: req.user!.sub },
    });
  }
  await audit(req, { action: 'SYSTEM_SETTINGS_UPDATED', resourceType: 'SYSTEM', detail: entries.map(([k]) => k).join(',').slice(0, 300) });
  return ok(res, null, 'System settings updated');
}
