import express from 'express';
import cors from 'cors';
import { connectDatabase } from './config/database';
import leadsRoutes from './routes/leads';
import salesRoutes from './routes/sales';
import rulesRoutes from './routes/rules';
import exportRoutes from './routes/export';
import dashboardRoutes from './routes/dashboard';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: '线上展会线索分配台 API 服务正常运行' });
});

app.use('/api/leads', leadsRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/rules', rulesRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: 'API 接口不存在' });
});

app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('服务器错误:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

async function startServer() {
  try {
    await connectDatabase();
    
    app.listen(PORT, () => {
      console.log(`========================================`);
      console.log(`线上展会线索分配台 - 后端服务`);
      console.log(`========================================`);
      console.log(`服务地址: http://localhost:${PORT}`);
      console.log(`健康检查: http://localhost:${PORT}/api/health`);
      console.log(`========================================`);
    });
  } catch (error) {
    console.error('启动服务器失败:', error);
    process.exit(1);
  }
}

startServer();
