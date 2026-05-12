import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { initDatabase } from './models/database';
import { errorHandler } from './middleware/errorHandler';
import contractRoutes from './routes/contracts';
import refundRoutes from './routes/refunds';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/contracts', contractRoutes);
app.use('/api/refunds', refundRoutes);

app.get('/health', (req, res) => {
  res.json({ success: true, message: '服务运行正常' });
});

app.use(errorHandler);

const startServer = async () => {
  try {
    await initDatabase();
    console.log('数据库初始化完成');
    
    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('启动失败:', err);
    process.exit(1);
  }
};

startServer();
