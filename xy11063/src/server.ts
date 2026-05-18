import express from 'express';
import repairRoutes from './routes/repairRoutes';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: '物业报修中心',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/repairs', repairRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`物业报修中心服务已启动在端口 ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`API 地址: http://localhost:${PORT}/api/repairs`);
});

export default app;
