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

export function createApp() {
  const app = express();

  // Security headers (Task 10 §87)
  app.use(helmet());

  // CORS: only the trusted frontend origin (Task 10 §88)
  app.use(
    cors({
      origin: env.frontendUrl,
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
