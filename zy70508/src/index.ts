import express from 'express';
import canaryRoutes from './routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'schema-canary-api',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/v1', canaryRoutes);

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

app.listen(PORT, () => {
  console.log(`Schema灰度发布API已启动: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`API文档: GET http://localhost:${PORT}/api/v1/meta/statuses`);
});

export default app;