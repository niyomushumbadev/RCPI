import type { NextFunction, Request, Response } from 'express';

/** Uniform API response: { success, message, data } */
export function ok(res: Response, data: unknown = null, message = 'Success', status = 200) {
  return res.status(status).json({ success: true, message, data });
}

export function fail(res: Response, message = 'Something went wrong', status = 400, data: unknown = null) {
  return res.status(status).json({ success: false, message, data });
}

/** 404 with no leakage of whether a resource exists */
export function notFound(res: Response, message = 'Resource not found') {
  return fail(res, message, 404);
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/** Generate report reference: RCP-2026-000245 */
export function generateReportReference(id: number): string {
  const year = new Date().getFullYear();
  return `RCP-${year}-${String(id).padStart(6, '0')}`;
}

/** Error responses never leak stack traces to citizens (Task 10 §86) */
export function safeErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message.startsWith('HTTP:')) {
    return err.message.replace('HTTP:', '').trim();
  }
  return 'Something went wrong. Please try again.';
}
