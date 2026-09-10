// R-CPI Task 3 — filtered list / overdue / statistics (ADDITIVE)
// Spec §50 filtering, §51 sorting, §26 overdue, §78 analytics.
// Part 1: scoping + filtered list.
import type { Request, Response } from 'express';
import { prisma } from '../config/db';
import { ok } from '../utils/helpers';

export async function scopeWhere(req: Request): Promise<Record<string, unknown>> {
  const role = req.user!.role;
  if (role === 'CITIZEN') return { citizenId: req.user!.sub };
  if (role === 'DISTRICT_ADMIN' || role === 'OFFICER') {
    const me = await prisma.user.findUnique({ where: { id: req.user!.sub }, select: { districtId: true } });
    if (role === 'DISTRICT_ADMIN') return me?.districtId ? { districtId: me.districtId } : {};
    if (me?.districtId) return { OR: [{ assignedOfficerId: req.user!.sub }, { districtId: me.districtId }] };
    return { assignedOfficerId: req.user!.sub };
  }
  return {};
}

export async function listReportsFiltered(req: Request, res: Response) {
  const q = req.query;
  const page = Math.max(1, parseInt(String(q.page ?? '1'), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(q.limit ?? '20'), 10)));
  const sort = String(q.sort ?? 'newest');
  const search = typeof q.search === 'string' ? q.search.trim() : '';
  const scope = await scopeWhere(req);
  const and: Record<string, unknown>[] = [scope];
  if (q.status && q.status !== 'ALL') and.push({ status: String(q.status) });
  if (q.categoryId) and.push({ categoryId: Number(q.categoryId) });
  if (q.districtId) and.push({ districtId: Number(q.districtId) });
  if (q.sectorId) and.push({ sectorId: Number(q.sectorId) });
  if (q.cellId) and.push({ cellId: Number(q.cellId) });
  if (q.urgency) and.push({ urgency: String(q.urgency) });
  if (q.priority) and.push({ urgency: String(q.priority) });
  if (q.assignedOfficerId) and.push({ assignedOfficerId: Number(q.assignedOfficerId) });
  if (q.from || q.to) {
    and.push({ createdAt: { ...(q.from ? { gte: new Date(String(q.from)) } : {}), ...(q.to ? { lte: new Date(String(q.to)) } : {}) } });
  }
  if (search) {
    and.push({ OR: [{ reference: { contains: search } }, { title: { contains: search } }, { description: { contains: search } }] });
  }
  const where = and.length === 1 ? and[0] : { AND: and };
  const [total, reports] = await Promise.all([
    prisma.report.count({ where: where as never }),
    prisma.report.findMany({
      where: where as never,
      orderBy: sort === 'oldest' ? { createdAt: 'asc' } : sort === 'updated' ? { updatedAt: 'desc' } : { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { category: { select: { name: true, icon: true } }, district: { select: { name: true } }, sector: { select: { name: true } } },
    }),
  ]);
  return ok(res, {
    reports: reports.map((r) => ({
      id: r.id, reference: r.reference, title: r.title, status: r.status, urgency: r.urgency,
      categoryName: r.category.name, categoryIcon: r.category.icon, districtName: r.district.name,
      sectorName: r.sector?.name ?? null, createdAt: r.createdAt, updatedAt: r.updatedAt,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}


// Part 2: overdue (§26) — exact deadline tracking once the
// deadline column is migrated; until then an SLA heuristic.
export async function listOverdueReportsTask3(req: Request, res: Response) {
  const scope = await scopeWhere(req);
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const reports = await prisma.report.findMany({
    where: { ...scope, status: { notIn: ['CLOSED', 'REJECTED', 'RESOLVED'] }, updatedAt: { lt: cutoff } } as never,
    orderBy: { updatedAt: 'asc' },
    take: 200,
    include: { category: { select: { name: true } }, district: { select: { name: true } } },
  });
  return ok(res, {
    slaHeuristic: 'updatedAt older than 48h (exact deadline tracking pending deadline-column migration)',
    reports: reports.map((r) => ({
      id: r.id, reference: r.reference, title: r.title, status: r.status,
      categoryName: r.category.name, districtName: r.district.name,
      assignedOfficerId: (r as unknown as { assignedOfficerId: number | null }).assignedOfficerId ?? null,
      updatedAt: r.updatedAt,
      daysOverdue: Math.floor((Date.now() - r.updatedAt.getTime()) / 86400000),
    })),
  });
}

// Part 3: statistics (§78) — real DB aggregates, never fake.
export async function getReportStatistics(req: Request, res: Response) {
  const scope = await scopeWhere(req);
  const s = scope as never;
  const [total, byStatus, byCategory, byDistrict, rejected, verified, reopened, resolvedSample] = await Promise.all([
    prisma.report.count({ where: s }),
    prisma.report.groupBy({ by: ['status'], where: s, _count: { status: true } }),
    prisma.report.groupBy({ by: ['categoryId'], where: s, _count: { categoryId: true } }),
    prisma.report.groupBy({ by: ['districtId'], where: s, _count: { districtId: true }, orderBy: { _count: { districtId: 'desc' } }, take: 10 }),
    prisma.report.count({ where: { ...scope, status: 'REJECTED' } as never }),
    prisma.report.count({ where: { ...scope, status: 'VERIFIED' } as never }),
    prisma.report.count({ where: { ...scope, status: { in: ['REOPENED', 'REOPEN_REQUESTED'] } } as never }),
    prisma.report.findMany({ where: { ...scope, resolvedAt: { not: null } } as never, select: { createdAt: true, resolvedAt: true }, take: 500 }),
  ]);
  const cats = await prisma.category.findMany({ select: { id: true, name: true } });
  const dists = await prisma.district.findMany({ select: { id: true, name: true } });
  const catName = new Map(cats.map((c) => [c.id, c.name]));
  const distName = new Map(dists.map((d) => [d.id, d.name]));
  const hours = resolvedSample.filter((r) => r.resolvedAt)
    .map((r) => (new Date(r.resolvedAt!).getTime() - new Date(r.createdAt).getTime()) / 3600000);
  return ok(res, {
    total,
    byStatus: byStatus.map((b) => ({ status: b.status, count: b._count.status })),
    byCategory: byCategory.map((b) => ({ categoryId: b.categoryId, categoryName: catName.get(b.categoryId) ?? null, count: b._count.categoryId })),
    byDistrict: byDistrict.map((b) => ({ districtId: b.districtId, districtName: distName.get(b.districtId) ?? null, count: b._count.districtId })),
    rejected, verified, reopened,
    avgResolutionHours: hours.length ? Math.round((hours.reduce((a, b) => a + b, 0) / hours.length) * 10) / 10 : null,
  });
}
