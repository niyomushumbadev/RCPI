// ─────────────────────────────────────────────────────────────
// R-CPI resolution workflow (spec §4-§8, §14)
//   Administrator: accept → start → resolve (description + evidence)
//   Citizen: confirm (CLOSED + automatic archiving) or reject (REOPENED)
// Reports are never deleted: confirmed reports are archived in place and
// remain queryable in history (spec §14.9).
// ─────────────────────────────────────────────────────────────
import type { Request, Response } from 'express';
import { prisma } from '../config/db';
import { ok, fail, notFound } from '../utils/helpers';
import { audit } from '../services/audit.service';
import { notify } from '../services/notification.service';
import { canonical, citizenCannotConfirm, canReopen, ASSIGNMENT_PRIORITIES } from '../services/report-lifecycle.service';

const STAFF_ASSIGNERS = ['SECTOR_OFFICER', 'OFFICER', 'DISTRICT_ADMIN', 'PROVINCE_ADMIN', 'CITY_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'];
const STAFF_ACTORS = ['CELL_OFFICER', 'SECTOR_OFFICER', 'OFFICER', 'DISTRICT_ADMIN', 'PROVINCE_ADMIN', 'CITY_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'];

function actorName(req: Request): string {
  return `${req.user!.firstName} ${req.user!.lastName}`;
}

/** Load report + verify the caller is the assigned officer (or a supervisor). */
async function loadReportForStaff(req: Request, res: Response, allowedFrom: string[]) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    notFound(res, 'Report not found');
    return null;
  }
  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) {
    notFound(res, 'Report not found');
    return null;
  }
  const isSupervisor = ['DISTRICT_ADMIN', 'PROVINCE_ADMIN', 'CITY_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'].includes(req.user!.role);
  const isAssignee = report.assignedOfficerId === req.user!.sub;
  if (!isAssignee && !isSupervisor) {
    fail(res, 'This report is not assigned to you', 403);
    return null;
  }
  if (!allowedFrom.includes(canonical(report.status))) {
    fail(res, `This action is not available while the report is ${report.status}`, 409);
    return null;
  }
  return report;
}

// ─── POST /api/v1/reports/:id/accept-assignment (spec §5) ───
export async function acceptAssignment(req: Request, res: Response) {
  const report = await loadReportForStaff(req, res, ['ASSIGNED']);
  if (!report) return;

  const assignment = await prisma.reportAssignment.findFirst({
    where: { reportId: report.id, officerId: req.user!.sub, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  });
  if (!assignment) return fail(res, 'No pending assignment for you on this report', 409);

  await prisma.reportAssignment.update({ where: { id: assignment.id }, data: { status: 'ACCEPTED', acceptedAt: new Date() } });
  await prisma.reportStatusHistory.create({
    data: {
      reportId: report.id,
      fromStatus: report.status,
      toStatus: report.status,
      note: `Assignment accepted by ${actorName(req)}.`,
      actorId: req.user!.sub,
      actorName: actorName(req),
    },
  });
  await notify({
    userId: report.citizenId,
    type: 'REPORT_UPDATED',
    title: 'Assignment accepted',
    message: `Your report ${report.reference} has been accepted by the responsible officer and is queued for action.`,
    reportId: report.id,
  });
  await audit(req, { action: 'ASSIGNMENT_ACCEPTED', resourceType: 'REPORT', resourceId: String(report.id), detail: `assignmentId=${assignment.id}` });
  return ok(res, { assignment: { id: assignment.id, status: 'ACCEPTED', acceptedAt: new Date() } }, 'Assignment accepted');
}

// ─── POST /api/v1/reports/:id/start (spec §5, §8: ASSIGNED → IN_PROGRESS) ───
export async function startWork(req: Request, res: Response) {
  const report = await loadReportForStaff(req, res, ['ASSIGNED', 'REOPENED', 'ESCALATED']);
  if (!report) return;

  const updated = await prisma.report.update({ where: { id: report.id }, data: { status: 'IN_PROGRESS' } });
  await prisma.reportStatusHistory.create({
    data: {
      reportId: report.id,
      fromStatus: report.status,
      toStatus: 'IN_PROGRESS',
      note: `Work started by ${actorName(req)}.`,
      actorId: req.user!.sub,
      actorName: actorName(req),
    },
  });
  await notify({
    userId: report.citizenId,
    type: 'REPORT_UPDATED',
    title: 'Work started',
    message: `Work on your report ${report.reference} is now in progress.`,
    reportId: report.id,
  });
  await audit(req, { action: 'REPORT_WORK_STARTED', resourceType: 'REPORT', resourceId: String(report.id), detail: `${report.status} → IN_PROGRESS` });
  return ok(res, { report: { id: updated.id, reference: updated.reference, status: updated.status } }, 'Work started');
}

// ─── POST /api/v1/reports/:id/resolve (spec §5, §8: → RESOLVED) ───
export async function resolveReport(req: Request, res: Response) {
  const report = await loadReportForStaff(req, res, ['IN_PROGRESS', 'ASSIGNED', 'ESCALATED', 'REOPENED']);
  if (!report) return;

  const { resolutionDescription } = req.body ?? {};
  if (!resolutionDescription || !String(resolutionDescription).trim()) {
    return fail(res, 'A resolution description is required', 422);
  }

  const now = new Date();
  const updated = await prisma.report.update({
    where: { id: report.id },
    data: {
      status: 'RESOLVED', // canonical "resolution awaiting citizen confirmation"
      resolvedAt: now,
      resolutionDescription: String(resolutionDescription).trim().slice(0, 4000),
    },
  });

  // Close out the active assignment record.
  const activeAssignment = await prisma.reportAssignment.findFirst({
    where: { reportId: report.id, officerId: req.user!.sub, status: { in: ['PENDING', 'ACCEPTED'] } },
    orderBy: { createdAt: 'desc' },
  });
  if (activeAssignment) {
    await prisma.reportAssignment.update({ where: { id: activeAssignment.id }, data: { status: 'COMPLETED', completedAt: now } });
  }

  await prisma.reportStatusHistory.create({
    data: {
      reportId: report.id,
      fromStatus: report.status,
      toStatus: 'RESOLVED',
      note: `Resolved by ${actorName(req)}. Awaiting citizen confirmation.`,
      actorId: req.user!.sub,
      actorName: actorName(req),
    },
  });
  await prisma.reportUpdate.create({
    data: {
      reportId: report.id,
      message: `Resolution: ${String(resolutionDescription).trim().slice(0, 900)}`,
      authorName: actorName(req),
      isPublic: true,
    },
  });
  await notify({
    userId: report.citizenId,
    type: 'REPORT_RESOLVED',
    title: 'Your report has been resolved',
    message: `Your reported problem ${report.reference} has been resolved. Please review and confirm whether the problem has been solved.`,
    reportId: report.id,
  });
  await audit(req, { action: 'REPORT_RESOLVED', resourceType: 'REPORT', resourceId: String(report.id), detail: `${report.reference}: awaiting citizen confirmation` });
  return ok(res, { report: { id: updated.id, reference: updated.reference, status: updated.status, resolvedAt: updated.resolvedAt } }, 'Report resolved — awaiting citizen confirmation');
}

// ─── POST /api/v1/reports/:id/confirm (citizen, spec §7 option A + §14) ───
export async function confirmResolution(req: Request, res: Response) {
  const id = Number(req.params.id);
  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) return notFound(res, 'Report not found');
  if (report.citizenId !== req.user!.sub) return fail(res, 'You can only confirm your own reports', 403);
  if (citizenCannotConfirm(report.status)) {
    return fail(res, `Only resolved reports can be confirmed (current status: ${report.status})`, 409);
  }
  if (report.confirmedAt) return fail(res, 'You have already confirmed this resolution', 409);

  const { rating, comment } = req.body ?? {};
  let ratingNum: number | null = null;
  if (rating !== undefined && rating !== null && rating !== '') {
    ratingNum = Number(rating);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return fail(res, 'Satisfaction rating must be between 1 and 5 stars', 422);
    }
  }

  const now = new Date();
  await prisma.$transaction([
    // Automatic closure + archiving (spec §14): CLOSED + is_archived + archived_at.
    prisma.report.update({
      where: { id },
      data: {
        status: 'CLOSED',
        closedAt: now,
        confirmedAt: now,
        confirmedById: req.user!.sub,
        confirmedByName: actorName(req),
        isArchived: true,
        archivedAt: now,
        resolutionConfirmedAt: now,
      },
    }),
    prisma.reportConfirmation.create({
      data: {
        reportId: id,
        citizenId: req.user!.sub,
        confirmationType: 'CONFIRMED',
        feedback: comment ? String(comment).slice(0, 1000) : null,
        satisfactionRating: ratingNum,
      },
    }),
  ]);

  // Keep the classic feedback record in sync so existing dashboards show it.
  if (ratingNum && !(await prisma.feedback.findUnique({ where: { reportId: id } }))) {
    await prisma.feedback.create({
      data: { reportId: id, rating: ratingNum, comment: comment ? String(comment).slice(0, 1000) : null },
    });
  }

  await prisma.reportStatusHistory.create({
    data: {
      reportId: id,
      fromStatus: report.status,
      toStatus: 'CLOSED',
      note: `Citizen confirmed the resolution.${ratingNum ? ` Satisfaction: ${ratingNum}/5.` : ''}${comment ? ` Feedback: ${String(comment).slice(0, 200)}` : ''}`,
      actorId: req.user!.sub,
      actorName: actorName(req),
    },
  });

  // Notify the assigned administrator and the reviewing staff (spec §7, §13).
  if (report.assignedOfficerId) {
    await notify({
      userId: report.assignedOfficerId,
      type: 'REPORT_CLOSED',
      title: 'Citizen confirmed resolution',
      message: `The citizen confirmed ${report.reference} is solved${ratingNum ? ` (${ratingNum}/5)` : ''}. The report is closed and archived.`,
      reportId: id,
    });
  }
  try {
    const officers = await prisma.user.findMany({
      where: { isActive: true, districtId: report.districtId, role: { name: { in: ['SECTOR_OFFICER', 'OFFICER', 'DISTRICT_ADMIN'] } } },
      select: { id: true },
      take: 5,
    });
    for (const officer of officers) {
      await notify({
        userId: officer.id,
        type: 'REPORT_CLOSED',
        title: 'Report closed by citizen',
        message: `${report.reference} was confirmed solved by the citizen and archived.`,
        reportId: id,
      });
    }
  } catch {
    // best-effort
  }

  await audit(req, { action: 'RESOLUTION_CONFIRMED', resourceType: 'REPORT', resourceId: String(id), detail: `${report.reference} CLOSED + archived${ratingNum ? ` rating=${ratingNum}` : ''}` });
  return ok(res, { confirmedAt: now.toISOString(), status: 'CLOSED', archived: true }, 'Thank you for confirming. The report is now closed and archived.');
}

// ─── POST /api/v1/reports/:id/reject-resolution (citizen, spec §7 option B) ───
export async function rejectResolution(req: Request, res: Response) {
  const id = Number(req.params.id);
  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) return notFound(res, 'Report not found');
  if (report.citizenId !== req.user!.sub) return fail(res, 'You can only review your own reports', 403);
  if (canonical(report.status) !== 'RESOLVED') {
    return fail(res, `Only reports awaiting confirmation can be rejected (current status: ${report.status})`, 409);
  }

  const { reason } = req.body ?? {};
  if (!reason || !String(reason).trim()) return fail(res, 'Please explain why the problem is not solved', 422);

  await prisma.reportConfirmation.create({
    data: {
      reportId: id,
      citizenId: req.user!.sub,
      confirmationType: 'REJECTED',
      feedback: String(reason).trim().slice(0, 1000),
    },
  });
  await prisma.report.update({ where: { id }, data: { status: 'REOPENED' } });
  await prisma.reportStatusHistory.create({
    data: {
      reportId: id,
      fromStatus: report.status,
      toStatus: 'REOPENED',
      note: `Citizen rejected the resolution: ${String(reason).trim().slice(0, 300)}`,
      actorId: req.user!.sub,
      actorName: actorName(req),
    },
  });

  // Officer + reviewing staff are notified and the report returns to the queue (spec §7, §13).
  if (report.assignedOfficerId) {
    await notify({
      userId: report.assignedOfficerId,
      type: 'REPORT_REOPENED',
      title: 'Resolution rejected — report reopened',
      message: `The citizen reports ${report.reference} is not solved: ${String(reason).trim().slice(0, 150)}`,
      reportId: id,
    });
  }
  try {
    const officers = await prisma.user.findMany({
      where: { isActive: true, districtId: report.districtId, role: { name: { in: ['SECTOR_OFFICER', 'OFFICER', 'DISTRICT_ADMIN'] } } },
      select: { id: true },
      take: 5,
    });
    for (const officer of officers) {
      await notify({
        userId: officer.id,
        type: 'REPORT_REOPENED',
        title: 'Resolution rejected by citizen',
        message: `${report.reference} was reopened: ${String(reason).trim().slice(0, 120)}`,
        reportId: id,
      });
    }
  } catch {
    // best-effort
  }

  await audit(req, { action: 'RESOLUTION_REJECTED', resourceType: 'REPORT', resourceId: String(id), detail: `${report.reference} REOPENED` });
  return ok(res, { status: 'REOPENED' }, 'Thank you. The report has been reopened for further action.');
}

// ─── GET /api/v1/reports/:id/assignment-history (spec §12 officer page) ───
export async function assignmentHistory(req: Request, res: Response) {
  const id = Number(req.params.id);
  const report = await prisma.report.findUnique({ where: { id }, select: { id: true, citizenId: true } });
  if (!report) return notFound(res, 'Report not found');
  if (req.user!.role === 'CITIZEN' && report.citizenId !== req.user!.sub) {
    return fail(res, 'You do not have permission to view assignment history', 403);
  }
  const assignments = await prisma.reportAssignment.findMany({
    where: { reportId: id },
    orderBy: { createdAt: 'desc' },
  });
  const userIds = [...new Set(assignments.map((a) => a.officerId).filter((v): v is number => v != null))];
  const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true, lastName: true } }) : [];
  const nameOf = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
  return ok(res, {
    assignments: assignments.map((a) => ({
      id: a.id,
      assignedTo: a.officerId ? { id: a.officerId, name: nameOf.get(a.officerId) ?? 'Unknown' } : null,
      departmentId: a.departmentId,
      instruction: a.note,
      priority: a.priority,
      deadline: a.deadline,
      status: a.status,
      assignedBy: a.assignedByName,
      assignedAt: a.createdAt,
      acceptedAt: a.acceptedAt,
      completedAt: a.completedAt,
    })),
  });
}

// Re-export for route wiring convenience.
export { ASSIGNMENT_PRIORITIES, STAFF_ASSIGNERS, STAFF_ACTORS, canReopen };
