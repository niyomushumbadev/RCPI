/**
 * Vercel serverless entry point for the R-CPI Express API.
 *
 * Vercel wraps this default export with its serverless adapter — no
 * app.listen() here (that is the job of backend/src/index.ts in dev).
 * The whole Express app (all /api/v1 routes) is served by this single
 * Vercel Function using Fluid compute, so warm invocations reuse the
 * Prisma client cached in backend/src/config/db.ts.
 */
import { createApp } from '../backend/src/app';

const app = createApp();

export default app;
