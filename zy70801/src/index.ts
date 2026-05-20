import express from 'express';
import cors from 'cors';
import routes from './routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', routes);

app.listen(PORT, () => {
  console.log(`
============================================
  检验科危急值整合系统 API 服务已启动
  服务地址: http://localhost:${PORT}
  API 前缀: http://localhost:${PORT}/api
============================================

  可用接口:
  GET  /api/health           - 健康检查
  POST /api/upload/critical-value  - 上传危急值CSV
  POST /api/upload/callback       - 上传回告记录JSON
  POST /api/upload/duty           - 上传值班表CSV
  POST /api/upload/confirm        - 上传医生确认记录JSON
  POST /api/confirm               - 创建单条医生确认记录
  GET  /api/batches              - 获取批次列表
  GET  /api/batches/:batchId     - 获取批次详情
  GET  /api/critical-values/:id/review  - 值班主任复核追溯
  GET  /api/statistics           - 统计数据

  快速开始:
  1. npm install
  2. npm run init-db
  3. npm run dev
  `);
});
