import express from 'express';
import cors from 'cors';
import { initDatabase } from './db';

import receiptsRouter from './routes/receipts';
import employeesRouter from './routes/employees';
import merchantsRouter from './routes/merchants';
import settlementsRouter from './routes/settlements';
import appealsRouter from './routes/appeals';
import exportRouter from './routes/export';
import statsRouter from './routes/stats';

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

initDatabase();

app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: '企业用餐补贴核销台服务运行正常',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/receipts', receiptsRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/merchants', merchantsRouter);
app.use('/api/settlements', settlementsRouter);
app.use('/api/appeals', appealsRouter);
app.use('/api/export', exportRouter);
app.use('/api/stats', statsRouter);

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: err.message
  });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  企业用餐补贴核销台 - 后端服务`);
  console.log(`  运行端口: ${PORT}`);
  console.log(`  服务地址: http://localhost:${PORT}`);
  console.log(`========================================\n`);
  console.log('可用API端点:');
  console.log('  GET  /api/health          - 健康检查');
  console.log('  GET  /api/receipts        - 小票列表');
  console.log('  POST /api/receipts        - 上传小票');
  console.log('  GET  /api/receipts/:id    - 小票详情');
  console.log('  GET  /api/employees       - 员工列表');
  console.log('  GET  /api/merchants       - 商户列表');
  console.log('  GET  /api/settlements     - 结算单列表');
  console.log('  POST /api/settlements/generate  - 生成结算单');
  console.log('  GET  /api/appeals         - 申诉列表');
  console.log('  POST /api/appeals         - 提交申诉');
  console.log('  GET  /api/stats/overview  - 统计概览');
  console.log('  GET  /api/export/receipts - 导出小票Excel');
  console.log('');
});
