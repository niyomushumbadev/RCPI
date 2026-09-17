import type { Request, Response } from 'express';
import { prisma } from '../config/db';
import { ok, fail, notFound, generateReportReference } from '../utils/helpers';
import { audit } from '../services/audit.service';
import { notify } from '../services/notification.service';
import { enqueueAIAnalysis } from '../services/ai.service';

// ─── Own-report guard: object-level authorization (Task 10 §13) ───
async function getOwnReport(req: Request, res: Response) {
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
      statusHistory: { orderBy: { createdAt: 'asc' } },
      updates: { where: { isPublic: true }, orderBy: { createdAt: 'desc' } },
      feedback: true,
    },
  });
  if (!report) {
    notFound(res, 'Report not found');
    return null;
  }
  if (report.citizenId !== req.user!.sub) {
    fail(res, 'You do not have permission to view this report', 403);
    return null;
  }
  return report;
}

// GET /api/v1/citizen/dashboard
export async function getDashboard(req: Request, res: Response) {
  const citizenId = req.user!.sub;
  const [total, submitted, underReview, inProgress, resolved, rejected, recentRaw, unreadNotifs, awaitingRaw] = await Promise.all([
    prisma.report.count({ where: { citizenId } }),
    prisma.report.count({ where: { citizenId, status: 'SUBMITTED' } }),
    prisma.report.count({ where: { citizenId, status: { in: ['UNDER_REVIEW', 'VERIFIED', 'RECEIVED'] } } }),
    prisma.report.count({ where: { citizenId, status: { in: ['ASSIGNED', 'IN_PROGRESS', 'ESCALATED'] } } }),
    prisma.report.count({ where: { citizenId, status: { in: ['RESOLVED', 'CLOSED'] } } }),
    prisma.report.count({ where: { citizenId, status: 'REJECTED' } }),
    prisma.report.findMany({
      where: { citizenId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { category: true, district: true },
    }),
    prisma.notification.count({ where: { userId: citizenId, isRead: false } }),
    // Resolved reports the citizen has not yet confirmed as actually solved.
    prisma.report.findMany({
      where: { citizenId, status: { in: ['RESOLVED', 'CLOSED'] }, resolutionConfirmedAt: null, isArchived: false },
      orderBy: { resolvedAt: 'desc' },
      take: 5,
      select: { id: true, reference: true, title: true, status: true, resolvedAt: true, department: { select: { name: true } } },
    }),
  ]);

  const recent = recentRaw.map((r) => ({
    id: r.id,
    reference: r.reference,
    title: r.title,
    status: r.status,
    categoryName: r.category.name,
    districtName: r.district.name,
    createdAt: r.createdAt,
  }));

  return ok(res, {
    stats: { total, submitted, underReview, inProgress, resolved, rejected, awaitingConfirmation: awaitingRaw.length },
    awaitingConfirmation: awaitingRaw.map((r) => ({
      id: r.id,
      reference: r.reference,
      title: r.title,
      status: r.status,
      departmentName: r.department?.name ?? null,
      resolvedAt: r.resolvedAt,
    })),
    recentReports: recent,
    unreadNotifications: unreadNotifs,
    citizen: { firstName: req.user!.firstName, lastName: req.user!.lastName },
  });
}

// GET /api/v1/citizen/profile
export async function getProfile(req: Request, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    include: {
      province: true,
      district: true,
      sector: true,
    },
  });
  if (!user) return notFound(res, 'Account not found');
  return ok(res, {
    profile: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      preferredLanguage: user.preferredLanguage,
      province: user.province?.name ?? null,
      district: user.district?.name ?? null,
      sector: user.sector?.name ?? null,
      provinceId: user.provinceId,
      districtId: user.districtId,
      sectorId: user.sectorId,
      createdAt: user.createdAt,
    },
  });
}

// PUT /api/v1/citizen/profile
export async function updateProfile(req: Request, res: Response) {
  const { firstName, lastName, phone, preferredLanguage, provinceId, districtId, sectorId } = req.body ?? {};
  const user = await prisma.user.update({
    where: { id: req.user!.sub },
    data: {
      ...(firstName ? { firstName: String(firstName).trim() } : {}),
      ...(lastName ? { lastName: String(lastName).trim() } : {}),
      ...(phone !== undefined ? { phone: phone ? String(phone).trim() : null } : {}),
      ...(preferredLanguage && ['rw', 'en', 'fr'].includes(preferredLanguage) ? { preferredLanguage } : {}),
      ...(provinceId !== undefined ? { provinceId: provinceId ? Number(provinceId) : null } : {}),
      ...(districtId !== undefined ? { districtId: districtId ? Number(districtId) : null } : {}),
      ...(sectorId !== undefined ? { sectorId: sectorId ? Number(sectorId) : null } : {}),
    },
  });
  await audit(req, { action: 'PROFILE_UPDATED', resourceType: 'USER', resourceId: String(user.id) });
  return ok(res, null, 'Profile updated successfully');
}

// GET /api/v1/citizen/reports?status=&page=
export async function getReports(req: Request, res: Response) {
  const citizenId = req.user!.sub;
  const status = req.query.status as string | undefined;
  const page = Math.max(1, parseInt(req.query.page as string ?? '1', 10));
  const pageSize = 10;

  const where = {
    citizenId,
    ...(status && status !== 'ALL' ? { status } : {}),
  };

  const [total, reports] = await Promise.all([
    prisma.report.count({ where }),
    prisma.report.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { category: true, district: true, sector: true },
    }),
  ]);

  return ok(res, {
    reports: reports.map((r) => ({
      id: r.id,
      reference: r.reference,
      title: r.title,
      status: r.status,
      urgency: r.urgency,
      categoryName: r.category.name,
      categoryIcon: r.category.icon,
      districtName: r.district.name,
      sectorName: r.sector?.name ?? null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

// POST /api/v1/citizen/reports
export async function createReport(req: Request, res: Response) {
  const citizenId = req.user!.sub;
  const { title, description, categoryId, urgency, provinceId, districtId, sectorId, cellId, latitude, longitude, locationDescription, isAnonymous, affectedPeople, vulnerableGroup } = req.body ?? {};

  if (!title || !description || !categoryId || !provinceId || !districtId) {
    return fail(res, 'Title, description, category, province and district are required', 422);
  }

  const category = await prisma.category.findFirst({ where: { id: Number(categoryId), isActive: true } });
  if (!category) return fail(res, 'Selected category is not available', 422);

  // Verify the geo hierarchy chain belongs together (GIS routing integrity §66)
  const district = await prisma.district.findFirst({ where: { id: Number(districtId), provinceId: Number(provinceId) } });
  if (!district) return fail(res, 'Selected district does not belong to the selected province', 422);

  const last = await prisma.report.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
  const provisionalId = (last?.id ?? 0) + 1;
  const reference = generateReportReference(provisionalId);

  const report = await prisma.report.create({
    data: {
      reference,
      title: String(title).trim().slice(0, 200),
      description: String(description).trim(),
      status: 'SUBMITTED',
      urgency: ['LOW', 'MEDIUM', 'HIGH'].includes(urgency) ? urgency : 'MEDIUM',
      citizenId,
      categoryId: category.id,
      provinceId: Number(provinceId),
      districtId: Number(districtId),
      sectorId: sectorId ? Number(sectorId) : null,
      cellId: cellId ? Number(cellId) : null,
      latitude: latitude ? String(latitude) : null,
      longitude: longitude ? String(longitude) : null,
      locationDescription: locationDescription ? String(locationDescription).slice(0, 300) : null,
      isAnonymous: Boolean(isAnonymous),
      affectedPeople: affectedPeople !== undefined && affectedPeople !== null && affectedPeople !== '' ? Math.max(0, Number(affectedPeople) || 0) : null,
      vulnerableGroup: Boolean(vulnerableGroup),
      statusHistory: {
        create: {
          toStatus: 'SUBMITTED',
          note: 'Report submitted. Awaiting review.',
          actorName: 'Citizen',
        },
      },
    },
  });

  await audit(req, { action: 'REPORT_CREATED', resourceType: 'REPORT', resourceId: String(report.id), detail: reference });
  await notify({ userId: citizenId, type: 'REPORT_SUBMITTED', title: 'Report submitted', message: `Your report ${reference} has been received. Tracking number: ${reference}.`, reportId: report.id });

  // Notify the responsible government staff (district + sector officers of the
  // report's district, per master spec §5 step "responsible officer is notified").
  try {
    const officers = await prisma.user.findMany({
      where: {
        isActive: true,
        districtId: Number(districtId),
        role: { name: { in: ['CELL_OFFICER', 'SECTOR_OFFICER', 'OFFICER', 'DISTRICT_ADMIN'] } },
      },
      select: { id: true },
      take: 10,
    });
    const urgencyTag = urgency === 'HIGH' ? '⚠️ HIGH urgency' : 'New';
    for (const officer of officers) {
      await notify({
        userId: officer.id,
        type: urgency === 'HIGH' ? 'REPORT_ESCALATED' : 'REPORT_RECEIVED',
        title: `${urgencyTag} report in ${district?.name ?? 'your district'}`,
        message: `${category.name}: ${String(title).trim().slice(0, 80)} (ref ${reference}). Open the workflow queue to verify.`,
        reportId: report.id,
      });
    }
  } catch {
    // officer notification is best-effort; citizen confirmation already sent
  }

  await enqueueAIAnalysis(report.id);

  return ok(res, {
    report: {
      id: report.id,
      reference: report.reference,
      title: report.title,
      status: report.status,
      createdAt: report.createdAt,
    },
  }, 'Report submitted successfully. We will notify you when it is reviewed.', 201);
}

// PUT /api/v1/citizen/reports/:id — edit own report before verification (§7).
export async function updateReport(req: Request, res: Response) {
  const id = Number(req.params.id);
  const existing = await prisma.report.findUnique({ where: { id } });
  if (!existing) return notFound(res, 'Report not found');
  if (existing.citizenId !== req.user!.sub) return fail(res, 'You do not have permission to edit this report', 403);
  if (!['SUBMITTED', 'AI_ANALYSIS', 'PENDING_VERIFICATION', 'DRAFT'].includes(existing.status)) {
    return fail(res, `Reports with status ${existing.status} can no longer be edited by citizens`, 409);
  }
  const { title, description, sectorId, cellId, latitude, longitude, locationDescription, affectedPeople, vulnerableGroup } = req.body ?? {};
  const updated = await prisma.report.update({
    where: { id },
    data: {
      ...(title ? { title: String(title).trim().slice(0, 200) } : {}),
      ...(description ? { description: String(description).trim() } : {}),
      ...(sectorId !== undefined ? { sectorId: sectorId ? Number(sectorId) : null } : {}),
      ...(cellId !== undefined ? { cellId: cellId ? Number(cellId) : null } : {}),
      ...(latitude !== undefined ? { latitude: latitude ? String(latitude) : null } : {}),
      ...(longitude !== undefined ? { longitude: longitude ? String(longitude) : null } : {}),
      ...(locationDescription !== undefined ? { locationDescription: locationDescription ? String(locationDescription).slice(0, 300) : null } : {}),
      ...(affectedPeople !== undefined ? { affectedPeople: affectedPeople === null || affectedPeople === '' ? null : Math.max(0, Number(affectedPeople) || 0) } : {}),
      ...(vulnerableGroup !== undefined ? { vulnerableGroup: Boolean(vulnerableGroup) } : {}),
    },
  });
  await prisma.reportStatusHistory.create({
    data: { reportId: id, fromStatus: existing.status, toStatus: existing.status, note: 'Citizen edited report details', actorId: req.user!.sub, actorName: `${req.user!.firstName} ${req.user!.lastName}` },
  });
  await audit(req, { action: 'REPORT_UPDATED', resourceType: 'REPORT', resourceId: String(id) });
  return ok(res, { report: { id: updated.id, reference: updated.reference, status: updated.status } }, 'Report updated');
}

// GET /api/v1/citizen/reports/:id
export async function getReportDetails(req: Request, res: Response) {
  const report = await getOwnReport(req, res);
  if (!report) return;

  await audit(req, { action: 'REPORT_VIEWED', resourceType: 'REPORT', resourceId: String(report.id) });

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
        latitude: report.latitude,
        longitude: report.longitude,
        description: report.locationDescription,
      },
      evidence: report.evidence.map((e) => ({ id: e.id, fileName: e.fileName, mimeType: e.mimeType, sizeBytes: e.sizeBytes })),
      timeline: report.statusHistory.map((h) => ({
        id: h.id,
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        note: h.note,
        actorName: h.actorName,
        createdAt: h.createdAt,
      })),
      updates: report.updates.map((u) => ({ id: u.id, message: u.message, authorName: u.authorName, createdAt: u.createdAt })),
      feedback: report.feedback ? { rating: report.feedback.rating, comment: report.feedback.comment } : null,
      resolutionConfirmedAt: report.resolutionConfirmedAt,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
      resolvedAt: report.resolvedAt,
    },
  });
}

// GET /api/v1/citizen/reports/:id/timeline
export async function getReportTimeline(req: Request, res: Response) {
  const report = await getOwnReport(req, res);
  if (!report) return;
  return ok(res, { timeline: report.statusHistory });
}

// POST /api/v1/citizen/reports/:id/messages
export async function sendMessage(req: Request, res: Response) {
  const report = await getOwnReport(req, res);
  if (!report) return;

  const { message } = req.body ?? {};
  if (!message || !String(message).trim()) return fail(res, 'Message cannot be empty', 422);

  const msg = await prisma.reportMessage.create({
    data: {
      reportId: report.id,
      senderId: req.user!.sub,
      senderRole: 'CITIZEN',
      message: String(message).trim().slice(0, 2000),
    },
  });

  await audit(req, { action: 'MESSAGE_SENT', resourceType: 'REPORT', resourceId: String(report.id) });
  return ok(res, { message: { id: msg.id, senderRole: 'CITIZEN', message: msg.message, createdAt: msg.createdAt } }, 'Message sent', 201);
}

// GET /api/v1/citizen/reports/:id/messages
export async function getMessages(req: Request, res: Response) {
  const report = await getOwnReport(req, res);
  if (!report) return;
  const messages = await prisma.reportMessage.findMany({
    where: { reportId: report.id },
    orderBy: { createdAt: 'asc' },
  });
  return ok(res, { messages });
}

// POST /api/v1/citizen/reports/:id/feedback
export async function submitFeedback(req: Request, res: Response) {
  const report = await getOwnReport(req, res);
  if (!report) return;

  if (!['RESOLVED', 'CLOSED'].includes(report.status)) {
    return fail(res, 'Feedback can only be provided after the report is resolved', 422);
  }
  const { rating, comment } = req.body ?? {};
  const ratingNum = Number(rating);
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return fail(res, 'Rating must be between 1 and 5 stars', 422);
  }
  if (report.feedback) {
    return fail(res, 'Feedback has already been submitted for this report', 409);
  }

  await prisma.feedback.create({
    data: { reportId: report.id, rating: ratingNum, comment: comment ? String(comment).slice(0, 1000) : null },
  });
  await audit(req, { action: 'FEEDBACK_SUBMITTED', resourceType: 'REPORT', resourceId: String(report.id), detail: `rating=${ratingNum}` });
  return ok(res, null, 'Thank you for your feedback', 201);
}

// POST /api/v1/citizen/reports/:id/confirm-resolution
// Closes the reporting loop: the citizen confirms the problem is actually
// solved. Notifies the responsible officer so staff can archive confidently.
export async function confirmResolution(req: Request, res: Response) {
  const report = await getOwnReport(req, res);
  if (!report) return;

  if (!['RESOLVED', 'CLOSED'].includes(report.status)) {
    return fail(res, 'Only resolved reports can be confirmed', 422);
  }
  if (report.resolutionConfirmedAt) {
    return fail(res, 'You have already confirmed this resolution', 409);
  }

  const confirmedAt = new Date();
  await prisma.report.update({ where: { id: report.id }, data: { resolutionConfirmedAt: confirmedAt } });
  await prisma.reportStatusHistory.create({
    data: {
      reportId: report.id,
      fromStatus: report.status,
      toStatus: report.status,
      note: 'Citizen confirmed the problem is solved.',
      actorId: req.user!.sub,
      actorName: `${req.user!.firstName} ${req.user!.lastName}`,
    },
  });

  if (report.assignedOfficerId && report.assignedOfficerId !== req.user!.sub) {
    await notify({
      userId: report.assignedOfficerId,
      type: 'REPORT_UPDATED',
      title: 'Citizen confirmed resolution',
      message: `The citizen confirmed ${report.reference} (${report.title.slice(0, 60)}) is solved. You may archive it.`,
      reportId: report.id,
    });
  }

  await audit(req, { action: 'RESOLUTION_CONFIRMED', resourceType: 'REPORT', resourceId: String(report.id), detail: report.reference });
  return ok(res, { confirmedAt: confirmedAt.toISOString() }, 'Thank you for confirming the resolution');
}

// POST /api/v1/citizen/reports/:id/reopen
export async function requestReopen(req: Request, res: Response) {
  const report = await getOwnReport(req, res);
  if (!report) return;

  if (report.status === 'REOPEN_REQUESTED') {
    return fail(res, 'A reopening request is already under review', 409);
  }
  if (!['RESOLVED', 'CLOSED'].includes(report.status)) {
    return fail(res, 'Only resolved reports can be reopened', 422);
  }

  const { reason } = req.body ?? {};
  if (!reason || !String(reason).trim()) return fail(res, 'Please explain why this report should be reopened', 422);

  // Goes to government workflow for review — never auto-reopened (§39)
  await prisma.report.update({ where: { id: report.id }, data: { status: 'REOPEN_REQUESTED' } });
  await prisma.reportStatusHistory.create({
    data: {
      reportId: report.id,
      fromStatus: report.status,
      toStatus: 'REOPEN_REQUESTED',
      note: String(reason).trim().slice(0, 500),
      actorName: 'Citizen',
    },
  });
  try {
    await prisma.reportReopenRequest.create({
      data: { reportId: report.id, reason: String(reason).trim().slice(0, 500), actorId: req.user!.sub, actorName: `${req.user!.firstName} ${req.user!.lastName}` },
    });
  } catch {
    // companion record is additive; status change already recorded
  }
  // Alert district staff that a citizen is asking to reopen.
  try {
    if (report.districtId) {
      const officers = await prisma.user.findMany({
        where: { isActive: true, districtId: report.districtId, role: { name: { in: ['SECTOR_OFFICER', 'OFFICER', 'DISTRICT_ADMIN'] } } },
        select: { id: true },
        take: 5,
      });
      for (const officer of officers) {
        await notify({ userId: officer.id, type: 'REPORT_REOPENED', title: 'Reopen request', message: `Citizen asked to reopen ${report.reference}: ${String(reason).trim().slice(0, 100)}`, reportId: report.id });
      }
    }
  } catch {
    // best-effort
  }

  await audit(req, { action: 'REPORT_REOPEN_REQUESTED', resourceType: 'REPORT', resourceId: String(report.id) });
  return ok(res, null, 'Reopening request submitted. Government staff will review it.', 201);
}

// GET /api/v1/citizen/activity
export async function getActivity(req: Request, res: Response) {
  const citizenId = req.user!.sub;
  const reports = await prisma.report.findMany({
    where: { citizenId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true, reference: true, title: true, createdAt: true, status: true },
  });
  const feedbacks = await prisma.feedback.findMany({
    where: { report: { citizenId } },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { report: { select: { reference: true, title: true } } },
  });

  const items = [
    ...reports.map((r) => ({ type: 'REPORT_SUBMITTED', label: `Submitted report: ${r.title}`, reference: r.reference, at: r.createdAt })),
    ...feedbacks.map((f) => ({ type: 'FEEDBACK', label: `Provided feedback on: ${f.report.title}`, reference: f.report.reference, at: f.createdAt })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return ok(res, { activity: items.slice(0, 30) });
}

// GET /api/v1/citizen/map/problems — public map data with privacy filtering (§28, §58)
export async function getMapProblems(req: Request, res: Response) {
  const reports = await prisma.report.findMany({
    where: {
      // Only reports approved for public display
      isPublic: true,
      status: { in: ['RESOLVED', 'CLOSED', 'IN_PROGRESS', 'VERIFIED', 'ASSIGNED'] },
    },
    select: {
      id: true,
      reference: true,
      title: true,
      status: true,
      latitude: true,
      longitude: true,
      createdAt: true,
      category: { select: { name: true, icon: true, color: true } },
      district: { select: { name: true } },
    },
  });

  // Privacy: never send citizen identity, description, evidence, or AI internals
  return ok(res, {
    problems: reports.map((r) => ({
      id: r.id,
      reference: r.reference,
      title: r.title,
      status: r.status,
      categoryName: r.category.name,
      categoryIcon: r.category.icon,
      categoryColor: r.category.color,
      district: r.district.name,
      latitude: r.latitude ? Number(r.latitude) : null,
      longitude: r.longitude ? Number(r.longitude) : null,
      createdAt: r.createdAt,
    })),
  });
}

// GET /api/v1/citizen/problems/nearby?lat=&lng=&radiusKm=
export async function getNearbyProblems(req: Request, res: Response) {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);
  const radiusKm = Math.min(50, parseFloat(req.query.radiusKm as string ?? '10') || 10);

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return fail(res, 'Valid latitude and longitude are required', 422);
  }

  const reports = await prisma.report.findMany({
    where: {
      isPublic: true,
      status: { in: ['RESOLVED', 'CLOSED', 'IN_PROGRESS', 'VERIFIED', 'ASSIGNED'] },
      latitude: { not: null },
      longitude: { not: null },
    },
    include: { category: true, district: true },
  });

  // Haversine distance in Node (fine at Rwanda's data scale; MySQL spatial is a later optimisation)
  const R = 6371;
  const nearby = reports
    .map((r) => {
      const rLat = Number(r.latitude);
      const rLng = Number(r.longitude);
      const dLat = ((rLat - lat) * Math.PI) / 180;
      const dLng = ((rLng - lng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat * Math.PI) / 180) * Math.cos((rLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
      const distanceKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return { report: r, distanceKm };
    })
    .filter((x) => x.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 25)
    .map(({ report: r, distanceKm }) => ({
      id: r.id,
      reference: r.reference,
      title: r.title,
      status: r.status,
      categoryName: r.category.name,
      categoryIcon: r.category.icon,
      district: r.district.name,
      distanceKm: Math.round(distanceKm * 10) / 10,
      createdAt: r.createdAt,
    }));

  return ok(res, { problems: nearby });
}

// GET /api/v1/citizen/community/insights — approved public aggregates only (§33-35)
export async function getCommunityInsights(req: Request, res: Response) {
  const [topCategories, totalReports, resolvedReports, inProgressReports, underReviewReports, recentResolved] = await Promise.all([
    prisma.category.findMany({
      include: { _count: { select: { reports: { where: { isPublic: true } } } } },
      where: { isActive: true },
    }),
    prisma.report.count({ where: { isPublic: true } }),
    prisma.report.count({ where: { isPublic: true, status: { in: ['RESOLVED', 'CLOSED'] } } }),
    prisma.report.count({ where: { isPublic: true, status: { in: ['IN_PROGRESS', 'ASSIGNED'] } } }),
    prisma.report.count({ where: { isPublic: true, status: { in: ['UNDER_REVIEW', 'VERIFIED'] } } }),
    prisma.report.findMany({
      where: { isPublic: true, status: { in: ['RESOLVED', 'CLOSED'] } },
      orderBy: { resolvedAt: 'desc' },
      take: 6,
      include: { category: true, district: true },
    }),
  ]);

  const mostReported = topCategories
    .map((c) => ({ name: c.name, icon: c.icon, count: c._count.reports }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return ok(res, {
    stats: { totalReports, resolvedReports, inProgressReports, underReviewReports },
    mostReported,
    recentlyResolved: recentResolved.map((r) => ({
      id: r.id,
      reference: r.reference,
      title: r.title,
      categoryName: r.category.name,
      categoryIcon: r.category.icon,
      district: r.district.name,
      resolvedAt: r.resolvedAt,
    })),
  });
}

// GET /api/v1/citizen/community/alerts
export async function getCommunityAlerts(req: Request, res: Response) {
  const alerts = await prisma.communityAlert.findMany({
    where: { isActive: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  return ok(res, { alerts });
}
