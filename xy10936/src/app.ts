import express from 'express';
import { initDatabase } from './database/init';
import customersRouter from './routes/customers';
import categoriesRouter from './routes/categories';
import weighingRouter from './routes/weighing';
import settlementRouter from './routes/settlement';
import exceptionsRouter from './routes/exceptions';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.use('/api/customers', customersRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/weighing', weighingRouter);
app.use('/api/settlement', settlementRouter);
app.use('/api/exceptions', exceptionsRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '废品回收称重 API 服务运行正常' });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('服务器错误:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

export const startServer = async () => {
  try {
    await initDatabase();
    console.log('数据库初始化完成');
    
    app.listen(PORT, () => {
      console.log(`\n========================================`);
      console.log(`  废品回收称重 API 服务已启动`);
      console.log(`  运行端口: ${PORT}`);
      console.log(`  健康检查: http://localhost:${PORT}/api/health`);
      console.log(`========================================\n`);
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
};

export default app;
