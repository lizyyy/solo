import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from './routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/api', routes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '工厂班组换线 API 服务运行正常' });
});

app.listen(PORT, () => {
  console.log(`
=========================================
  工厂班组换线 API 服务已启动
  服务地址: http://localhost:${PORT}
  健康检查: http://localhost:${PORT}/health
  API 文档: 
    - GET  /api/employees - 获取员工列表
    - GET  /api/lines - 获取产线列表
    - POST /api/swap-requests - 创建换线申请
    - POST /api/swap-requests/:id/approve - 审批换线申请
    - POST /api/work-hours - 创建工时记录
    - POST /api/absences - 创建缺勤记录
    - POST /api/performances/calculate - 计算绩效
=========================================
  `);
});
