import express from 'express';
import { initializeDb } from './database';
import refundRoutes from './routes/refundRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/v1/refunds', refundRoutes);

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
  });
});

async function startServer(): Promise<void> {
  try {
    await initializeDb();
    console.log('数据库初始化完成');
    
    app.listen(PORT, () => {
      console.log(`充电中断退款 API 服务运行在 http://localhost:${PORT}`);
      console.log(`健康检查: http://localhost:${PORT}/health`);
      console.log('API 路径: /api/v1/refunds/*');
    });
  } catch (error) {
    console.error('服务启动失败:', error);
    process.exit(1);
  }
}

startServer();

export default app;
