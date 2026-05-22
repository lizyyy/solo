import express from 'express';
import fs from 'fs';
import path from 'path';
import { getDbConnection, closeDbConnection } from './database/connection';
import { startTaskExecutor, stopTaskExecutor, runRecovery } from './services/taskExecutor';
import importRoutes from './routes/import';
import taskRoutes from './routes/tasks';
import exportRoutes from './routes/export';
import anomalyRoutes from './routes/anomalies';

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.use('/api/import', importRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/anomalies', anomalyRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({
    name: '连锁茶饮原料验收回放链路 API',
    version: '1.0.0',
    endpoints: {
      import: '/api/import',
      tasks: '/api/tasks',
      export: '/api/export',
      anomalies: '/api/anomalies',
      health: '/health'
    }
  });
});

const server = app.listen(PORT, async () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║          连锁茶饮原料验收回放链路 API 服务已启动               ║
╠══════════════════════════════════════════════════════════════╣
║  服务地址: http://localhost:${PORT}                            ║
║  健康检查: http://localhost:${PORT}/health                     ║
║  API 文档: http://localhost:${PORT}/                           ║
╠══════════════════════════════════════════════════════════════╣
║  Authorization: Bearer tea-chain-verification-2024           ║
║  角色设置: X-User-Role (admin/operator/viewer)                ║
╚══════════════════════════════════════════════════════════════╝
  `);

  getDbConnection();
  await runRecovery();
  startTaskExecutor();
});

const gracefulShutdown = () => {
  console.log('\n正在优雅关闭服务...');
  stopTaskExecutor();
  server.close(() => {
    console.log('HTTP 服务已关闭');
    closeDbConnection();
    process.exit(0);
  });

  setTimeout(() => {
    console.error('强制关闭');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
