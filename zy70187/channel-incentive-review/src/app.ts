import express, { Express } from 'express';
import { authMiddleware, errorHandler, requestLogger } from './middleware/auth';
import apiRoutes from './routes/api';

export function createApp(): Express {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(requestLogger);
  app.use(authMiddleware);
  app.use('/api', apiRoutes);
  app.use(errorHandler);

  return app;
}
