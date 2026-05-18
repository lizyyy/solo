import express from 'express';
import routes from './routes';
import { initSampleData } from './sampleData';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api/return-bucket', routes);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: '水站配送队桶装水退桶 API 服务运行正常',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`
============================================
  水站配送队桶装水退桶 API 服务已启动
  服务地址: http://localhost:${PORT}
  健康检查: http://localhost:${PORT}/health
  API根路径: http://localhost:${PORT}/api/return-bucket
============================================
  `);

  initSampleData();
  console.log('样例数据已初始化');
});
