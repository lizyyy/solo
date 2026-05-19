import 'reflect-metadata';
import express from 'express';
import { AppDataSource } from './database/data-source';
import criticalValueRouter from './controllers/criticalValueController';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/critical-value', criticalValueRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '急诊检验危急值回告API服务运行正常' });
});

async function startServer() {
  try {
    await AppDataSource.initialize();
    console.log('数据库连接成功');

    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
      console.log('健康检查: http://localhost:{PORT}/health');
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
}

startServer();
