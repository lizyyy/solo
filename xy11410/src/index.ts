import 'reflect-metadata';
import express from 'express';
import { AppDataSource } from './data-source';
import receiptRoutes from './routes/receiptRoutes';
import batchRoutes from './routes/batchRoutes';
import basicDataRoutes from './routes/basicDataRoutes';
import reportRoutes from './routes/reportRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/receipts', receiptRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/basic-data', basicDataRoutes);
app.use('/api/reports', reportRoutes);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: '连锁茶饮原料异常回执状态机 API 运行正常'
  });
});

AppDataSource.initialize()
  .then(() => {
    console.log('数据库连接成功');
    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
      console.log(`健康检查: http://localhost:${PORT}/health`);
    });
  })
  .catch((error) => {
    console.error('数据库连接失败:', error);
    process.exit(1);
  });
