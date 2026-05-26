import express, { Application, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { initDatabase } from './database';
import importRoutes from './routes/import';
import reconciliationRoutes from './routes/reconciliation';
import reportRoutes from './routes/report';
import retestRuleRoutes from './routes/retest-rules';

const app: Application = express();
const PORT = process.env.PORT || 3000;

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const outputDir = path.join(__dirname, '../output');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req: Request, _res: Response, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'inspection-reconciliation-service',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/import', importRoutes);
app.use('/api/reconciliations', reconciliationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/retest-rules', retestRuleRoutes);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'API端点不存在' });
});

app.use((err: Error, _req: Request, res: Response) => {
  console.error('服务器错误:', err);
  res.status(500).json({ error: err.message || '服务器内部错误' });
});

async function startServer() {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`\n检测站对账服务已启动`);
      console.log(`服务地址: http://localhost:${PORT}`);
      console.log(`健康检查: http://localhost:${PORT}/api/health`);
      console.log(`\nAPI文档:`);
      console.log(`  POST /api/import/csv          - 导入样品CSV`);
      console.log(`  POST /api/import/json         - 导入检测项目JSON`);
      console.log(`  GET  /api/import              - 获取导入记录列表`);
      console.log(`  POST /api/reconciliations     - 创建对账会话`);
      console.log(`  POST /api/reconciliations/:id/start    - 执行自动比对`);
      console.log(`  GET  /api/reconciliations/:id/discrepancies - 获取差异列表(带解释)`);
      console.log(`  POST /api/reconciliations/:id/review   - 人工复核样品`);
      console.log(`  GET  /api/reconciliations/:id/decision-support/:sampleNo - 获取决策支持`);
      console.log(`  GET  /api/reports/:id/html    - 导出HTML报告`);
      console.log(`  GET  /api/reports/:id/excel   - 导出Excel报告`);
      console.log(`  GET  /api/reports/:id/csv     - 导出CSV报告`);
      console.log(`\n使用前请先运行: npm run seed  (导入示例数据)`);
      console.log(`测试完整流程: npm test`);
    });
  } catch (err) {
    console.error('启动服务器失败:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

export default app;
