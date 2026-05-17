import express from 'express';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { initializeDatabase } from './database/schema';
import adjustmentRoutes from './routes/adjustmentRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

const EXPORT_DIR = join(process.cwd(), 'exports');
if (!existsSync(EXPORT_DIR)) {
  mkdirSync(EXPORT_DIR, { recursive: true });
}

app.use(express.json());

app.use('/api/adjustments', adjustmentRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function startServer() {
  try {
    await initializeDatabase();
    console.log('数据库初始化完成');
    
    app.listen(PORT, () => {
      console.log(`队列优先级调整API服务已启动，端口: ${PORT}`);
      console.log('API文档:');
      console.log('  POST   /api/adjustments              - 创建优先级调整');
      console.log('  GET    /api/adjustments              - 查询所有调整');
      console.log('  GET    /api/adjustments/:id          - 查询单个调整详情');
      console.log('  GET    /api/adjustments/:id/tasks    - 查询影响的任务');
      console.log('  GET    /api/adjustments/:id/failures - 查询异常记录');
      console.log('  POST   /api/adjustments/:id/activate - 激活调整');
      console.log('  POST   /api/adjustments/:id/recover  - 执行恢复操作');
      console.log('  PATCH  /api/adjustments/:id/correct  - 人工修正');
      console.log('  POST   /api/adjustments/:id/cancel   - 取消调整');
      console.log('  GET    /api/adjustments/:id/export/csv    - 导出CSV');
      console.log('  GET    /api/adjustments/:id/export/report  - 导出报告');
      console.log('  GET    /api/adjustments/queues/:name/priority - 查询队列当前优先级');
    });
  } catch (error) {
    console.error('服务启动失败:', error);
    process.exit(1);
  }
}

startServer();
