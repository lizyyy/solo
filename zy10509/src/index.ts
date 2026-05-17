import express from 'express';
import fs from 'fs';
import path from 'path';
import operationRoutes from './routes/operations';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT || 3000;

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('数据目录已创建:', dataDir);
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: '运维操作双人确认API'
    }
  });
});

app.use('/api/operations', operationRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('        运维操作双人确认API 服务已启动');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  服务地址: http://localhost:${PORT}`);
  console.log(`  健康检查: http://localhost:${PORT}/health`);
  console.log(`  API 前缀: /api/operations`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  主要接口:');
  console.log('    POST   /api/operations              - 创建操作');
  console.log('    GET    /api/operations/query        - 查询操作列表');
  console.log('    GET    /api/operations/:id          - 获取操作详情');
  console.log('    POST   /api/operations/:id/confirm  - 双人确认');
  console.log('    POST   /api/operations/:id/lock     - 锁定操作');
  console.log('    POST   /api/operations/:id/start    - 开始执行');
  console.log('    POST   /api/operations/:id/complete - 完成操作');
  console.log('    POST   /api/operations/:id/fail     - 标记失败');
  console.log('    POST   /api/operations/:id/correct  - 人工修正');
  console.log('    GET    /api/operations/export/csv   - 导出CSV');
  console.log('    GET    /api/operations/statistics   - 获取统计');
  console.log('═══════════════════════════════════════════════════════════════');
});
