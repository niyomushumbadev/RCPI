import { PrismaClient } from '@prisma/client';

// ─────────────────────────────────────────────────────────────
// Prisma singleton — required for Vercel serverless.
// Without this, every invocation creates a new pool and quickly
// exhausts hosted Postgres/MySQL connection limits.
// ─────────────────────────────────────────────────────────────
const globalForPrisma = globalThis as unknown as { __rcpiPrisma?: PrismaClient };

export const prisma =
  globalForPrisma.__rcpiPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.__rcpiPrisma = prisma;
// Always cache in production too (serverless reuse across warm invocations).
globalForPrisma.__rcpiPrisma = prisma;

