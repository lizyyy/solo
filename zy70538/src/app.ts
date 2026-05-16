import express from 'express';
import cacheExplanationRoutes from './routes/cacheExplanationRoutes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API结果缓存解释服务运行正常',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.use('/api/v1/cache-explanations', cacheExplanationRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`
=============================================
  API结果缓存解释服务已启动
  端口: ${PORT}
  环境: ${process.env.NODE_ENV || 'development'}
  健康检查: http://localhost:${PORT}/health
=============================================
  `);
});

export default app;
