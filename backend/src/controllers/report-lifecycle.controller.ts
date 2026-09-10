// R-CPI Task 3 — lifecycle, part 1: edit + soft delete (§13-14, §64)
import type { Request, Response } from 'express';
import { prisma } from '../config/db';
import { ok, fail, notFound } from '../utils/helpers';
import { audit } from '../services/audit.service';

const CITIZEN_EDITABLE = ['SUBMITTED', 'UNDER_REVIEW'];
export const TASK3_STAFF = ['OFFICER', 'DISTRICT_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'];

export async function updateReportTask3(req: Request, res: Response) {
  const id = Number(req.params.id);
  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) return notFound(res, 'Report not found');
  const isStaff = TASK3_STAFF.includes(req.user!.role);
  if (!isStaff && report.citizenId !== req.user!.sub) {
    return fail(res, 'You do not have permission to edit this report', 403);
  }
  const body = req.body ?? {};
  if (!isStaff) {
    if (!CITIZEN_EDITABLE.includes(report.status)) {
      return fail(res, `Reports with status ${report.status} can no longer be edited by citizens`, 409);
    }
    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = String(body.title).trim().slice(0, 200);
    if (body.description !== undefined) data.description = String(body.description).trim();
    if (body.sectorId !== undefined) data.sectorId = body.sectorId ? Number(body.sectorId) : null;
    if (body.cellId !== undefined) data.cellId = body.cellId ? Number(body.cellId) : null;
    if (body.latitude !== undefined) data.latitude = body.latitude === null || body.latitude === '' ? null : String(body.latitude);
    if (body.longitude !== undefined) data.longitude = body.longitude === null || body.longitude === '' ? null : String(body.longitude);
    if (body.locationDescription !== undefined) data.locationDescription = body.locationDescription ? String(body.locationDescription).slice(0, 300) : null;
    const updated = await prisma.report.update({ where: { id }, data: data as never });
    await prisma.reportStatusHistory.create({
      data: { reportId: id, fromStatus: report.status, toStatus: report.status, note: 'Citizen edited report details', actorId: req.user!.sub, actorName: `${req.user!.firstName} ${req.user!.lastName}` },
    });
    await audit(req, { action: 'REPORT_UPDATED', resourceType: 'REPORT', resourceId: String(id) });
    return ok(res, { report: { id: updated.id, reference: updated.reference, status: updated.status } }, 'Report updated');
  }
  const data: Record<string, unknown> = {};
  if (body.urgency !== undefined && ['LOW', 'MEDIUM', 'HIGH'].includes(body.urgency)) data.urgency = body.urgency;
  if (body.departmentId !== undefined) data.departmentId = body.departmentId ? Number(body.departmentId) : null;
  if (body.isPublic !== undefined) data.isPublic = Boolean(body.isPublic);
  const updated = await prisma.report.update({ where: { id }, data: data as never });
  await audit(req, { action: 'REPORT_UPDATED', resourceType: 'REPORT', resourceId: String(id), detail: 'staff-admin-edit' });
  return ok(res, { report: { id: updated.id, reference: updated.reference, status: updated.status } }, 'Report updated');
}

export async function deleteReportTask3(req: Request, res: Response) {
  const id = Number(req.params.id);
  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) return notFound(res, 'Report not found');
  if (!['SYSTEM_ADMIN', 'NATIONAL_ADMIN'].includes(req.user!.role)) {
    return fail(res, 'Only national or system administrators can hide reports', 403);
  }
  try {
    await prisma.report.update({ where: { id }, data: { deletedAt: new Date() } as never });
    await audit(req, { action: 'REPORT_SOFT_DELETED', resourceType: 'REPORT', resourceId: String(id) });
    return ok(res, null, 'Report hidden (soft deleted). History retained for auditing.');
  } catch (e) {
    if ((e as { code?: string })?.code === 'P2022') {
      return res.status(501).json({ success: false, message: 'Soft delete needs the deletedAt migration. Nothing was deleted.', code: 'SOFT_DELETE_PENDING' });
    }
    throw e;
  }
}

export async function setDeadlineTask3(req: Request, res: Response) {
  const id = Number(req.params.id);
  const { deadline } = req.body ?? {};
  if (!deadline) return fail(res, 'Deadline is required', 422);
  const when = new Date(deadline);
  if (Number.isNaN(when.getTime())) return fail(res, 'Invalid deadline', 422);
  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) return notFound(res, 'Report not found');
  try {
    const updated = await prisma.report.update({ where: { id }, data: { deadline: when } as never });
    await audit(req, { action: 'REPORT_DEADLINE_CHANGED', resourceType: 'REPORT', resourceId: String(id), detail: when.toISOString() });
    return ok(res, { report: { id: updated.id, reference: updated.reference, status: updated.status } }, 'Deadline set');
  } catch (e2) {
    if ((e2 as { code?: string })?.code === 'P2022') {
      return res.status(501).json({ success: false, message: 'Deadline needs migration.', code: 'DEADLINE_COLUMN_PENDING' });
    }
    throw e2;
  }
}

export async function changeStatusTask3(req: Request, res: Response) {
  const { canTransition } = await import('../services/report-status.service');
  const id = Number(req.params.id);
  const { status: toStatus, reason } = req.body ?? {};
  if (!toStatus) return fail(res, 'Status is required', 422);
  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) return notFound(res, 'Report not found');
  if (!canTransition(report.status, String(toStatus), req.user!.role)) {
    return res.status(409).json({ success: false, message: `Invalid transition ${report.status} to ${toStatus}`, code: 'INVALID_STATUS_TRANSITION' });
  }
  const actorName = `${req.user!.firstName} ${req.user!.lastName}`;
  const [updated] = await prisma.$transaction([
    prisma.report.update({ where: { id }, data: { status: String(toStatus) } }),
    prisma.reportStatusHistory.create({
      data: { reportId: id, fromStatus: report.status, toStatus: String(toStatus), note: reason ? String(reason).slice(0, 500) : `Status changed by ${actorName}`, actorId: req.user!.sub, actorName },
    }),
    prisma.notification.create({
      data: { userId: report.citizenId, type: 'REPORT_UPDATED', title: 'Status updated', message: `Report ${report.reference} moved to ${String(toStatus)}.`, reportId: id },
    }),
  ]);
  await audit(req, { action: 'REPORT_STATUS_CHANGED', resourceType: 'REPORT', resourceId: String(id), detail: `${report.status} -> ${toStatus}` });
  return ok(res, { report: { id: updated.id, reference: updated.reference, status: updated.status } }, 'Status updated');
}

export async function resolveReportTask3(req: Request, res: Response) {
  const { canTransition } = await import('../services/report-status.service');
  const id = Number(req.params.id);
  const { resolution } = req.body ?? {};
  if (!resolution || !String(resolution).trim()) return fail(res, 'Resolution required', 422);
  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) return notFound(res, 'Report not found');
  if (!canTransition(report.status, 'RESOLVED', req.user!.role)) {
    return res.status(409).json({ success: false, message: 'Cannot resolve', code: 'INVALID_STATUS_TRANSITION' });
  }
  const actorName = `${req.user!.firstName} ${req.user!.lastName}`;
  const [updated] = await prisma.$transaction([
    prisma.report.update({ where: { id }, data: { status: 'RESOLVED', resolvedAt: new Date() } }),
    prisma.reportStatusHistory.create({
      data: { reportId: id, fromStatus: report.status, toStatus: 'RESOLVED', note: String(resolution).slice(0, 400), actorId: req.user!.sub, actorName },
    }),
    prisma.notification.create({
      data: { userId: report.citizenId, type: 'REPORT_RESOLVED', title: 'Resolved', message: `Report ${report.reference} resolved.`, reportId: id },
    }),
  ]);
  await audit(req, { action: 'REPORT_RESOLVED', resourceType: 'REPORT', resourceId: String(id) });
  return ok(res, { report: { id: updated.id, reference: updated.reference, status: updated.status } }, 'Resolved');
}

export async function closeReportTask3(req: Request, res: Response) {
  const { canTransition } = await import('../services/report-status.service');
  const id = Number(req.params.id);
  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) return notFound(res, 'Report not found');
  if (!canTransition(report.status, 'CLOSED', req.user!.role)) {
    return res.status(409).json({ success: false, message: 'Only resolved can close', code: 'INVALID_STATUS_TRANSITION' });
  }
  const [updated] = await prisma.$transaction([
    prisma.report.update({ where: { id }, data: { status: 'CLOSED' } }),
    prisma.reportStatusHistory.create({
      data: { reportId: id, fromStatus: report.status, toStatus: 'CLOSED', note: 'Closed', actorId: req.user!.sub, actorName: 'staff' },
    }),
  ]);
  await audit(req, { action: 'REPORT_CLOSED', resourceType: 'REPORT', resourceId: String(id) });
  return ok(res, { report: { id: updated.id, reference: updated.reference, status: updated.status } }, 'Closed');
}

export async function reopenReportTask3(req: Request, res: Response) {
  const id = Number(req.params.id);
  const { reason } = req.body ?? {};
  if (!reason || !String(reason).trim()) return fail(res, 'Reason required', 422);
  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) return notFound(res, 'Report not found');
  const target = report.status === 'CLOSED' || report.status === 'REOPEN_REQUESTED' ? 'REOPENED' : null;
  if (!target) return res.status(409).json({ success: false, message: 'Cannot reopen', code: 'INVALID_STATUS_TRANSITION' });
  const [updated] = await prisma.$transaction([
    prisma.report.update({ where: { id }, data: { status: target } }),
    prisma.reportStatusHistory.create({
      data: { reportId: id, fromStatus: report.status, toStatus: target, note: String(reason).slice(0, 500), actorId: req.user!.sub, actorName: 'staff' },
    }),
    prisma.notification.create({
      data: { userId: report.citizenId, type: 'REPORT_REOPENED', title: 'Reopened', message: `Report ${report.reference} reopened.`, reportId: id },
    }),
  ]);
  await audit(req, { action: 'REPORT_REOPENED', resourceType: 'REPORT', resourceId: String(id) });
  return ok(res, { report: { id: updated.id, reference: updated.reference, status: updated.status } }, 'Reopened');
}
