import type { Request, Response } from 'express';
import { prisma } from '../config/db';
import { ok, fail, notFound } from '../utils/helpers';
import { audit } from '../services/audit.service';
import { notify } from '../services/notification.service';
import { calculatePriority } from '../services/priority.service';
import { enqueueAIAnalysis, getAIAnalysis, getAIJob } from '../services/ai.service';

async function canViewReport(req: Request, reportId: number) {
  const report = await prisma.report.findUnique({ where: { id: reportId }, select: { citizenId: true, districtId: true } });
  if (!report) return { report: null, allowed: false };
  if (req.user?.role === 'CITIZEN') return { report, allowed: report.citizenId === req.user.sub };
  if (req.user?.role === 'CELL_OFFICER' || req.user?.role === 'SECTOR_OFFICER' || req.user?.role === 'OFFICER' || req.user?.role === 'DISTRICT_ADMIN') {
    const user = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { districtId: true } });
    if (user?.districtId && report.districtId !== user.districtId) return { report, allowed: false };
    return { report, allowed: true };
  }
  if (req.user?.role === 'EXECUTIVE') {
    // Executive sees aggregated intelligence only — no object-level report access.
    return { report, allowed: false };
  }
  return { report, allowed: true };
}

export async function getReportAI(req: Request, res: Response) {
  const reportId = Number(req.params.id);
  const access = await canViewReport(req, reportId);
  if (!access.report) return notFound(res, 'Report not found');
  if (!access.allowed) return fail(res, 'You do not have permission to view this analysis', 403);
  const [job, analysis] = await Promise.all([getAIJob(reportId), getAIAnalysis(reportId)]);
  return ok(res, { job, analysis });
}

export async function retryReportAI(req: Request, res: Response) {
  const reportId = Number(req.params.id);
  const access = await canViewReport(req, reportId);
  if (!access.report) return notFound(res, 'Report not found');
  if (!access.allowed || req.user?.role === 'CITIZEN') return fail(res, 'Only authorised government staff can retry analysis', 403);
  const job = await enqueueAIAnalysis(reportId);
  return ok(res, { job }, 'AI analysis queued', 202);
}

/** POST /api/v1/ai/assist — description help, translation, drafts, briefing. */
export async function assistText(req: Request, res: Response) {
  const { task, text, targetLanguage, reportId } = req.body ?? {};
  if (!task || !text || !String(text).trim()) return fail(res, 'An AI task and text are required', 422);
  const allowedTasks = ['IMPROVE_DESCRIPTION', 'TRANSLATE', 'DRAFT_RESPONSE', 'OFFICER_BRIEFING', 'SUMMARIZE', 'CLASSIFY'];
  if (!allowedTasks.includes(String(task))) return fail(res, 'Unsupported AI task', 422);
  const content = String(text).slice(0, 4000);
  const lang = ['rw', 'en', 'fr'].includes(String(targetLanguage)) ? String(targetLanguage) : 'en';
  const fallback: Record<string, string> = {
    IMPROVE_DESCRIPTION: `Clearer description: ${content.trim().replace(/\s+/g, ' ')} (Add: who is affected, since when, exact location.)`,
    TRANSLATE: `[${lang}] Offline translation is limited. Original preserved: ${content.slice(0, 500)}`,
    DRAFT_RESPONSE: `Dear citizen, thank you for your report. Our team received it and will update you on next steps.`,
    OFFICER_BRIEFING: `Briefing — Known: ${content.slice(0, 300)}. Missing: exact location, affected households, photos. Next: verify on site, assign department.`,
    SUMMARIZE: content.length > 220 ? `${content.slice(0, 220)}…` : content,
    CLASSIFY: 'Review keywords vs Drainage / Roads / Waste / Water / Electricity. Officer confirmation required.',
  };
  let result = fallback[String(task)];
  let model = 'offline-fallback-v1';
  let confidence = 0.45;
  const { env } = await import('../config/env');
  if (env.openaiApiKey) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.openaiApiKey}` },
        signal: AbortSignal.timeout(25_000),
        body: JSON.stringify({
          model: env.openaiModel,
          temperature: 0.2,
          messages: [
            { role: 'system', content: 'You assist Rwanda community-problem reporting. Only suggestions, never final decisions. Concise. Support rw/en/fr.' },
            { role: 'user', content: `Task: ${task}. Target: ${lang}. Text: ${content}` },
          ],
        }),
      });
      if (response.ok) {
        const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const out = body.choices?.[0]?.message?.content?.trim();
        if (out) {
          result = out.slice(0, 3000);
          model = env.openaiModel;
          confidence = 0.82;
        }
      }
    } catch {
      // keep fallback so workflow never crashes when OpenAI is unavailable
    }
  }
  await audit(req, { action: `AI_${task}`, resourceType: 'AI_ASSIST', resourceId: reportId ? String(reportId) : null, detail: `model=${model}` });
  return ok(res, { task, result, model, confidence, reviewed: false, hint: 'AI suggestion only — an officer must review before official use.' });
}

/** POST /api/v1/ai/reports/:id/review — officer confirms AI output. */
export async function reviewAI(req: Request, res: Response) {
  const reportId = Number(req.params.id);
  const access = await canViewReport(req, reportId);
  if (!access.report) return notFound(res, 'Report not found');
  if (!access.allowed) return fail(res, 'You do not have permission to review this analysis', 403);
  if (['CITIZEN', 'EXECUTIVE', 'ANALYST'].includes(req.user?.role ?? '')) {
    return fail(res, 'Only responsible officers can confirm AI analysis', 403);
  }
  await prisma.report.update({ where: { id: reportId }, data: { aiReviewed: true, aiReviewedBy: req.user!.sub, aiReviewedAt: new Date() } });
  await audit(req, { action: 'AI_REVIEWED', resourceType: 'REPORT', resourceId: String(reportId) });
  return ok(res, { reviewed: true }, 'AI analysis marked as reviewed by an officer');
}

/** GET /api/v1/ai/reports/:id/priority — transparent priority + reasons. */
export async function reportPriority(req: Request, res: Response) {
  const reportId = Number(req.params.id);
  const report = await prisma.report.findUnique({ where: { id: reportId }, include: { category: true, department: true } });
  if (!report) return notFound(res, 'Report not found');
  const access = await canViewReport(req, reportId);
  if (!access.allowed) return fail(res, 'You do not have permission to view this priority', 403);
  const nearbySimilar = await prisma.report.count({ where: { id: { not: reportId }, districtId: report.districtId, categoryId: report.categoryId } });
  const computed = calculatePriority({
    urgency: report.urgency,
    severity: report.severity,
    affectedPeople: report.affectedPeople,
    vulnerableGroup: report.vulnerableGroup,
    categoryName: report.category.name,
    title: report.title,
    description: report.description,
    createdAt: report.createdAt,
    status: report.status,
    hasLocation: report.latitude !== null && report.longitude !== null,
    nearbySimilarCount: nearbySimilar,
  });
  return ok(res, {
    priority: {
      score: computed.score,
      level: report.priority ?? computed.level,
      computedLevel: computed.level,
      officerOverride: report.priority && report.priority !== computed.level ? report.priority : null,
      overrideReason: report.priorityReason ?? null,
      reasons: computed.reasons,
    },
  });
}

/** PUT /api/v1/ai/reports/:id/priority — officer adjusts priority + reason. */
export async function setPriority(req: Request, res: Response) {
  const reportId = Number(req.params.id);
  const { priority, reason } = req.body ?? {};
  if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(String(priority))) return fail(res, 'Priority must be LOW, MEDIUM, HIGH or CRITICAL', 422);
  if (!reason || !String(reason).trim()) return fail(res, 'A reason is required when adjusting priority', 422);
  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) return notFound(res, 'Report not found');
  const access = await canViewReport(req, reportId);
  if (!access.allowed) return fail(res, 'You do not have permission to adjust this priority', 403);
  const allowed = ['CELL_OFFICER', 'SECTOR_OFFICER', 'OFFICER', 'DISTRICT_ADMIN', 'PROVINCE_ADMIN', 'CITY_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'];
  if (!allowed.includes(req.user?.role ?? '')) return fail(res, 'Only authorized officers can adjust priority', 403);
  const updated = await prisma.report.update({ where: { id: reportId }, data: { priority: String(priority), priorityReason: String(reason).slice(0, 500) } });
  await prisma.reportStatusHistory.create({
    data: {
      reportId,
      fromStatus: report.status,
      toStatus: report.status,
      note: `Priority adjusted to ${priority}: ${String(reason).slice(0, 300)}`,
      actorId: req.user!.sub,
      actorName: `${req.user!.firstName} ${req.user!.lastName}`,
    },
  });
  await audit(req, { action: 'PRIORITY_ADJUSTED', resourceType: 'REPORT', resourceId: String(reportId), detail: `${priority}` });
  await notify({ userId: report.citizenId, type: 'REPORT_UPDATED', title: 'Priority updated', message: `Your report ${report.reference} priority was reviewed.`, reportId });
  return ok(res, { priority: updated.priority, reason: updated.priorityReason }, 'Priority updated with audit record');
}