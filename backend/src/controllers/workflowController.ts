import type { Request, Response } from 'express';
import { prisma } from '../config/db';
import { ok, fail, notFound } from '../utils/helpers';
import { audit } from '../services/audit.service';
import { notify } from '../services/notification.service';

// Statuses officers may transition to, and from which status (Task 7 / §51)
const TRANSITIONS: Record<string, { from: string[]; citizenNote: string; notifyType: Parameters<typeof notify>[0]['type'] }> = {
  RECEIVED: { from: ['SUBMITTED'], citizenNote: 'Your report has been received by government staff.', notifyType: 'REPORT_RECEIVED' },
  UNDER_REVIEW: { from: ['SUBMITTED', 'RECEIVED'], citizenNote: 'Your report is being reviewed.', notifyType: 'REPORT_UPDATED' },
  VERIFIED: { from: ['UNDER_REVIEW', 'RECEIVED'], citizenNote: 'Your report has been verified and confirmed as a genuine community problem.', notifyType: 'REPORT_VERIFIED' },
  REJECTED: { from: ['UNDER_REVIEW', 'RECEIVED', 'SUBMITTED'], citizenNote: 'Your report was reviewed and could not be actioned. See the note for details.', notifyType: 'REPORT_REJECTED' },
  ASSIGNED: { from: ['VERIFIED'], citizenNote: 'Your report has been assigned to the responsible department.', notifyType: 'REPORT_ASSIGNED' },
  IN_PROGRESS: { from: ['ASSIGNED', 'REOPENED'], citizenNote: 'Work on your reported problem is now in progress.', notifyType: 'REPORT_UPDATED' },
  ESCALATED: { from: ['ASSIGNED', 'IN_PROGRESS'], citizenNote: 'Your report has been escalated for higher-level attention.', notifyType: 'REPORT_ESCALATED' },
  RESOLVED: { from: ['IN_PROGRESS', 'ASSIGNED', 'REOPENED'], citizenNote: 'The reported problem has been resolved. Please confirm and share feedback.', notifyType: 'REPORT_RESOLVED' },
  CLOSED: { from: ['RESOLVED'], citizenNote: 'This report has been closed. Thank you for helping improve your community.', notifyType: 'REPORT_UPDATED' },
  REOPENED: { from: ['REOPEN_REQUESTED'], citizenNote: 'Your reopening request was approved. The report is active again.', notifyType: 'REPORT_REOPENED' },
};

function allowedTargets(current: string): string[] {
  return Object.entries(TRANSITIONS)
    .filter(([, t]) => t.from.includes(current))
    .map(([target]) => target);
}

// GET /api/v1/workflow/reports?status=&districtId=&page=
export async function listReports(req: Request, res: Response) {
  const status = req.query.status as string | undefined;
  const page = Math.max(1, parseInt(req.query.page as string ?? '1', 10));
  const pageSize = 15;

  const where = {
    ...(status && status !== 'ALL' ? { status } : {}),
  };

  const [total, reports] = await Promise.all([
    prisma.report.count({ where }),
    prisma.report.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        category: { select: { name: true, icon: true } },
        district: { select: { name: true } },
        sector: { select: { name: true } },
        citizen: { select: { firstName: true, lastName: true, email: true, phone: true } },
        department: { select: { name: true } },
      },
    }),
  ]);

  return ok(res, {
    reports: reports.map((r) => ({
      id: r.id,
      reference: r.reference,
      title: r.title,
      description: r.description,
      status: r.status,
      urgency: r.urgency,
      categoryName: r.category.name,
      categoryIcon: r.category.icon,
      district: r.district.name,
      sector: r.sector?.name ?? null,
      citizen: r.isAnonymous ? { firstName: 'Anonymous', lastName: 'Citizen', email: null, phone: null } : { firstName: r.citizen.firstName, lastName: r.citizen.lastName, email: r.citizen.email, phone: r.citizen.phone },
      department: r.department?.name ?? null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

// GET /api/v1/workflow/reports/:id
export async function getReport(req: Request, res: Response) {
  const id = Number(req.params.id);
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
      messages: true,
      feedback: true,
    },
  });
  if (!report) return notFound(res, 'Report not found');

  const isAnonymous = report.isAnonymous;
  return ok(res, {
    report: {
      id: report.id,
      reference: report.reference,
      title: report.title,
      description: report.description,
      status: report.status,
      urgency: report.urgency,
      isAnonymous,
      citizen: isAnonymous ? null : { id: report.citizen.id, firstName: report.citizen.firstName, lastName: report.citizen.lastName, email: report.citizen.email, phone: report.citizen.phone },
      categoryName: report.category.name,
      location: {
        province: report.province.name,
        district: report.district.name,
        sector: report.sector?.name ?? null,
        cell: report.cell?.name ?? null,
        latitude: report.latitude,
        longitude: report.longitude,
        description: report.locationDescription,
      },
      department: report.department?.name ?? null,
      evidence: report.evidence.map((e) => ({ id: e.id, fileName: e.fileName, mimeType: e.mimeType, sizeBytes: e.sizeBytes })),
      timeline: report.statusHistory,
      updates: report.updates,
      messages: report.messages,
      feedback: report.feedback,
      aiSuggestion: {
        category: report.aiCategory,
        confidence: report.aiConfidence,
        summary: report.aiSummary,
      },
      allowedTransitions: allowedTargets(report.status),
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    },
  });
}

// POST /api/v1/workflow/reports/:id/transition { toStatus, note, departmentId? }
export async function transition(req: Request, res: Response) {
  const id = Number(req.params.id);
  const { toStatus, note, departmentId } = req.body ?? {};

  if (!toStatus || !TRANSITIONS[toStatus]) {
    return fail(res, 'Invalid target status', 422);
  }

  const report = await prisma.report.findUnique({ where: { id }, include: { department: true } });
  if (!report) return notFound(res, 'Report not found');

  const rule = TRANSITIONS[toStatus];
  if (!rule.from.includes(report.status)) {
    return fail(res, `Cannot move a report from ${report.status} to ${toStatus}`, 409);
  }

  // Geographical authorization placeholder: officers only see their district data (Task 10 §12)
  const extraData: Record<string, unknown> = {};
  if (toStatus === 'ASSIGNED') {
    if (!departmentId) return fail(res, 'A department is required to assign this report', 422);
    const dept = await prisma.department.findFirst({ where: { id: Number(departmentId), isActive: true } });
    if (!dept) return fail(res, 'Selected department is not available', 422);
    extraData.departmentId = dept.id;
  }
  if (toStatus === 'RESOLVED') {
    extraData.resolvedAt = new Date();
  }

  const actorName = `${req.user!.firstName} ${req.user!.lastName}`;

  const updated = await prisma.report.update({
    where: { id },
    data: {
      status: toStatus,
      ...extraData,
    },
  });

  await prisma.reportStatusHistory.create({
    data: {
      reportId: id,
      fromStatus: report.status,
      toStatus,
      note: note ? String(note).slice(0, 500) : rule.citizenNote,
      actorId: req.user!.sub,
      actorName,
    },
  });

  // Public update entry when the officer provides a citizen-facing note (§23)
  if (note && String(note).trim()) {
    await prisma.reportUpdate.create({
      data: {
        reportId: id,
        message: String(note).trim().slice(0, 1000),
        authorName: actorName,
      },
    });
  }

  await audit(req, {
    action: `REPORT_${toStatus}`,
    resourceType: 'REPORT',
    resourceId: String(id),
    detail: `${report.reference}: ${report.status} → ${toStatus}${note ? ` | note: ${String(note).slice(0, 200)}` : ''}`,
  });

  await notify({
    userId: report.citizenId,
    type: rule.notifyType,
    title: `Report ${toStatus.replace('_', ' ').toLowerCase()}`,
    message: `${rule.citizenNote} Report: ${report.reference}`,
    reportId: id,
  });

  return ok(res, { report: { id: updated.id, reference: updated.reference, status: updated.status } }, `Report moved to ${toStatus}`);
}

// POST /api/v1/workflow/reports/:id/updates — post a public progress update
export async function postUpdate(req: Request, res: Response) {
  const id = Number(req.params.id);
  const { message } = req.body ?? {};
  if (!message || !String(message).trim()) return fail(res, 'Update message cannot be empty', 422);

  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) return notFound(res, 'Report not found');

  const actorName = `${req.user!.firstName} ${req.user!.lastName}`;
  await prisma.reportUpdate.create({
    data: { reportId: id, message: String(message).trim().slice(0, 1000), authorName: actorName },
  });
  await notify({ userId: report.citizenId, type: 'REPORT_UPDATED', title: 'New government update', message: `Your report ${report.reference} has a new update.`, reportId: id });
  await audit(req, { action: 'REPORT_UPDATE_POSTED', resourceType: 'REPORT', resourceId: String(id) });

  return ok(res, null, 'Update posted', 201);
}

// POST /api/v1/workflow/reports/:id/messages — reply to citizen
export async function replyMessage(req: Request, res: Response) {
  const id = Number(req.params.id);
  const { message } = req.body ?? {};
  if (!message || !String(message).trim()) return fail(res, 'Message cannot be empty', 422);

  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) return notFound(res, 'Report not found');

  await prisma.reportMessage.create({
    data: { reportId: id, senderId: req.user!.sub, senderRole: 'GOVERNMENT', message: String(message).trim().slice(0, 2000) },
  });
  await notify({ userId: report.citizenId, type: 'GOVERNMENT_MESSAGE', title: 'New government message', message: `Government staff replied to your report ${report.reference}.`, reportId: id });
  await audit(req, { action: 'MESSAGE_SENT', resourceType: 'REPORT', resourceId: String(id), detail: 'sender=GOVERNMENT' });

  return ok(res, null, 'Message sent', 201);
}

// GET /api/v1/workflow/stats — officer dashboard numbers
export async function stats(req: Request, res: Response) {
  const [total, submitted, underReview, assigned, inProgress, resolvedToday, escalated] = await Promise.all([
    prisma.report.count(),
    prisma.report.count({ where: { status: { in: ['SUBMITTED', 'RECEIVED'] } } }),
    prisma.report.count({ where: { status: 'UNDER_REVIEW' } }),
    prisma.report.count({ where: { status: 'ASSIGNED' } }),
    prisma.report.count({ where: { status: 'IN_PROGRESS' } }),
    prisma.report.count({ where: { status: { in: ['RESOLVED', 'CLOSED'] } } }),
    prisma.report.count({ where: { status: 'ESCALATED' } }),
  ]);
  return ok(res, { stats: { total, submitted, underReview, assigned, inProgress, resolved: resolvedToday, escalated } });
}
