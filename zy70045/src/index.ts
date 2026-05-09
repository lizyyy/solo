import express from 'express';
import router from './api/routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api', router);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`产线换班产量结算 API 服务已启动，监听端口 ${PORT}`);
  console.log('服务地址: http://localhost:3000');
  console.log('健康检查: http://localhost:3000/health');
  console.log('API 前缀: http://localhost:3000/api/');
});
