import { prisma } from '../config/db';
import type { Request } from 'express';

interface AuditEntry {
  actorId?: number | null;
  actorName?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  detail?: string | null;
}

/**
 * Task 10 §36-37: record every significant action.
 * Audit writes must never break the main request flow.
 */
export async function audit(req: Request | null, entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: entry.actorId ?? req?.user?.sub ?? null,
        actorName: entry.actorName ?? (req?.user ? `${req.user.firstName} ${req.user.lastName}` : null),
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId ?? null,
        ipAddress: req?.ip ?? null,
        userAgent: req?.headers?.['user-agent']?.slice(0, 250) ?? null,
        detail: entry.detail ?? null,
      },
    });
  } catch (err) {
    console.error('[audit] failed to write audit log:', err);
  }
}
