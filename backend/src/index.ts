import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './config/db';
import { startDeadlineScheduler, stopDeadlineScheduler } from './services/deadline.service';

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`🇷🇼 R-CPI API running on http://localhost:${env.port} (${env.nodeEnv})`);
  startDeadlineScheduler(); // warns officers before deadlines lapse (§13)
});

async function shutdown(signal: string) {
  console.log(`\n${signal} received — shutting down gracefully...`);
  stopDeadlineScheduler();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
