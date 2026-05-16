import express from 'express';
import bodyParser from 'body-parser';
import groupingRoutes from './routes/groupingRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/grouping', groupingRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`灰度租户分组API服务已启动，端口: ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`API基础路径: http://localhost:${PORT}/api/grouping`);
});

export default app;
