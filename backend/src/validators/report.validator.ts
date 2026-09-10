// ─────────────────────────────────────────────────────────────
// R-CPI Task 3 — Validators (ADDITIVE, spec §60)
// Pure zod schemas. Does NOT modify existing controllers.
// Spec §44 expects: src/validators/report.validator.ts
// ─────────────────────────────────────────────────────────────
import { z } from 'zod';

export const createReportSchema = z.object({
  title: z.string().trim().min(5, 'Title is too short').max(200),
  description: z.string().trim().min(10, 'Description is too short').max(5000),
  categoryId: z.coerce.number().int().positive(),
  provinceId: z.coerce.number().int().positive().optional(),
  districtId: z.coerce.number().int().positive(),
  sectorId: z.coerce.number().int().positive().optional(),
  cellId: z.coerce.number().int().positive().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  locationDescription: z.string().max(300).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  urgency: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
});

export const editReportSchema = z.object({
  // Citizen-editable only (§14). Official fields rejected here.
  title: z.string().trim().min(5).max(200).optional(),
  description: z.string().trim().min(10).max(5000).optional(),
  sectorId: z.coerce.number().int().positive().optional(),
  cellId: z.coerce.number().int().positive().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  locationDescription: z.string().max(300).optional(),
}).strict();

export const verifySchema = z.object({
  verified: z.boolean().optional(),
  comment: z.string().max(500).optional(),
});

export const rejectSchema = z.object({
  reason: z.string().trim().min(5, 'Rejection reason is required').max(500),
});

export const assignSchema = z.object({
  assignedTo: z.coerce.number().int().positive(),
  departmentId: z.coerce.number().int().positive().optional(),
  reason: z.string().max(500).optional(),
});

export const statusSchema = z.object({
  status: z.string().trim().min(1),
  reason: z.string().max(500).optional(),
});

export const deadlineSchema = z.object({
  deadline: z.string().datetime({ offset: true }).or(z.string().min(10)),
  reason: z.string().max(500).optional(),
});

export const resolveSchema = z.object({
  resolution: z.string().trim().min(10, 'Resolution description is required').max(2000),
  evidenceId: z.coerce.number().int().positive().optional(),
});

export const closeSchema = z.object({
  note: z.string().max(500).optional(),
});

export const reopenSchema = z.object({
  reason: z.string().trim().min(5, 'Reopening reason is required').max(500),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;
