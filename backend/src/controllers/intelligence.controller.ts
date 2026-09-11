import type { Request, Response } from 'express';
import { prisma } from '../config/db';
import { ok } from '../utils/helpers';

const OPEN_STATUSES = ['SUBMITTED', 'RECEIVED', 'UNDER_REVIEW', 'VERIFIED', 'ASSIGNED', 'IN_PROGRESS', 'ESCALATED', 'REOPEN_REQUESTED', 'REOPENED'];

function priorityFor(report: { urgency: string; status: string; createdAt: Date; latitude: unknown; longitude: unknown; aiPriorityScore: unknown; }) {
  const urgency = report.urgency === 'HIGH' ? 30 : report.urgency === 'MEDIUM' ? 18 : 8;
  const age = Math.min(25, Math.floor((Date.now() - report.createdAt.getTime()) / 86400000));
  const unresolved = OPEN_STATUSES.includes(report.status) ? 20 : 0;
  const location = report.latitude !== null && report.longitude !== null ? 10 : 0;
  const aiScore = report.aiPriorityScore === null ? 0 : Number(report.aiPriorityScore);
  const ai = Number.isFinite(aiScore) ? Math.round(aiScore * 15) : 0;
  const score = Math.min(100, urgency + age + unresolved + location + ai);
  return { score, status: score >= 75 ? 'CRITICAL' : score >= 50 ? 'HIGH' : score >= 25 ? 'MEDIUM' : 'LOW' };
}

async function scopedReports(req: Request) {
  const role = req.user?.role;
  if (role === 'DISTRICT_ADMIN' || role === 'OFFICER') {
    const user = await prisma.user.findUnique({ where: { id: req.user!.sub }, select: { districtId: true } });
    return user?.districtId ? { districtId: user.districtId } : { assignedOfficerId: req.user!.sub };
  }
  return {};
}

export async function getIntelligenceDashboard(req: Request, res: Response) {
  const scope = await scopedReports(req);
  const reports = await prisma.report.findMany({
    where: scope,
    select: {
      id: true, reference: true, title: true, status: true, urgency: true, createdAt: true, updatedAt: true,
      latitude: true, longitude: true, aiPriorityScore: true, categoryId: true, districtId: true,
      category: { select: { name: true, icon: true, color: true } },
      district: { select: { name: true } },
      province: { select: { name: true } },
      sector: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const priorities = reports.map((report) => ({ ...report, priority: priorityFor(report) }));
  const by = (key: 'status' | 'categoryId' | 'districtId') => {
    const counts = new Map<string, number>();
    for (const report of reports) {
      const label = key === 'status' ? report.status : key === 'categoryId' ? report.category.name : report.district.name;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  };
  const resolved = reports.filter((report) => ['RESOLVED', 'CLOSED'].includes(report.status));
  const resolutionHours = resolved.map((report) => (report.updatedAt.getTime() - report.createdAt.getTime()) / 3600000);
  const critical = priorities.filter((report) => report.priority.status === 'CRITICAL').sort((a, b) => b.priority.score - a.priority.score).slice(0, 10);
  const points = priorities.filter((report) => report.latitude !== null && report.longitude !== null).map((report) => ({
    id: report.id, reference: report.reference, title: report.title, status: report.status, category: report.category.name,
    categoryIcon: report.category.icon, categoryColor: report.category.color, province: report.province.name, district: report.district.name,
    sector: report.sector?.name ?? null, latitude: Number(report.latitude), longitude: Number(report.longitude), priority: report.priority,
    createdAt: report.createdAt,
  }));

  return ok(res, {
    stats: {
      total: reports.length,
      open: reports.filter((report) => OPEN_STATUSES.includes(report.status)).length,
      critical: priorities.filter((report) => report.priority.status === 'CRITICAL').length,
      resolved: resolved.length,
      mapped: points.length,
      resolutionRate: reports.length ? Math.round((resolved.length / reports.length) * 100) : 0,
      avgResolutionHours: resolutionHours.length ? Math.round((resolutionHours.reduce((sum, value) => sum + value, 0) / resolutionHours.length) * 10) / 10 : null,
    },
    byStatus: by('status'),
    byCategory: by('categoryId'),
    byDistrict: by('districtId'),
    points,
    recent: priorities.slice(0, 100).map((report) => ({ id: report.id, reference: report.reference, title: report.title, status: report.status, urgency: report.urgency, category: report.category.name, district: report.district.name, priority: report.priority, createdAt: report.createdAt, updatedAt: report.updatedAt })),
    critical: critical.map((report) => ({ id: report.id, reference: report.reference, title: report.title, category: report.category.name, district: report.district.name, priority: report.priority, status: report.status })),
    predictions: by('categoryId').slice(0, 5).map((item) => ({ subject: item.label, outlook: item.count >= 3 ? 'Increasing incidents' : 'Monitor', confidence: item.count >= 3 ? 0.72 : 0.48, basis: `${item.count} reports in the current dataset` })),
  });
}

export async function searchIntelligenceReports(req: Request, res: Response) {
  const scope = await scopedReports(req);
  const q = String(req.query.q ?? '').trim();
  const status = String(req.query.status ?? 'ALL');
  const districtId = req.query.districtId ? Number(req.query.districtId) : undefined;
  const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
  const where: any = { ...scope, ...(status !== 'ALL' ? { status } : {}), ...(districtId ? { districtId } : {}), ...(categoryId ? { categoryId } : {}) };
  if (q) where.OR = [{ reference: { contains: q } }, { title: { contains: q } }, { description: { contains: q } }];
  const reports = await prisma.report.findMany({ where, take: 100, orderBy: { updatedAt: 'desc' }, include: { category: true, district: true } });
  return ok(res, { reports: reports.map((report) => ({ id: report.id, reference: report.reference, title: report.title, status: report.status, urgency: report.urgency, category: report.category.name, district: report.district.name, priority: priorityFor(report), createdAt: report.createdAt, updatedAt: report.updatedAt })) });
}

export async function exportIntelligenceCsv(req: Request, res: Response) {
  const scope = await scopedReports(req);
  const reports = await prisma.report.findMany({ where: scope, orderBy: { createdAt: 'desc' }, include: { category: true, district: true } });
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const rows = [
    ['Reference', 'Title', 'Status', 'Urgency', 'Category', 'District', 'Priority', 'Risk', 'Created'].map(escape).join(','),
    ...reports.map((report) => { const priority = priorityFor(report); return [report.reference, report.title, report.status, report.urgency, report.category.name, report.district.name, priority.score, priority.status, report.createdAt.toISOString()].map(escape).join(','); }),
  ];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="rcpi-reports.csv"');
  return res.send(rows.join('\n'));
}