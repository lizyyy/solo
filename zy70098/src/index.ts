import express from 'express';
import { DatabaseService } from './database/database';
import { createRoutes } from './api/routes';

async function main() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  const db = await DatabaseService.create('./data/app.db');

  app.use(express.json());

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'demand-response-invitation-service'
    });
  });

  app.use('/api', createRoutes(db));

  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '服务器内部错误',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      }
    });
  });

  const server = app.listen(PORT, () => {
    console.log(`
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   需求响应邀约服务已启动                                      │
│   服务端口: ${PORT}                                          │
│   健康检查: http://localhost:${PORT}/health                  │
│   API 根路径: http://localhost:${PORT}/api                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
    `);
  });

  process.on('SIGTERM', () => {
    console.log('收到 SIGTERM 信号，正在关闭...');
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('收到 SIGINT 信号，正在关闭...');
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
}

main().catch(err => {
  console.error('服务启动失败:', err);
  process.exit(1);
});
