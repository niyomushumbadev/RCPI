// ─────────────────────────────────────────────────────────────
// R-CPI Task 3 — evidence upload/list (ADDITIVE, spec §30-32)
// POST /api/v1/reports/:id/evidence + GET /api/v1/reports/:id/evidence
// Secure: mime + extension + size validation, random stored names,
// executables blocked, history + audit written. The uploader,
// evidence-type and description are persisted in history/audit notes
// and returned; dedicated columns arrive with the media migration
// (see TASK3-GAP-FILL.md) — nothing is silently faked.
// ─────────────────────────────────────────────────────────────
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import multer from 'multer';
import type { Request, Response } from 'express';
import { prisma } from '../config/db';
import { ok, fail, notFound } from '../utils/helpers';
import { audit } from '../services/audit.service';
import { notify } from '../services/notification.service';

const EVIDENCE_TYPES = ['CITIZEN_EVIDENCE', 'VERIFICATION_EVIDENCE', 'INVESTIGATION_EVIDENCE', 'RESOLUTION_EVIDENCE', 'ADMINISTRATIVE_EVIDENCE'] as const;
const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf', 'text/plain',
  'video/mp4', 'video/webm', 'video/quicktime',
]);
const BLOCKED_EXT = new Set(['.exe', '.js', '.mjs', '.sh', '.bat', '.cmd', '.msi', '.dll', '.php', '.py', '.jar', '.com', '.scr']);
const MAX_BYTES = 10 * 1024 * 1024;

const uploadDir = path.join(process.cwd(), 'uploads', 'evidence');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

export const evidenceUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase().slice(0, 10);
      cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (BLOCKED_EXT.has(ext)) return cb(new Error('File type is not allowed'));
    if (!ALLOWED_MIME.has(file.mimetype)) return cb(new Error(`Unsupported file type: ${file.mimetype}`));
    cb(null, true);
  },
});

export async function uploadEvidenceTask3(req: Request, res: Response) {
  // multer attaches `file`; Express types don't know it — read via unknown cast.
  const file = (req as unknown as { file?: Express.Multer.File }).file;
  const body = (req.body ?? {}) as { evidenceType?: string; description?: string };
  const id = Number(req.params.id);
  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) {
    if (file) fs.unlink(file.path, () => undefined);
    return notFound(res, 'Report not found');
  }
  const isStaff = ['OFFICER', 'DISTRICT_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'].includes(req.user!.role);
  if (!isStaff && report.citizenId !== req.user!.sub) {
    if (file) fs.unlink(file.path, () => undefined);
    return fail(res, 'You do not have permission to attach evidence to this report', 403);
  }
  if (!file) return fail(res, 'No file received. Attach one image, document or video (max 10 MB).', 422);

  const evidenceType = EVIDENCE_TYPES.includes(body.evidenceType as (typeof EVIDENCE_TYPES)[number]) ? body.evidenceType! : 'CITIZEN_EVIDENCE';
  const description = body.description ? String(body.description).slice(0, 300) : null;
  const actorName = `${req.user!.firstName} ${req.user!.lastName}`;

  const row = await prisma.evidence.create({
    data: { reportId: id, fileName: file.originalname.slice(0, 200), storedName: file.filename, mimeType: file.mimetype, sizeBytes: file.size },
  });
  await prisma.reportStatusHistory.create({
    data: { reportId: id, fromStatus: report.status, toStatus: report.status, note: `Evidence uploaded [${evidenceType}]${description ? `: ${description}` : ''}`, actorId: req.user!.sub, actorName },
  });
  await audit(req, { action: 'EVIDENCE_UPLOADED', resourceType: 'REPORT', resourceId: String(id), detail: `${evidenceType} file=${row.fileName} size=${row.sizeBytes}` });
  if (isStaff && report.citizenId !== req.user!.sub) {
    await notify({ userId: report.citizenId, type: 'REPORT_UPDATED', title: 'New evidence added', message: `Government staff added evidence to your report ${report.reference}.`, reportId: id });
  }
  return ok(res, { evidence: { id: row.id, fileName: row.fileName, mimeType: row.mimeType, sizeBytes: row.sizeBytes, evidenceType, description, uploadedBy: actorName, uploadedAt: row.createdAt } }, 'Evidence attached', 201);
}

export async function listEvidenceTask3(req: Request, res: Response) {
  const id = Number(req.params.id);
  const report = await prisma.report.findUnique({ where: { id }, select: { id: true, citizenId: true } });
  if (!report) return notFound(res, 'Report not found');
  const isStaff = ['OFFICER', 'DISTRICT_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN', 'ANALYST'].includes(req.user!.role);
  if (!isStaff && report.citizenId !== req.user!.sub) {
    return fail(res, 'You do not have permission to view this evidence', 403);
  }
  const items = await prisma.evidence.findMany({ where: { reportId: id }, orderBy: { createdAt: 'asc' } });
  return ok(res, {
    evidence: items.map((e) => ({ id: e.id, fileName: e.fileName, mimeType: e.mimeType, sizeBytes: e.sizeBytes, uploadedAt: e.createdAt })),
  });
}

export async function downloadEvidenceTask3(req: Request, res: Response) {
  const id = Number(req.params.id);
  const evidenceId = Number(req.params.evidenceId);
  const report = await prisma.report.findUnique({ where: { id }, select: { citizenId: true } });
  const item = await prisma.evidence.findFirst({ where: { id: evidenceId, reportId: id } });
  if (!report || !item) return notFound(res, 'Evidence not found');
  const isStaff = ['OFFICER', 'DISTRICT_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN', 'ANALYST'].includes(req.user!.role);
  if (!isStaff && report.citizenId !== req.user!.sub) return fail(res, 'You do not have permission to download this evidence', 403);
  const filePath = path.join(uploadDir, item.storedName);
  if (!fs.existsSync(filePath)) return notFound(res, 'Evidence file is no longer available');
  return res.download(filePath, item.fileName);
}

// DELETE /api/v1/reports/:id/evidence/:evidenceId — uploader-role policy:
// citizens may remove their own evidence while the report is open;
// staff may remove any evidence on reports they can access.
export async function deleteEvidenceTask3(req: Request, res: Response) {
  const id = Number(req.params.id);
  const evidenceId = Number(req.params.evidenceId);
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(evidenceId) || evidenceId <= 0) return notFound(res, 'Evidence not found');
  const report = await prisma.report.findUnique({ where: { id }, select: { citizenId: true, status: true } });
  const item = await prisma.evidence.findFirst({ where: { id: evidenceId, reportId: id } });
  if (!report || !item) return notFound(res, 'Evidence not found');
  const isStaff = ['OFFICER', 'DISTRICT_ADMIN', 'NATIONAL_ADMIN', 'SYSTEM_ADMIN'].includes(req.user!.role);
  if (!isStaff) {
    if (report.citizenId !== req.user!.sub) return fail(res, 'You do not have permission to delete this evidence', 403);
    if (!['SUBMITTED', 'RECEIVED', 'UNDER_REVIEW', 'PENDING_VERIFICATION'].includes(report.status)) {
      return fail(res, 'Evidence can no longer be changed because review has started', 409);
  }
  }
  fs.unlink(path.join(uploadDir, item.storedName), () => undefined);
  await prisma.evidence.delete({ where: { id: item.id } });
  await prisma.reportStatusHistory.create({
    data: { reportId: id, fromStatus: report.status, toStatus: report.status, note: `Evidence removed: ${item.fileName}`, actorId: req.user!.sub, actorName: `${req.user!.firstName} ${req.user!.lastName}` },
  });
  await audit(req, { action: 'EVIDENCE_DELETED', resourceType: 'REPORT', resourceId: String(id), detail: `file=${item.fileName}` });
  return ok(res, null, 'Evidence deleted');
}
