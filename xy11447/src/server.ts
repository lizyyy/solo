import express from 'express';
import path from 'path';
import { apiRouter } from './api';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api', apiRouter);

app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`充电桩巡检重试补偿队列 API 服务运行在 http://localhost:${PORT}`);
  console.log(`API 文档: http://localhost:${PORT}/api`);
  console.log(`管理界面: http://localhost:${PORT}`);
});

export default app;
