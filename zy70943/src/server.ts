import express from 'express';
import cors from 'cors';
import { PORT } from './config/constants';
import authRouter from './routes/auth';
import batchesRouter from './routes/batches';
import materialsRouter from './routes/materials';
import deductionDetailsRouter from './routes/deduction-details';
import archiveRouter from './routes/archive';
import auditRouter from './routes/audit';
import exportRouter from './routes/export';

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/api/auth', authRouter);
app.use('/api/batches', batchesRouter);
app.use('/api/materials', materialsRouter);
app.use('/api/deduction-details', deductionDetailsRouter);
app.use('/api/archive', archiveRouter);
app.use('/api/audit', auditRouter);
app.use('/api/export', exportRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Math.floor(Date.now() / 1000) });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || '服务器内部错误',
  });
});

app.listen(PORT, () => {
  console.log(`物流干线异常扣罚 API 服务已启动，端口: ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
  console.log(`默认账号: admin / 123456`);
});

export default app;
