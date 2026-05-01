import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import buildingsRouter from './routes/buildings.js';
import workersRouter from './routes/workers.js';
import devicesRouter from './routes/devices.js';
import templatesRouter from './routes/templates.js';
import patrolTasksRouter from './routes/patrolTasks.js';
import repairOrdersRouter from './routes/repairOrders.js';
import dashboardRouter from './routes/dashboard.js';

const app = express();
const PORT = process.env.PORT || 3001;

export const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

app.use('/api/buildings', buildingsRouter);
app.use('/api/workers', workersRouter);
app.use('/api/devices', devicesRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/patrol-tasks', patrolTasksRouter);
app.use('/api/repair-orders', repairOrdersRouter);
app.use('/api/dashboard', dashboardRouter);

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: '巡修排班台 API 服务运行正常'
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: '服务器内部错误',
    message: err.message 
  });
});

async function startServer() {
  try {
    await prisma.$connect();
    console.log('数据库连接成功');
    
    app.listen(PORT, () => {
      console.log(`巡修排班台 API 服务已启动`);
      console.log(`服务地址: http://localhost:${PORT}`);
      console.log(`API 文档: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

startServer();

process.on('SIGTERM', async () => {
  console.log('收到 SIGTERM 信号，正在关闭...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('收到 SIGINT 信号，正在关闭...');
  await prisma.$disconnect();
  process.exit(0);
});
