import express from 'express';
import cors from 'cors';
import recordsRouter from './routes/records';
import storesRouter from './routes/stores';
import deductionItemsRouter from './routes/deduction-items';
import photosRouter from './routes/photos';
import reportsRouter from './routes/reports';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.use('/api/records', recordsRouter);
app.use('/api/stores', storesRouter);
app.use('/api/deduction-items', deductionItemsRouter);
app.use('/api/photos', photosRouter);
app.use('/api/reports', reportsRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '茶饮加盟巡店扣分系统 API 运行正常' });
});

app.listen(PORT, () => {
  console.log(`🚀 后端 API 服务器运行在 http://localhost:${PORT}`);
  console.log(`📋 健康检查: http://localhost:${PORT}/api/health`);
});
