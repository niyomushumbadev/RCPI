// ─────────────────────────────────────────────────────────────
// R-CPI Task 3 — Repository (ADDITIVE, spec §44)
// Thin Prisma data-access layer. No business rules here.
// Spec expects: src/repositories/report.repository.ts
// Existing controllers/services are untouched.
// ─────────────────────────────────────────────────────────────
import { prisma } from '../config/db';

export async function findReportById(id: number) {
  return prisma.report.findUnique({ where: { id } });
}

export async function findReportFullById(id: number) {
  return prisma.report.findUnique({
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
      updates: { orderBy: { createdAt: 'desc' } },
    },
  });
}

type Tx = { report: { update: (args: unknown) => Promise<unknown> } };

export async function updateReportStatusTx(tx: Tx, id: number, status: string) {
  return tx.report.update({ where: { id }, data: { status } });
}

export async function listReportsPaged(args: {
  where: Record<string, unknown>;
  skip: number;
  take: number;
}) {
  const [total, reports] = await Promise.all([
    prisma.report.count({ where: args.where as never }),
    prisma.report.findMany({
      where: args.where as never,
      orderBy: { createdAt: 'desc' },
      skip: args.skip,
      take: args.take,
      include: { category: true, district: true, sector: true },
    }),
  ]);
  return { total, reports };
}
