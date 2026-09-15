import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import type { Request, Response } from 'express';
import { prisma } from '../config/db';
import { env } from '../config/env';
import { ok, fail } from '../utils/helpers';
import { signAccessToken } from '../middleware/auth';
import { audit } from '../services/audit.service';
import { notify } from '../services/notification.service';

const REFRESH_COOKIE = 'rcpi_refresh';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function issueSession(res: Response, user: { id: number; role: string; firstName: string; lastName: string }, req: Request, rememberMe: boolean) {
  const accessToken = signAccessToken({ sub: user.id, role: user.role, firstName: user.firstName, lastName: user.lastName });
  const refreshToken = crypto.randomBytes(48).toString('hex');

  const days = rememberMe ? 30 : env.jwt.refreshTokenDays;
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
      userAgent: req.headers['user-agent']?.slice(0, 250),
      ipAddress: req.ip,
    },
  });

  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: !env.isDev,
    sameSite: 'lax',
    maxAge: days * 24 * 60 * 60 * 1000,
  });

  return { accessToken };
}

function publicUser(user: {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  preferredLanguage: string;
  role: { name: string };
  provinceId: number | null;
  districtId: number | null;
  sectorId: number | null;
}) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    preferredLanguage: user.preferredLanguage,
    role: user.role.name,
    provinceId: user.provinceId,
    districtId: user.districtId,
    sectorId: user.sectorId,
  };
}

// POST /api/v1/auth/register — citizens self-register
export async function register(req: Request, res: Response) {
  const { firstName, lastName, email, phone, password, preferredLanguage, provinceId, districtId, sectorId } = req.body ?? {};

  if (!firstName || !lastName || !email || !password) {
    return fail(res, 'First name, last name, email and password are required', 422);
  }
  if (password.length < 8) {
    return fail(res, 'Password must be at least 8 characters long', 422);
  }
  const emailNorm = String(email).toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email: emailNorm } });
  if (existing) {
    return fail(res, 'An account with this email already exists', 409);
  }

  const citizenRole = await prisma.role.findUnique({ where: { name: 'CITIZEN' } });
  if (!citizenRole) return fail(res, 'System not initialised. Contact support.', 500);

  const passwordHash = await bcrypt.hash(password, env.bcryptRounds);

  const user = await prisma.user.create({
    data: {
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      email: emailNorm,
      phone: phone ? String(phone).trim() : null,
      passwordHash,
      preferredLanguage: ['rw', 'en', 'fr'].includes(preferredLanguage) ? preferredLanguage : 'rw',
      roleId: citizenRole.id,
      provinceId: provinceId ? Number(provinceId) : null,
      districtId: districtId ? Number(districtId) : null,
      sectorId: sectorId ? Number(sectorId) : null,
    },
    include: { role: true },
  });

  await audit(req, { action: 'USER_REGISTERED', resourceType: 'USER', resourceId: String(user.id) });

  const { accessToken } = await issueSession(res, { id: user.id, role: user.role.name, firstName: user.firstName, lastName: user.lastName }, req, false);
  return ok(res, { user: publicUser(user), accessToken }, 'Account created successfully', 201);
}

// POST /api/v1/auth/login
export async function login(req: Request, res: Response) {
  const { email, password, rememberMe } = req.body ?? {};
  if (!email || !password) {
    return fail(res, 'Email and password are required', 422);
  }

  const emailNorm = String(email).toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email: emailNorm }, include: { role: true } });

  // Generic failure message: never reveal whether the account exists (Task 10 §6)
  const genericError = 'Invalid email or password';
  if (!user) return fail(res, genericError, 401);

  if (!user.isActive) {
    return fail(res, 'This account has been deactivated. Contact support.', 403);
  }

  // Account lockout (Task 10 §5)
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return fail(res, `Account temporarily locked. Try again in ${mins} minute(s).`, 423);
  }

  const passwordOk = await bcrypt.compare(String(password), user.passwordHash);
  if (!passwordOk) {
    const failed = user.failedLoginCount + 1;
    const shouldLock = failed >= env.lockout.maxFailedAttempts;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: shouldLock ? 0 : failed,
        lockedUntil: shouldLock ? new Date(Date.now() + env.lockout.accountLockMinutes * 60000) : null,
      },
    });
    if (shouldLock) {
      await audit(req, { actorId: user.id, actorName: `${user.firstName} ${user.lastName}`, action: 'ACCOUNT_LOCKED', resourceType: 'USER', resourceId: String(user.id), detail: 'Too many failed login attempts' });
    }
    return fail(res, genericError, 401);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  await audit(req, { actorId: user.id, actorName: `${user.firstName} ${user.lastName}`, action: 'LOGIN', resourceType: 'USER', resourceId: String(user.id) });
  await notify({ userId: user.id, type: 'SECURITY_NEW_LOGIN', title: 'New login', message: 'Your R-CPI account was just accessed. If this was not you, please change your password immediately.' });

  const { accessToken } = await issueSession(res, { id: user.id, role: user.role.name, firstName: user.firstName, lastName: user.lastName }, req, Boolean(rememberMe));
  return ok(res, { user: publicUser(user), accessToken }, 'Login successful');
}

// POST /api/v1/auth/forgot-password — issue a single-use reset token.
// Always returns success (no account enumeration). In this build the token
// is returned in dev responses only; wire SMS/email later via notify channels.
export async function forgotPassword(req: Request, res: Response) {
  const { email } = req.body ?? {};
  const emailNorm = String(email ?? '').toLowerCase().trim();
  if (emailNorm) {
    const user = await prisma.user.findUnique({ where: { email: emailNorm } });
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      await audit(req, { actorId: user.id, action: 'PASSWORD_RESET_REQUESTED', resourceType: 'USER', resourceId: String(user.id) });
      if (env.isDev) {
        return ok(res, { resetToken: token }, 'Password reset token created (development only)');
      }
    }
  }
  return ok(res, null, 'If the account exists, password reset instructions have been sent.');
}

// POST /api/v1/auth/reset-password — consume a reset token.
export async function resetPassword(req: Request, res: Response) {
  const { token, newPassword } = req.body ?? {};
  if (!token || !newPassword || String(newPassword).length < 8) {
    return fail(res, 'A valid token and a password of at least 8 characters are required', 422);
  }
  const stored = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(String(token)) } });
  if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
    return fail(res, 'This reset link is invalid or has expired', 400);
  }
  const passwordHash = await bcrypt.hash(String(newPassword), env.bcryptRounds);
  await prisma.$transaction([
    prisma.user.update({ where: { id: stored.userId }, data: { passwordHash, failedLoginCount: 0, lockedUntil: null } }),
    prisma.passwordResetToken.update({ where: { id: stored.id }, data: { usedAt: new Date() } }),
    prisma.refreshToken.updateMany({ where: { userId: stored.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  await audit(req, { actorId: stored.userId, action: 'PASSWORD_RESET_COMPLETED', resourceType: 'USER', resourceId: String(stored.userId) });
  return ok(res, null, 'Password reset successfully. Please log in with your new password.');
}

// POST /api/v1/auth/refresh — rotate refresh token, return new access token
export async function refresh(req: Request, res: Response) {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) return fail(res, 'No session found', 401);

  const tokenHash = hashToken(token);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: { include: { role: true } } } });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    res.clearCookie(REFRESH_COOKIE);
    return fail(res, 'Session expired. Please log in again.', 401);
  }

  if (!stored.user.isActive) {
    return fail(res, 'Account deactivated', 403);
  }

  // Rotation: revoke old, issue new (Task 10 §9)
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });

  const user = stored.user;
  const { accessToken } = await issueSession(res, { id: user.id, role: user.role.name, firstName: user.firstName, lastName: user.lastName }, req, false);
  return ok(res, { user: publicUser(user), accessToken }, 'Session refreshed');
}

// POST /api/v1/auth/logout
export async function logout(req: Request, res: Response) {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (token) {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  res.clearCookie(REFRESH_COOKIE);
  if (req.user) {
    await audit(req, { action: 'LOGOUT', resourceType: 'USER', resourceId: String(req.user.sub) });
  }
  return ok(res, null, 'Logged out successfully');
}

// GET /api/v1/auth/me
export async function me(req: Request, res: Response) {
  if (!req.user) return fail(res, 'Authentication required', 401);
  const user = await prisma.user.findUnique({
    where: { id: req.user.sub },
    include: { role: true },
  });
  if (!user || !user.isActive) return fail(res, 'Account not found or deactivated', 404);
  return ok(res, { user: publicUser(user) });
}

// PUT /api/v1/auth/password — change own password
export async function changePassword(req: Request, res: Response) {
  if (!req.user) return fail(res, 'Authentication required', 401);
  const { currentPassword, newPassword } = req.body ?? {};
  if (!currentPassword || !newPassword) return fail(res, 'Current and new password are required', 422);
  if (String(newPassword).length < 8) return fail(res, 'New password must be at least 8 characters long', 422);

  const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
  if (!user) return fail(res, 'Account not found', 404);

  const currentOk = await bcrypt.compare(String(currentPassword), user.passwordHash);
  if (!currentOk) return fail(res, 'Current password is incorrect', 401);

  const passwordHash = await bcrypt.hash(String(newPassword), env.bcryptRounds);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  // Invalidate all sessions after password change (Task 10 §9)
  await prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
  res.clearCookie(REFRESH_COOKIE);

  await audit(req, { action: 'PASSWORD_CHANGED', resourceType: 'USER', resourceId: String(user.id) });
  await notify({ userId: user.id, type: 'SECURITY_PASSWORD_CHANGED', title: 'Password changed', message: 'Your R-CPI password was changed. If this was not you, contact support immediately.' });

  return ok(res, null, 'Password changed successfully. Please log in again.');
}
