import type { Request, Response } from 'express';
import { prisma } from '../config/db';
import { fail, notFound, ok } from '../utils/helpers';
import { getAIAnalysis, getAIJob, enqueueAIAnalysis } from '../services/ai.service';

async function canViewReport(req: Request, reportId: number) {
  const report = await prisma.report.findUnique({ where: { id: reportId }, select: { citizenId: true, districtId: true } });
  if (!report) return { report: null, allowed: false };
  if (req.user?.role === 'CITIZEN') return { report, allowed: report.citizenId === req.user.sub };
  if (req.user?.role === 'DISTRICT_ADMIN') {
    const user = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { districtId: true } });
    return { report, allowed: user?.districtId === report.districtId };
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