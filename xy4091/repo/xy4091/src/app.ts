import express, { Express, Request, Response, NextFunction } from 'express';
import routes from './routes';
import { initDatabase } from './storage';
import { ApiResponse } from './types';

const app: Express = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Powered-By', '血袋临期调拨台');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

app.use('/api', routes);

app.use((err: Error, req: Request, res: Response<ApiResponse>, next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    timestamp: new Date().toISOString(),
  });
});

app.use('*', (req: Request, res: Response<ApiResponse>) => {
  res.status(404).json({
    success: false,
    error: `路由不存在: ${req.method} ${req.originalUrl}`,
    timestamp: new Date().toISOString(),
  });
});

export async function initApp(): Promise<Express> {
  await initDatabase();
  return app;
}

export default app;
