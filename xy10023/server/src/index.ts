import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import logger from './utils/logger';
import { testConnection, sequelize } from './database';
import redisService from './services/redis.service';
import taskQueueService from './services/taskQueue.service';
import idempotencyMiddleware from './middlewares/idempotency.middleware';

import authRoutes from './routes/auth.routes';
import ticketsRoutes from './routes/tickets.routes';
import followupsRoutes from './routes/followups.routes';
import exportsRoutes from './routes/exports.routes';
import './models';

const app = express();

app.use(helmet());
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim()),
  },
}));

const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests, please try again later.',
  },
});
app.use(limiter);

app.use(idempotencyMiddleware);

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: config.server.nodeEnv,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/followups', followupsRoutes);
app.use('/api/exports', exportsRoutes);

app.use((req, res) => {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: 'Route not found',
  });
});

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
  });
});

async function startServer(): Promise<void> {
  try {
    logger.info('Starting Customer Follow-up System...');
    logger.info(`Environment: ${config.server.nodeEnv}`);

    await testConnection();
    logger.info('Database connection established');

    await sequelize.sync({ alter: config.server.nodeEnv === 'development' });
    logger.info('Database models synchronized');

    await redisService.connect();
    logger.info('Redis connection established');

    taskQueueService.processQueue('default');
    taskQueueService.processQueue('notifications');
    taskQueueService.processQueue('exports');
    taskQueueService.processQueue('followup-reminders');
    taskQueueService.processQueue('compensation');
    logger.info('Task queues initialized');

    const server = app.listen(config.server.port, () => {
      logger.info(`Server running on port ${config.server.port}`);
      logger.info('Customer Follow-up System started successfully!');
    });

    const gracefulShutdown = async () => {
      logger.info('Received shutdown signal, shutting down gracefully...');

      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          await taskQueueService.shutdown();
          logger.info('Task queues shutdown complete');

          await redisService.disconnect();
          logger.info('Redis disconnected');

          await sequelize.close();
          logger.info('Database connection closed');

          logger.info('Graceful shutdown complete');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown:', error);
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;
