import express from 'express';
import batteryRoutes from './routes/batteryRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', batteryRoutes);

app.listen(PORT, () => {
  console.log(`换电柜电池流转 API 服务启动在 http://localhost:${PORT}`);
  console.log('健康检查: GET http://localhost:3000/health');
});
