import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { redis } from '../config/redis';
import os from 'os';

const router = Router();

router.get('/health', async (req: Request, res: Response) => {
  const startTime = Date.now();

  const checks = {
    database: { healthy: false, latency: null as number | null, error: null as string | null },
    redis: { healthy: false, latency: null as number | null, error: null as string | null },
  };

  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    checks.database.healthy = true;
    checks.database.latency = Date.now() - dbStart;
  } catch (error) {
    checks.database.error = (error as Error).message;
  }

  try {
    const redisStart = Date.now();
    await redis.ping();
    checks.redis.healthy = true;
    checks.redis.latency = Date.now() - redisStart;
  } catch (error) {
    checks.redis.error = (error as Error).message;
  }

  const allHealthy = Object.values(checks).every((c) => c.healthy);

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    responseTime: Date.now() - startTime,
    services: checks,
    system: {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      memory: {
        total: Math.round(os.totalmem() / 1024 / 1024 / 1024) + 'GB',
        free: Math.round(os.freemem() / 1024 / 1024 / 1024) + 'GB',
      },
      loadAverage: os.loadavg(),
    },
  });
});

router.get('/health/live', (req: Request, res: Response) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});

router.get('/health/ready', async (req: Request, res: Response) => {
  try {
    await Promise.all([
      prisma.$queryRaw`SELECT 1`,
      redis.ping(),
    ]);

    res.json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      error: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;