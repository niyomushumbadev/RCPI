import type { Request, Response } from 'express';
import { prisma } from '../config/db';
import { ok, fail, notFound } from '../utils/helpers';
import { audit } from '../services/audit.service';
import { notify } from '../services/notification.service';
import { canTransition, createStatusHistoryEntry, getNextReferenceNumber } from '../services/report.service';

export async function listReports(req: Request, res: Response) {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const page = Math.max(1, Number(req.query.page ?? '1'));
  const pageSize = 20;

  const where = status && status !== 'ALL' ? { status } : {};

  const [total, reports] = await Promise.all([
    prisma.report.count({ where }),
    prisma.report.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        category: true,
        district: true,
        sector: true,
        citizen: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
  ]);

  return ok(res, {
    reports: reports.map((report) => ({
      id: report.id,
      reference: report.reference,
      title: report.title,
      status: report.status,
      urgency: report.urgency,
      categoryName: report.category.name,
      districtName: report.district.name,
      sectorName: report.sector?.name ?? null,
      citizenName: `${report.citizen.firstName} ${report.citizen.lastName}`,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}

export async function createReport(req: Request, res: Response) {
  const { title, description, categoryId, urgency, provinceId, districtId, sectorId, cellId, latitude, longitude, locationDescription, isAnonymous } = req.body ?? {};

  if (!title || !description || !categoryId || !provinceId || !districtId) {
    return fail(res, 'Title, description, category, province and district are required', 422);
  }

  const category = await prisma.category.findFirst({
    where: { id: Number(categoryId), isActive: true },
  });
  if (!category) return fail(res, 'Selected category is not available', 422);

  const district = await prisma.district.findFirst({
    where: { id: Number(districtId), provinceId: Number(provinceId) },
  });
  if (!district) return fail(res, 'Selected district does not belong to the selected province', 422);

  const reference = await getNextReferenceNumber();

  const report = await prisma.report.create({
    data: {
      reference,
      title: String(title).trim().slice(0, 200),
      description: String(description).trim(),
      status: 'SUBMITTED',
      urgency: ['LOW', 'MEDIUM', 'HIGH'].includes(urgency) ? urgency : 'MEDIUM',
      citizenId: req.user!.sub,
      categoryId: Number(categoryId),
      provinceId: Number(provinceId),
      districtId: Number(districtId),
      sectorId: sectorId ? Number(sectorId) : null,
      cellId: cellId ? Number(cellId) : null,
      latitude: latitude !== undefined && latitude !== null && latitude !== '' ? Number(latitude) : null,
      longitude: longitude !== undefined && longitude !== null && longitude !== '' ? Number(longitude) : null,
      locationDescription: locationDescription ? String(locationDescription).slice(0, 300) : null,
      isAnonymous: Boolean(isAnonymous),
      statusHistory: {
        create: {
          toStatus: 'SUBMITTED',
          note: 'Report submitted and awaiting review.',
          actorName: `${req.user!.firstName} ${req.user!.lastName}`,
        },
      },
    },
    include: { statusHistory: true },
  });

  await audit(req, { action: 'REPORT_CREATED', resourceType: 'REPORT', resourceId: String(report.id), detail: reference });
  await notify({
    userId: req.user!.sub,
    type: 'REPORT_RECEIVED',
    title: 'Report received',
    message: `Your report "${report.title}" has been received and is awaiting review.`,
    reportId: report.id,
  });

  return ok(res, { report: { id: report.id, reference: report.reference, status: report.status, title: report.title, createdAt: report.createdAt } }, 'Report created successfully', 201);
}

export async function getReport(req: Request, res: Response) {
  const id = Number(req.params.id);
  // Guard against non-numeric :id (e.g. an unknown path falling through to
  // this route) — NaN would crash Prisma and take down the whole process.
  if (!Number.isInteger(id) || id <= 0) return notFound(res, 'Report not found');
  const report = await prisma.report.findUnique({
    where: { id },
    include: {
      category: true,
      province: true,
      district: true,
      sector: true,
      cell: true,
      department: true,
      evidence: true,
      citizen: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      statusHistory: { orderBy: { createdAt: 'asc' } },
      updates: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!report) return notFound(res, 'Report not found');

  if (req.user?.role === 'CITIZEN' && report.citizenId !== req.user.sub) {
    return fail(res, 'You do not have permission to view this report', 403);
  }

  return ok(res, {
    report: {
      id: report.id,
      reference: report.reference,
      title: report.title,
      description: report.description,
      status: report.status,
      urgency: report.urgency,
      categoryName: report.category.name,
      categoryIcon: report.category.icon,
      location: {
        province: report.province.name,
        district: report.district.name,
        sector: report.sector?.name ?? null,
        cell: report.cell?.name ?? null,
        latitude: report.latitude ? Number(report.latitude) : null,
        longitude: report.longitude ? Number(report.longitude) : null,
        description: report.locationDescription,
      },
      citizen: report.isAnonymous ? null : {
        id: report.citizen.id,
        firstName: report.citizen.firstName,
        lastName: report.citizen.lastName,
        email: report.citizen.email,
        phone: report.citizen.phone,
      },
      evidence: report.evidence.map((item) => ({
        id: item.id,
        fileName: item.fileName,
        mimeType: item.mimeType,
        sizeBytes: item.sizeBytes,
      })),
      timeline: report.statusHistory.map((entry) => ({
        id: entry.id,
        fromStatus: entry.fromStatus,
        toStatus: entry.toStatus,
        note: entry.note,
        actorName: entry.actorName,
        createdAt: entry.createdAt,
      })),
      updates: report.updates,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    },
  });
}

export async function getReportHistory(req: Request, res: Response) {
  const id = Number(req.params.id);
  const report = await prisma.report.findUnique({
    where: { id },
    select: { id: true, citizenId: true, statusHistory: { orderBy: { createdAt: 'asc' } } },
  });
  if (!report) return notFound(res, 'Report not found');
  if (req.user?.role === 'CITIZEN' && report.citizenId !== req.user.sub) {
    return fail(res, 'You do not have permission to view this report history', 403);
  }
  return ok(res, { history: report.statusHistory });
}

export async function listOverdueReports(req: Request, res: Response) {
  const reports = await prisma.report.findMany({
    where: {
      status: { notIn: ['CLOSED', 'REJECTED'] },
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      category: true,
      district: true,
      citizen: { select: { firstName: true, lastName: true } },
    },
  });

  return ok(res, {
    reports: reports.filter((report) => report.updatedAt.getTime() < Date.now() - 24 * 60 * 60 * 1000).map((report) => ({
      id: report.id,
      reference: report.reference,
      title: report.title,
      status: report.status,
      categoryName: report.category.name,
      districtName: report.district.name,
      citizenName: `${report.citizen.firstName} ${report.citizen.lastName}`,
      updatedAt: report.updatedAt,
    })),
  });
}

export async function transitionStatus(req: Request, res: Response) {
  const id = Number(req.params.id);
  const { toStatus, note } = req.body ?? {};

  if (!toStatus) return fail(res, 'Status is required', 422);

  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) return notFound(res, 'Report not found');

  if (!canTransition(report.status, toStatus)) {
    return fail(res, `Invalid status transition from ${report.status} to ${toStatus}`, 409);
  }

  const before = report.status;
  const updated = await prisma.report.update({
    where: { id },
    data: { status: toStatus },
  });

  await createStatusHistoryEntry(id, before, toStatus, note ? String(note).slice(0, 500) : `Status changed by ${req.user!.firstName} ${req.user!.lastName}`, req.user!.sub, `${req.user!.firstName} ${req.user!.lastName}`);
  await audit(req, { action: 'REPORT_STATUS_CHANGED', resourceType: 'REPORT', resourceId: String(id), detail: `${before} -> ${toStatus}` });

  return ok(res, { report: { id: updated.id, reference: updated.reference, status: updated.status } }, 'Report status updated');
}

export async function verifyReport(req: Request, res: Response) {
  const { comment } = req.body ?? {};
  const id = Number(req.params.id);
  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) return notFound(res, 'Report not found');
  if (!canTransition(report.status, 'VERIFIED')) return fail(res, 'This report cannot be verified in its current state', 409);

  const updated = await prisma.report.update({ where: { id }, data: { status: 'VERIFIED' } });
  await createStatusHistoryEntry(id, report.status, 'VERIFIED', comment ? String(comment).slice(0, 500) : 'Report verified', req.user!.sub, `${req.user!.firstName} ${req.user!.lastName}`);
  await audit(req, { action: 'REPORT_VERIFIED', resourceType: 'REPORT', resourceId: String(id), detail: comment ? String(comment).slice(0, 500) : null });
  await notify({ userId: report.citizenId, type: 'REPORT_VERIFIED', title: 'Report verified', message: `Your report ${report.reference} has been verified.`, reportId: id });

  return ok(res, { report: { id: updated.id, reference: updated.reference, status: updated.status } }, 'Report verified successfully');
}

export async function rejectReport(req: Request, res: Response) {
  const { reason } = req.body ?? {};
  const id = Number(req.params.id);
  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) return notFound(res, 'Report not found');
  if (!reason || !String(reason).trim()) return fail(res, 'A rejection reason is required', 422);
  if (!canTransition(report.status, 'REJECTED')) return fail(res, 'This report cannot be rejected in its current state', 409);

  const updated = await prisma.report.update({ where: { id }, data: { status: 'REJECTED' } });
  await createStatusHistoryEntry(id, report.status, 'REJECTED', String(reason).slice(0, 500), req.user!.sub, `${req.user!.firstName} ${req.user!.lastName}`);
  await audit(req, { action: 'REPORT_REJECTED', resourceType: 'REPORT', resourceId: String(id), detail: String(reason).slice(0, 500) });
  await notify({ userId: report.citizenId, type: 'REPORT_REJECTED', title: 'Report rejected', message: `Your report ${report.reference} was rejected: ${String(reason).slice(0, 200)}`, reportId: id });

  return ok(res, { report: { id: updated.id, reference: updated.reference, status: updated.status } }, 'Report rejected');
}

export async function assignReport(req: Request, res: Response) {
  const { assignedTo, departmentId, reason } = req.body ?? {};
  const id = Number(req.params.id);
  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) return notFound(res, 'Report not found');
  if (!canTransition(report.status, 'ASSIGNED')) return fail(res, 'This report cannot be assigned in its current state', 409);

  const assignee = await prisma.user.findFirst({ where: { id: Number(assignedTo), isActive: true } });
  if (!assignee) return fail(res, 'Assigned officer was not found', 422);

  const updated = await prisma.report.update({
    where: { id },
    data: {
      status: 'ASSIGNED',
      departmentId: departmentId ? Number(departmentId) : null,
      assignedOfficerId: Number(assignedTo),
    },
  });

  await createStatusHistoryEntry(id, report.status, 'ASSIGNED', reason ? String(reason).slice(0, 500) : 'Report assigned to officer', req.user!.sub, `${req.user!.firstName} ${req.user!.lastName}`);
  await audit(req, { action: 'REPORT_ASSIGNED', resourceType: 'REPORT', resourceId: String(id), detail: `assignedTo=${assignedTo}` });

  return ok(res, { report: { id: updated.id, reference: updated.reference, status: updated.status, assignedOfficerId: updated.assignedOfficerId } }, 'Report assigned successfully');
}
