import express from 'express';
import bodyParser from 'body-parser';
import 'reflect-metadata';
import { initializeDatabase } from './database';
import { vulnerabilityRouter } from './routes/vulnerabilities';
import { batchRouter } from './routes/batches';
import { delayRouter } from './routes/delays';
import { riskRouter } from './routes/risks';
import { logger } from './logger';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  logger.info(`HTTP ${req.method} ${req.path}`, {
    query: req.query,
    body: Object.keys(req.body).length > 0 ? '***' : undefined
  });
  next();
});

app.use('/api/vulnerabilities', vulnerabilityRouter());
app.use('/api/batches', batchRouter());
app.use('/api/delays', delayRouter());
app.use('/api/risks', riskRouter());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({
    name: '依赖漏洞修复排期 API',
    version: '1.0.0',
    endpoints: {
      vulnerabilities: '/api/vulnerabilities',
      batches: '/api/batches',
      delays: '/api/delays',
      risks: '/api/risks'
    }
  });
});

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('未处理的异常', { error: err.message, stack: err.stack });
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

async function startServer() {
  try {
    await initializeDatabase();
    logger.info('数据库初始化成功');

    app.listen(PORT, () => {
      logger.info(`服务器启动成功，监听端口 ${PORT}`);
      logger.info(`健康检查: http://localhost:${PORT}/health`);
      logger.info(`API 根路径: http://localhost:${PORT}/api`);
    });
  } catch (error: any) {
    logger.error('服务器启动失败', { error: error.message });
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

export { app };
