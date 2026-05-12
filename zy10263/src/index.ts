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

  员工 API:
    - POST /api/employees - 创建员工
    - GET  /api/employees - 获取员工列表
    - GET  /api/employees/:id - 获取员工详情
    - GET  /api/employees/:id/skills - 获取员工技能
    - POST /api/employees/:id/skills - 添加员工技能

  产线/技能 API:
    - POST /api/skills - 创建技能
    - GET  /api/skills - 获取技能列表
    - POST /api/lines - 创建产线
    - GET  /api/lines - 获取产线列表

  换线申请 API:
    - POST /api/swap-requests - 创建换线申请
    - GET  /api/swap-requests - 获取换线申请列表
    - GET  /api/swap-requests/:id - 获取换线申请详情
    - POST /api/swap-requests/:id/approve - 审批换线申请
    - POST /api/swap-requests/:id/reject - 拒绝换线申请

  工时/缺勤/绩效 API:
    - POST /api/work-hours - 创建工时记录
    - GET  /api/work-hours - 获取工时记录
    - POST /api/work-hours/:id/confirm - 确认工时
    - POST /api/absences - 创建缺勤记录
    - GET  /api/absences - 获取缺勤记录
    - POST /api/performances/calculate - 计算绩效
    - GET  /api/performances - 获取绩效记录

  快速演示: npm run demo
=========================================
  `);
});
