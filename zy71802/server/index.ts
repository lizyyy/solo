import express from 'express';
import cors from 'cors';
import recordsRouter from './routes/records';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/records', recordsRouter);

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`API 文档:`);
  console.log(`  GET    /api/records              - 查询记录列表`);
  console.log(`  GET    /api/records/stats        - 获取统计信息`);
  console.log(`  GET    /api/records/:id          - 获取记录详情`);
  console.log(`  POST   /api/records              - 创建记录`);
  console.log(`  PUT    /api/records/:id          - 更新记录`);
  console.log(`  POST   /api/records/:id/withdraw - 撤回记录`);
  console.log(`  POST   /api/records/:id/approve  - 通过记录`);
  console.log(`  POST   /api/records/:id/reject   - 驳回记录`);
  console.log(`  POST   /api/records/import       - 批量导入`);
  console.log(`  GET    /api/records/export/csv   - 导出CSV`);
  console.log(`  GET    /api/records/export/review-list - 导出复核清单`);
});
