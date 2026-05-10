import express from 'express';
import cors from 'cors';
import slopeRoutes from './routes/slopes';
import vehicleRoutes from './routes/vehicles';
import taskRoutes from './routes/tasks';
import reportRoutes from './routes/reports';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/slopes', slopeRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/reports', reportRoutes);

app.listen(PORT, () => {
  console.log(`滑雪场压雪排程台后端服务已启动: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
});
