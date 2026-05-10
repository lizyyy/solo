import express, { Request, Response } from 'express';
import { requestContextMiddleware } from './middleware/requestContext';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import { taskScheduler } from './services/taskScheduler';

import requisitionRoutes from './routes/requisitionRoutes';
import masterDataRoutes from './routes/masterDataRoutes';
import inventoryRoutes from './routes/inventoryRoutes';
import ledgerRoutes from './routes/ledgerRoutes';
import taskRoutes from './routes/taskRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(requestContextMiddleware);

app.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: 'UP',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    },
    timestamp: new Date(),
    requestId: req.requestId
  });
});

app.get('/api', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      name: '农药领用合规 API',
      version: '1.0.0',
      description: '解决农药领用绑定地块、作物和安全间隔期的合规管理问题',
      endpoints: {
        masterData: '/api/master-data',
        requisitions: '/api/requisitions',
        inventory: '/api/inventory',
        ledger: '/api/ledger',
        tasks: '/api/tasks'
      }
    },
    timestamp: new Date(),
    requestId: req.requestId
  });
});

app.use('/api/requisitions', requisitionRoutes);
app.use('/api/master-data', masterDataRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/ledger', ledgerRoutes);
app.use('/api/tasks', taskRoutes);

app.use('*', notFoundHandler);
app.use(errorHandler);

async function startServer(): Promise<void> {
  try {
    logger.info('Starting pesticide compliance API server...');
    
    taskScheduler.start();
    logger.info('Task scheduler started');

    app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(`API documentation: http://localhost:${PORT}/api`);
    });

    process.on('SIGTERM', () => {
      logger.info('SIGTERM signal received, shutting down gracefully...');
      taskScheduler.stop();
      process.exit(0);
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT signal received, shutting down gracefully...');
      taskScheduler.stop();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
}

startServer();

export default app;
