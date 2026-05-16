import express from 'express';
import { initDatabase } from './database';
import { DatabaseService } from './services/databaseService';
import { createRouter } from './routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: '账单重算API服务运行正常' });
});

const startServer = async (): Promise<void> => {
  try {
    const db = await initDatabase();
    const dbService = new DatabaseService(db);
    
    const router = createRouter(dbService);
    app.use('/api/v1', router);

    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
      console.log(`健康检查: http://localhost:${PORT}/health`);
      console.log(`API文档: POST /api/v1/applications - 创建申请`);
      console.log(`         GET  /api/v1/applications - 查询列表`);
      console.log(`         GET  /api/v1/applications/:id - 查询详情`);
      console.log(`         PUT  /api/v1/applications/:id/status - 更新状态`);
      console.log(`         GET  /api/v1/applications/:id/approval-history - 审批历史`);
      console.log(`         GET  /api/v1/applications/:id/snapshots - 快照记录`);
      console.log(`         POST /api/v1/applications/:id/fail - 标记失败`);
      console.log(`         POST /api/v1/applications/:id/manual-correction - 人工修正`);
      console.log(`         POST /api/v1/applications/:id/complete - 完成申请`);
      console.log(`         GET  /api/v1/export - 导出CSV`);
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
};

startServer();