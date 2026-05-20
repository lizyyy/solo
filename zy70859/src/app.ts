import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { initDatabase } from './database';
import { DocumentService } from './services';
import { createRoutes } from './routes';

const PORT = process.env.PORT || 3000;

async function startServer() {
  const app = express();

  app.use(cors());
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  const db = await initDatabase();
  const service = new DocumentService(db);
  const routes = createRoutes(service);

  app.use('/api', routes);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', message: '法院卷宗借阅归还 API 服务运行正常' });
  });

  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log('API 文档:');
    console.log('  POST /api/batches - 创建批次');
    console.log('  GET  /api/batches - 获取所有批次');
    console.log('  GET  /api/batches/:batchId - 获取批次详情');
    console.log('  GET  /api/batches/:batchId/materials - 获取批次下的材料');
    console.log('  POST /api/batches/:batchId/materials - 登记材料');
    console.log('  POST /api/batches/:batchId/recalculate - 触发批次重算');
    console.log('  GET  /api/materials/:materialId - 获取材料详情');
    console.log('  GET  /api/materials/:materialId/trail - 获取材料完整追溯信息');
    console.log('  GET  /api/materials/:materialId/processing-trails - 获取处理轨迹');
    console.log('  GET  /api/materials/:materialId/audit-logs - 获取审计日志');
    console.log('  PATCH /api/materials/:materialId/status - 修改材料状态');
    console.log('  GET  /api/statistics - 获取统计数据');
  });
}

startServer().catch(console.error);
