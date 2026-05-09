import express, { Application, Request, Response } from 'express';
import replacementRoutes from './routes/replacement';

export function createApp(): Application {
  const app = express();

  app.use(express.json());

  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'card-replacement-service',
      version: '1.0.0',
      timestamp: Date.now()
    });
  });

  app.use('/api/replacement', replacementRoutes);

  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: '请求的资源不存在'
      },
      timestamp: Date.now()
    });
  });

  return app;
}
