import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { apiRateLimiter, notFoundHandler, errorHandler } from './middleware/security';
import authRoutes from './routes/authRoutes';
import citizenRoutes from './routes/citizenRoutes';
import reportRoutes from './routes/reportRoutes';
import workflowRoutes from './routes/workflowRoutes';
import adminRoutes from './routes/adminRoutes';
import { geoRouter, categoryRouter, departmentRouter, notificationRouter, alertRouter } from './routes/supportRoutes';
import aiRoutes from './routes/ai.routes';
import intelligenceRoutes from './routes/intelligence.routes';
import { prisma } from './config/db';
import * as citizenController from './controllers/citizenController';
import { runDeadlineScan } from './services/deadline.service';

export function createApp() {
  const app = express();

  // Security headers (Task 10 §87)
  app.use(helmet());

  // CORS: only trusted frontend origins (Task 10 §88).
  // FRONTEND_URL may list several origins (apex + www + Vercel preview URLs).
  app.use(
    cors({
      origin: (origin, cb) => {
        if (env.isAllowedOrigin(origin)) return cb(null, true);
        cb(new Error(`Origin not allowed by CORS: ${origin}`));
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.set('trust proxy', 1);

  const api = express.Router();

  // Versioned API surface
  api.use('/auth', authRoutes);
  api.use('/citizen', citizenRoutes);
  api.use('/reports', reportRoutes);
  api.use('/workflow', workflowRoutes);
  api.use('/admin', adminRoutes);
  api.use('/geo', geoRouter);
  api.use('/categories', categoryRouter);
  api.use('/departments', departmentRouter);
  api.use('/notifications', notificationRouter);
  api.use('/alerts', alertRouter);
  api.use('/ai', aiRoutes);
  api.use('/intelligence', intelligenceRoutes);
  // Public, privacy-filtered GIS reads do not require a citizen session.
  api.get('/map/problems', citizenController.getMapProblems);
  api.get('/map/nearby', citizenController.getNearbyProblems);
  api.get('/community/insights', citizenController.getCommunityInsights);

  // Vercel Cron Jobs hit this daily (see vercel.json). The in-process
  // setInterval scheduler in backend/src/index.ts only runs for long-lived
  // servers (npm start / local dev), so serverless deployments rely on cron
  // instead. Protected by a shared secret — Vercel sends it as a Bearer token
  // from the CRON_SECRET environment variable.
  api.get('/cron/deadline-scan', async (req, res) => {
    const expected = process.env.CRON_SECRET;
    if (!expected || req.headers.authorization !== `Bearer ${expected}`) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    try {
      const result = await runDeadlineScan();
      return res.json({ success: true, message: 'Deadline scan complete', data: result });
    } catch (err) {
      console.error('[cron/deadline-scan] failed:', err);
      return res.status(500).json({ success: false, message: 'Deadline scan failed' });
    }
  });

  api.get('/health', (_req, res) => {
    res.json({ success: true, message: 'R-CPI API is running', data: { uptime: process.uptime() } });
  });
  api.get('/health/ready', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ success: true, message: 'R-CPI API and database are ready', data: { uptime: process.uptime(), node: process.version } });
    } catch {
      res.status(503).json({ success: false, message: 'Database is not ready', data: null });
    }
  });

  app.use('/api/v1', apiRateLimiter, api);

  // Also expose unversioned health for infra checks
  app.get('/health', (_req, res) => {
    res.json({ success: true, message: 'R-CPI API is running' });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
