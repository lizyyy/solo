import express from 'express';
import cors from 'cors';
import { initDatabaseConnection, initDatabaseTables } from './database';
import { createDemoData } from './services/demoData';
import tiresRouter from './routes/tires';
import vehiclesRouter from './routes/vehicles';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// 初始化数据库连接和表结构
initDatabaseConnection();
initDatabaseTables();

// 创建演示数据
createDemoData();

// 注册路由
app.use('/api/tires', tiresRouter);
app.use('/api/vehicles', vehiclesRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '轮胎翻新管理系统 API 运行正常' });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`API 文档: http://localhost:${PORT}/api/health`);
});
