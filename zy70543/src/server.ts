import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import contractRoutes from './routes/contract';

const app = express();
const PORT = process.env.PORT || 3000;

const dataDir = path.join(__dirname, '../data');
const exportsDir = path.join(__dirname, '../exports');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(exportsDir)) {
  fs.mkdirSync(exportsDir, { recursive: true });
}

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/contract', contractRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    message: err instanceof Error ? err.message : '未知错误'
  });
});

app.listen(PORT, () => {
  console.log(`回调契约验签API服务已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`API文档:`);
  console.log(`  POST /api/contract/suppliers     - 创建供应商`);
  console.log(`  POST /api/contract/contracts      - 创建契约版本`);
  console.log(`  POST /api/contract/samples      - 提交回调样例并自动验签`);
  console.log(`  GET  /api/contract/conclusions  - 查询验收结论列表`);
  console.log(`  GET  /api/contract/conclusions/:id - 查询单个结论详情`);
  console.log(`  GET  /api/contract/conclusions/:id/trace - 获取异常追溯信息`);
  console.log(`  PUT  /api/contract/conclusions/:id/status - 推进状态`);
  console.log(`  POST /api/contract/conclusions/:id/correct - 人工修正`);
  console.log(`  POST /api/contract/export        - 导出CSV`);
});

export default app;
