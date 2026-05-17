import express from 'express';
import fs from 'fs';
import path from 'path';
import { initDatabase } from './database/schema';
import { createBatchRouter } from './routes/batch.routes';
import { createReceiptRouter } from './routes/receipt.routes';
import { createResendRouter } from './routes/resend.routes';
import { createExportRouter } from './routes/export.routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const startServer = async () => {
  try {
    const db = await initDatabase();
    console.log('数据库初始化完成');

    app.use('/api/batches', createBatchRouter(db));
    app.use('/api/receipts', createReceiptRouter(db));
    app.use('/api/resends', createResendRouter(db));
    app.use('/api/exports', createExportRouter(db));

    app.get('/health', (_req, res) => {
      res.json({ status: 'ok', timestamp: Date.now() });
    });

    app.listen(PORT, () => {
      console.log(`批量通知回执API服务已启动，端口: ${PORT}`);
      console.log(`API文档:
  - POST   /api/batches           - 创建通知批次
  - POST   /api/batches/:id/start - 启动批次发送
  - GET    /api/batches           - 获取批次列表
  - GET    /api/batches/:id       - 获取批次详情
  
  - GET    /api/receipts          - 查询回执列表 (支持 batchId, tenantId, status, channel, page, pageSize)
  - GET    /api/receipts/:id      - 获取回执详情
  - GET    /api/receipts/:id/trace - 获取回执追踪链路
  - POST   /api/receipts/:id/confirm - 确认回执
  - POST   /api/receipts/:id/delivered - 标记送达
  - POST   /api/receipts/:id/failed - 标记失败
  - POST   /api/receipts/batch/:id/process-timeout - 处理超时
  - POST   /api/receipts/:id/manual-correct - 人工修正
  
  - POST   /api/resends           - 创建补发
  - GET    /api/resends/pending   - 获取待补发列表
  - GET    /api/resends/batch/:id - 获取批次补发记录
  
  - GET    /api/exports/summary/:id - 导出统计CSV
  - GET    /api/exports/receipts/:id - 导出回执CSV
  - POST   /api/exports/summary/:id/generate - 生成触达统计
      `);
    });
  } catch (err) {
    console.error('服务启动失败:', err);
    process.exit(1);
  }
};

startServer();
