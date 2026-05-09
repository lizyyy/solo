import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { env } from './config/env';
import { logger } from './utils/logger';
import { requestContextMiddleware } from './middleware/requestContext';
import { errorHandlerMiddleware } from './middleware/errorHandler';
import taskRoutes from './routes/taskRoutes';
import healthRoutes from './routes/healthRoutes';
import { wsService } from './services/WebSocketService';

const app = express();
const httpServer = createServer(app);

app.use(helmet());
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: env.nodeEnv === 'production' ? 100 : 1000,
  message: {
    error: 'TOO_MANY_REQUESTS',
    message: 'Too many requests, please try again later',
  },
});
app.use(limiter);

app.use(requestContextMiddleware);

app.use('/api', healthRoutes);
app.use('/api/tasks', taskRoutes);

app.use((req, res) => {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: `Route not found: ${req.method} ${req.path}`,
  });
});

app.use(errorHandlerMiddleware);

wsService.init(httpServer);

const shutdown = async () => {
  logger.info('Shutting down gracefully...');

  try {
    httpServer.close();
    logger.info('HTTP server closed');
  } catch (error) {
    logger.error('Error closing HTTP server', { error: (error as Error).message });
  }

  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

httpServer.listen(env.port, () => {
  logger.info(`Server is running on port ${env.port}`);
  logger.info(`Environment: ${env.nodeEnv}`);
  logger.info(`Health check: http://localhost:${env.port}/api/health`);
});

export { app, httpServer };