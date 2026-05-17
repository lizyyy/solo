import express from 'express';
import queueRoutes from './routes/queueRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api/queue', queueRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`在线客服路由技能组溢出排队服务已启动，端口: ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`API文档: POST /api/queue - 创建排队记录`);
  console.log(`        GET  /api/queue - 查询排队记录列表`);
  console.log(`        GET  /api/queue/:id - 查询单条记录`);
  console.log(`        GET  /api/queue/:id/history - 查询状态历史`);
});

export default app;