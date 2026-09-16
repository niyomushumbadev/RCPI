import type { Request, Response } from 'express';
import { prisma } from '../config/db';
import { ok, fail, notFound } from '../utils/helpers';
import { audit } from '../services/audit.service';
import { notify } from '../services/notification.service';
import { allowedTargetsForRole } from '../services/report-status.service';

// Statuses officers may transition to, and from which status (master spec §6).
// Canonical 16 states + legacy aliases accepted for old rows.
const TRANSITIONS: Record<string, { from: string[]; citizenNote: string; notifyType: Parameters<typeof notify>[0]['type'] }> = {
  PENDING_VERIFICATION: { from: ['SUBMITTED', 'AI_ANALYSIS', 'RECEIVED', 'WAITING_CITIZEN', 'REOPENED'], citizenNote: 'Your report is pending verification.', notifyType: 'REPORT_UPDATED' },
  RECEIVED: { from: ['SUBMITTED'], citizenNote: 'Your report has been received by government staff.', notifyType: 'REPORT_RECEIVED' },
  UNDER_REVIEW: { from: ['SUBMITTED', 'RECEIVED', 'AI_ANALYSIS'], citizenNote: 'Your report is being reviewed.', notifyType: 'REPORT_UPDATED' },
  VERIFIED: { from: ['PENDING_VERIFICATION', 'UNDER_REVIEW', 'RECEIVED', 'WAITING_CITIZEN'], citizenNote: 'Your report has been verified and confirmed as a genuine community problem.', notifyType: 'REPORT_VERIFIED' },
  REJECTED: { from: ['PENDING_VERIFICATION', 'UNDER_REVIEW', 'RECEIVED', 'SUBMITTED', 'AI_ANALYSIS'], citizenNote: 'Your report was reviewed and could not be actioned. See the note for details.', notifyType: 'REPORT_REJECTED' },
  ASSIGNED: { from: ['VERIFIED', 'REOPENED'], citizenNote: 'Your report has been assigned to the responsible department.', notifyType: 'REPORT_ASSIGNED' },
  IN_PROGRESS: { from: ['ASSIGNED', 'REOPENED', 'ESCALATED', 'WAITING_CITIZEN', 'WAITING_DEPARTMENT'], citizenNote: 'Work on your reported problem is now in progress.', notifyType: 'REPORT_UPDATED' },
  WAITING_CITIZEN: { from: ['PENDING_VERIFICATION', 'IN_PROGRESS', 'ASSIGNED'], citizenNote: 'Government staff need more information from you.', notifyType: 'INFO_REQUESTED' },
  WAITING_DEPARTMENT: { from: ['VERIFIED', 'ASSIGNED', 'IN_PROGRESS'], citizenNote: 'Your report is waiting for the responsible department.', notifyType: 'REPORT_UPDATED' },
  ESCALATED: { from: ['ASSIGNED', 'IN_PROGRESS', 'VERIFIED', 'WAITING_DEPARTMENT', 'WAITING_CITIZEN'], citizenNote: 'Your report has been escalated for higher-level attention.', notifyType: 'REPORT_ESCALATED' },
  RESOLVED: { from: ['IN_PROGRESS', 'ASSIGNED', 'REOPENED', 'ESCALATED', 'WAITING_DEPARTMENT'], citizenNote: 'The reported problem has been resolved. Please confirm and share feedback.', notifyType: 'REPORT_RESOLVED' },
  PENDING_CLOSURE: { from: ['RESOLVED'], citizenNote: 'Resolution is pending supervisor approval.', notifyType: 'REPORT_UPDATED' },
  CLOSED: { from: ['RESOLVED', 'PENDING_CLOSURE'], citizenNote: 'This report has been closed. Thank you for helping improve your community.', notifyType: 'REPORT_CLOSED' },
  REOPENED: { from: ['CLOSED', 'REOPEN_REQUESTED', 'RESOLVED', 'PENDING_CLOSURE'], citizenNote: 'Your reopening request was approved. The report is active again.', notifyType: 'REPORT_REOPENED' },
  ARCHIVED: { from: ['CLOSED', 'REJECTED', 'DRAFT'], citizenNote: 'This report has been archived.', notifyType: 'REPORT_UPDATED' },
};

function allowedTargets(current: string): string[] {
  return Object.entries(TRANSITIONS)
    .filter(([, t]) => t.from.includes(current))
    .map(([target]) => target);
}

// Government roles that may act on reports (staff; EXECUTIVE/ANALYST/CITIZEN are read-only).
const STAFF_ROLES = ['CELL_OFFICER', 'SECTOR_OFFICER', 'OFFICER', 'DISTRICT_ADMIN', 'PROVINCE_ADMIN', 'CITY_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'];
// Which staff roles may perform sensitive transitions (master spec §46).
const TRANSITION_ROLE_MATRIX: Record<string, string[]> = {
  VERIFIED: ['CELL_OFFICER', 'SECTOR_OFFICER', 'OFFICER', 'DISTRICT_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'],
  REJECTED: ['CELL_OFFICER', 'SECTOR_OFFICER', 'OFFICER', 'DISTRICT_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'],
  ASSIGNED: ['SECTOR_OFFICER', 'OFFICER', 'DISTRICT_ADMIN', 'PROVINCE_ADMIN', 'CITY_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'],
  RESOLVED: ['CELL_OFFICER', 'SECTOR_OFFICER', 'OFFICER', 'DISTRICT_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'],
  PENDING_CLOSURE: ['SECTOR_OFFICER', 'OFFICER', 'DISTRICT_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'],
  CLOSED: ['DISTRICT_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'], // supervisor approval (§22)
  REOPENED: ['SECTOR_OFFICER', 'OFFICER', 'DISTRICT_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'],
  ARCHIVED: ['DISTRICT_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'],
};

// GET /api/v1/workflow/reports?status=&districtId=&page=
export async function listReports(req: Request, res: Response) {
  const status = req.query.status as string | undefined;
  const page = Math.max(1, parseInt(req.query.page as string ?? '1', 10));
  const pageSize = 15;
  const districtFilter = req.query.districtId ? Number(req.query.districtId) : undefined;

  const scope: Record<string, unknown> = {};
  if (['CELL_OFFICER', 'SECTOR_OFFICER', 'OFFICER', 'DISTRICT_ADMIN'].includes(req.user?.role ?? '')) {
    const me = await prisma.user.findUnique({ where: { id: req.user!.sub }, select: { districtId: true } });
    if (me?.districtId) scope.districtId = me.districtId;
    else scope.assignedOfficerId = req.user!.sub;
  }
  if (districtFilter && scope.districtId && scope.districtId !== districtFilter) {
    return fail(res, 'You can only view reports within your assigned district', 403);
  }

  const where = {
    ...scope,
    ...(districtFilter && !scope.districtId ? { districtId: districtFilter } : {}),
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
      deadline: report.deadline,
      deadlineReason: report.deadlineReason,
      internalNotes: await prisma.reportInternalNote.findMany({ where: { reportId: id }, orderBy: { createdAt: 'desc' } }),
      relatedReports: await prisma.reportRelated.findMany({ where: { reportId: id }, orderBy: { createdAt: 'desc' } }),
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
  // Role-matrix enforcement (§46): not every staff role may perform every transition.
  const roleGate = TRANSITION_ROLE_MATRIX[toStatus];
  if (roleGate && !roleGate.includes(req.user?.role ?? '')) {
    return fail(res, `Your role (${req.user?.role}) cannot move reports to ${toStatus}`, 403);
  }

  // Geographic authorization: cell/sector/district officers stay in own district.
  if (['CELL_OFFICER', 'SECTOR_OFFICER', 'OFFICER', 'DISTRICT_ADMIN'].includes(req.user?.role ?? '')) {
    const me = await prisma.user.findUnique({ where: { id: req.user!.sub }, select: { districtId: true } });
    if (me?.districtId && report.districtId !== me.districtId) {
      return fail(res, 'You can only act on reports within your assigned district', 403);
    }
  }
  // Executive dashboard is read-only aggregated strategy (no mutations).
  if (req.user?.role === 'EXECUTIVE' || req.user?.role === 'ANALYST' || req.user?.role === 'CITIZEN') {
    return fail(res, 'Your role cannot change report status', 403);
  }
  const extraData: Record<string, unknown> = {};
  const actorName = `${req.user!.firstName} ${req.user!.lastName}`;
  if (toStatus === 'ASSIGNED') {
    if (!departmentId) return fail(res, 'A department is required to assign this report', 422);
    const dept = await prisma.department.findFirst({ where: { id: Number(departmentId), isActive: true } });
    if (!dept) return fail(res, 'Selected department is not available', 422);
    extraData.departmentId = dept.id;
  }
  if (toStatus === 'ESCALATED') {
    extraData.escalatedAt = new Date();
    extraData.escalationNote = note ? String(note).slice(0, 500) : null;
    try {
      await prisma.reportEscalation.create({
        data: {
          reportId: id,
          fromLevel: req.user?.role ?? null,
          toLevel: 'HIGHER_AUTHORITY',
          reason: note ? String(note).slice(0, 500) : 'Escalated for higher-level attention',
          actorId: req.user!.sub,
          actorName,
        },
      });
    } catch {
      // companion table is additive; never block the core transition
    }
  }
  if (toStatus === 'ASSIGNED') {
    try {
      await prisma.reportAssignment.create({
        data: { reportId: id, departmentId: extraData.departmentId as number | undefined ?? null, assignedBy: req.user!.sub, assignedByName: actorName, note: note ? String(note).slice(0, 500) : null },
      });
    } catch {
      // ignore
    }
  }
  if (toStatus === 'CLOSED') {
    extraData.closedAt = new Date();
  }

  const updated = await prisma.report.update({
    where: { id },
    data: {
      status: toStatus,
      ...(toStatus === 'RESOLVED' ? { resolvedAt: new Date() } : {}),
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

// POST /api/v1/workflow/reports/:id/deadline — set/extend deadline + reason.
export async function setDeadline(req: Request, res: Response) {
  const id = Number(req.params.id);
  const { deadline, reason } = req.body ?? {};
  if (!deadline) return fail(res, 'A deadline date is required', 422);
  const parsed = new Date(String(deadline));
  if (Number.isNaN(parsed.getTime())) return fail(res, 'Invalid deadline date', 422);
  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) return notFound(res, 'Report not found');
  const actorName = `${req.user!.firstName} ${req.user!.lastName}`;
  await prisma.report.update({ where: { id }, data: { deadline: parsed, deadlineReason: reason ? String(reason).slice(0, 500) : null } });
  try {
    await prisma.reportDeadline.create({ data: { reportId: id, deadline: parsed, reason: reason ? String(reason).slice(0, 500) : null, actorId: req.user!.sub, actorName } });
  } catch {
    // ignore
  }
  await prisma.reportStatusHistory.create({ data: { reportId: id, fromStatus: report.status, toStatus: report.status, note: `Deadline set to ${parsed.toISOString()}${reason ? `: ${String(reason).slice(0, 200)}` : ''}`, actorId: req.user!.sub, actorName } });
  await audit(req, { action: 'REPORT_DEADLINE_SET', resourceType: 'REPORT', resourceId: String(id), detail: parsed.toISOString() });
  return ok(res, { deadline: parsed }, 'Deadline saved');
}

// POST /api/v1/workflow/reports/:id/internal-note — staff-only note.
export async function addInternalNote(req: Request, res: Response) {
  const id = Number(req.params.id);
  const { note } = req.body ?? {};
  if (!note || !String(note).trim()) return fail(res, 'Note cannot be empty', 422);
  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) return notFound(res, 'Report not found');
  const actorName = `${req.user!.firstName} ${req.user!.lastName}`;
  try {
    await prisma.reportInternalNote.create({ data: { reportId: id, note: String(note).slice(0, 2000), actorId: req.user!.sub, actorName } });
  } catch {
    // ignore
  }
  await audit(req, { action: 'INTERNAL_NOTE_ADDED', resourceType: 'REPORT', resourceId: String(id) });
  return ok(res, null, 'Internal note saved', 201);
}

// POST /api/v1/workflow/reports/:id/related — link related / mark duplicate.
export async function linkRelated(req: Request, res: Response) {
  const id = Number(req.params.id);
  const { relatedReportId, relationType, note } = req.body ?? {};
  if (!relatedReportId) return fail(res, 'A related report id is required', 422);
  if (Number(relatedReportId) === id) return fail(res, 'A report cannot be linked to itself', 422);
  const [report, related] = await Promise.all([
    prisma.report.findUnique({ where: { id } }),
    prisma.report.findUnique({ where: { id: Number(relatedReportId) } }),
  ]);
  if (!report || !related) return notFound(res, 'Report not found');
  const type = String(relationType ?? 'RELATED').toUpperCase() === 'DUPLICATE' ? 'DUPLICATE' : 'RELATED';
  try {
    await prisma.reportRelated.create({ data: { reportId: id, relatedReportId: Number(relatedReportId), relationType: type, note: note ? String(note).slice(0, 500) : null, actorId: req.user!.sub } });
  } catch {
    // ignore
  }
  if (type === 'DUPLICATE') {
    await prisma.report.update({ where: { id }, data: { duplicateOfId: Number(relatedReportId) } });
  }
  await prisma.reportStatusHistory.create({ data: { reportId: id, fromStatus: report.status, toStatus: report.status, note: `${type === 'DUPLICATE' ? 'Marked as possible duplicate of' : 'Linked to'} ${related.reference}${note ? `: ${String(note).slice(0, 200)}` : ''}`, actorId: req.user!.sub, actorName: `${req.user!.firstName} ${req.user!.lastName}` } });
  await audit(req, { action: type === 'DUPLICATE' ? 'REPORT_MARKED_DUPLICATE' : 'REPORT_LINKED', resourceType: 'REPORT', resourceId: String(id), detail: related.reference });
  return ok(res, null, type === 'DUPLICATE' ? 'Marked as possible duplicate (advisory only — original stays open)' : 'Related report linked', 201);
}

// GET /api/v1/workflow/reopen-requests — reports citizens asked to reopen
export async function listReopenRequests(req: Request, res: Response) {
  const requests = await prisma.reportReopenRequest.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { report: { select: { id: true, reference: true, title: true, status: true, districtId: true } } },
  });
  // District-scoped officers only see their own district's requests.
  if (['CELL_OFFICER', 'SECTOR_OFFICER', 'OFFICER', 'DISTRICT_ADMIN'].includes(req.user?.role ?? '')) {
    const me = await prisma.user.findUnique({ where: { id: req.user!.sub }, select: { districtId: true } });
    const filtered = me?.districtId ? requests.filter((r) => r.report?.districtId === me.districtId) : [];
    return ok(res, { requests: filtered });
  }
  return ok(res, { requests });
}

// POST /api/v1/workflow/reopen-requests/:id/review { decision: 'APPROVE' | 'DECLINE', note? }
export async function reviewReopenRequest(req: Request, res: Response) {
  const id = Number(req.params.id);
  const { decision, note } = req.body ?? {};
  const action = String(decision ?? '').toUpperCase();
  if (action !== 'APPROVE' && action !== 'DECLINE') {
    return fail(res, "decision must be 'APPROVE' or 'DECLINE'", 422);
  }

  const request = await prisma.reportReopenRequest.findUnique({
    where: { id },
    include: { report: { select: { id: true, reference: true, title: true, status: true, citizenId: true, districtId: true } } },
  });
  if (!request || !request.report) return notFound(res, 'Reopen request not found');
  if (request.status !== 'PENDING') return fail(res, `This reopen request was already ${request.status.toLowerCase()}`, 409);

  // Geographic authorization mirrors the transition rules.
  if (['CELL_OFFICER', 'SECTOR_OFFICER', 'OFFICER', 'DISTRICT_ADMIN'].includes(req.user?.role ?? '')) {
    const me = await prisma.user.findUnique({ where: { id: req.user!.sub }, select: { districtId: true } });
    if (me?.districtId && request.report.districtId !== me.districtId) {
      return fail(res, 'You can only review reopen requests within your assigned district', 403);
    }
  }
  // Only roles allowed to REOPEN a report may approve; any staff role may decline.
  const canApprove = (TRANSITION_ROLE_MATRIX.REOPENED ?? []).includes(req.user?.role ?? '');
  if (action === 'APPROVE' && !canApprove) {
    return fail(res, `Your role (${req.user?.role}) cannot approve reopen requests`, 403);
  }

  const actorName = `${req.user!.firstName} ${req.user!.lastName}`;
  const reviewNote = note ? String(note).slice(0, 500) : null;
  const newStatus = action === 'APPROVE' ? 'APPROVED' : 'DECLINED';

  await prisma.reportReopenRequest.update({
    where: { id },
    data: { status: newStatus },
  });

  if (action === 'APPROVE') {
    const report = request.report;
    await prisma.report.update({ where: { id: report.id }, data: { status: 'REOPENED' } });
    await prisma.reportStatusHistory.create({
      data: {
        reportId: report.id,
        fromStatus: report.status,
        toStatus: 'REOPENED',
        note: `Reopen request approved${reviewNote ? `: ${reviewNote}` : ''} — original citizen reason: ${request.reason.slice(0, 200)}`,
        actorId: req.user!.sub,
        actorName,
      },
    });
    await notify({
      userId: report.citizenId,
      type: 'REPORT_REOPENED',
      title: 'Report reopened',
      message: `Your reopening request for ${report.reference} was approved. The report is active again.`,
      reportId: report.id,
    });
  } else {
    // Decline restores the report to its pre-request status (usually CLOSED).
    const priorStatus = ['RESOLVED', 'PENDING_CLOSURE'].includes(request.report.status) ? request.report.status : 'CLOSED';
    await prisma.report.update({ where: { id: request.report.id }, data: { status: priorStatus } });
    await prisma.reportStatusHistory.create({
      data: {
        reportId: request.report.id,
        fromStatus: request.report.status,
        toStatus: priorStatus,
        note: `Reopen request declined${reviewNote ? `: ${reviewNote}` : ''}`,
        actorId: req.user!.sub,
        actorName,
      },
    });
    await notify({
      userId: request.report.citizenId,
      type: 'REPORT_UPDATED',
      title: 'Reopen request declined',
      message: `Your reopening request for ${request.report.reference} was reviewed and declined.${reviewNote ? ` Officer note: ${reviewNote}` : ''}`,
      reportId: request.report.id,
    });
  }

  await audit(req, {
    action: `REOPEN_REQUEST_${newStatus}`,
    resourceType: 'REPORT',
    resourceId: String(request.report.id),
    detail: `${request.report.reference}: reopen request #${id} ${newStatus.toLowerCase()}${reviewNote ? ` | note: ${reviewNote.slice(0, 200)}` : ''}`,
  });

  return ok(res, { requestId: id, decision: newStatus }, action === 'APPROVE' ? 'Report reopened' : 'Reopen request declined');
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
