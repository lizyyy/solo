import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';

import importRoutes from './routes/importRoutes';
import billingRoutes from './routes/billingRoutes';
import reviewRoutes from './routes/reviewRoutes';
import reportRoutes from './routes/reportRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req: Request, res: Response) => {
  res.json({ success: true, message: '冷库园区对账服务运行正常' });
});

app.use('/api/import', importRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/review', reviewRoutes);
app.use('/api/report', reportRoutes);

app.use((req: Request, res: Response) => {
  res.status(404).json({ success: false, error: '接口不存在' });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`冷库园区对账服务已启动，端口: ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`API 文档:`);
  console.log(`  POST /api/import/meter - 上传电表CSV`);
  console.log(`  POST /api/import/contract - 上传合同JSON`);
  console.log(`  POST /api/billing/calculate - 计算账单`);
  console.log(`  GET  /api/billing/records - 查询账单列表`);
  console.log(`  POST /api/review/records/:id/approve - 审批通过`);
  console.log(`  POST /api/review/records/:id/reject - 审批驳回`);
  console.log(`  GET  /api/report/excel - 下载Excel报告`);
  console.log(`  GET  /api/report/pdf - 下载PDF报告`);
  console.log(`  GET  /api/report/records/:id/html - 查看账单详情HTML`);
});
