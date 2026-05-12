import app from './app';
import { config } from './config';
import { logger } from './utils/logger';
import { runMigrations } from './database/migrations';
import { asyncTaskService } from './services/async-task.service';

const startServer = async () => {
  try {
    logger.info('Starting event registration system...');

    await runMigrations();

    asyncTaskService.registerHandler({
      taskType: 'SEND_NOTIFICATION',
      handle: async (payload: Record<string, unknown>) => {
        logger.info('Sending notification', {
          to: payload.to,
          type: payload.type,
        });
        await new Promise((resolve) => setTimeout(resolve, 100));
        logger.info('Notification sent successfully', { to: payload.to });
      },
    });

    asyncTaskService.registerHandler({
      taskType: 'SYNC_CACHE',
      handle: async (payload: Record<string, unknown>) => {
        logger.info('Syncing cache', { eventId: payload.eventId });
        await new Promise((resolve) => setTimeout(resolve, 50));
        logger.info('Cache synced', { eventId: payload.eventId });
      },
    });

    asyncTaskService.start(1000);

    const server = app.listen(config.server.port, () => {
      logger.info(`Server is running on port ${config.server.port}`);
      logger.info(`Environment: ${config.server.env}`);
      logger.info('Async task service started with handlers: SEND_NOTIFICATION, SYNC_CACHE');
    });

    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      
      asyncTaskService.stop();
      
      server.close(async () => {
        logger.info('HTTP server closed');
        
        try {
          const { db } = await import('./database/client');
          await db.pool.end();
          logger.info('Database pool closed');
        } catch (error) {
          logger.error('Error during shutdown', { error: (error as Error).message });
        }
        
        process.exit(0);
      });

      setTimeout(() => {
        logger.error('Forcing shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection', {
        reason: reason instanceof Error ? reason.message : String(reason),
        promise: String(promise),
      });
    });

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', {
        error: error.message,
        stack: error.stack,
      });
      process.exit(1);
    });
  } catch (error) {
    logger.error('Failed to start server', { error: (error as Error).message });
    process.exit(1);
  }
};

startServer();
