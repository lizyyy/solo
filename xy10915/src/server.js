const express = require('express');
const cors = require('cors');

const appointmentsRouter = require('./routes/appointments');
const healthRouter = require('./routes/health');
const reportsRouter = require('./routes/reports');
const baseDataRouter = require('./routes/baseData');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '养老院探访预约API服务运行正常' });
});

app.use('/api/appointments', appointmentsRouter);
app.use('/api/health', healthRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/data', baseDataRouter);

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ success: false, error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`
========================================
  养老院探访预约API服务
  服务地址: http://localhost:${PORT}
  健康检查: http://localhost:${PORT}/health
========================================

API 端点:
  POST /api/appointments              - 创建预约
  GET  /api/appointments              - 查询预约列表
  GET  /api/appointments/:id          - 查询单个预约
  GET  /api/appointments/:id/history  - 查询预约状态历史
  PUT  /api/appointments/:id/status   - 更新预约状态
  PUT  /api/appointments/:id/manual   - 人工修正预约
  
  POST /api/health/declare            - 提交健康申报
  GET  /api/health/validate/:id       - 验证健康申报
  
  GET  /api/reports/appointments      - 获取预约报告
  GET  /api/reports/export/csv        - 导出CSV报告
  GET  /api/reports/statistics        - 获取统计数据
  
  GET  /api/data/elders               - 获取老人列表
  POST /api/data/elders               - 创建老人档案
  GET  /api/data/visitors             - 获取探访人列表
  POST /api/data/visitors             - 创建探访人
  GET  /api/data/rooms                - 获取房间列表
  POST /api/data/rooms                - 创建房间
  GET  /api/data/timeslots            - 获取时间段
  POST /api/data/timeslots            - 创建时间段
  
  GET  /api/appointments/exceptions/all   - 获取所有异常记录
  GET  /api/appointments/exceptions/:id   - 获取单个异常记录

使用说明:
  1. 运行 npm run init-db 初始化数据库
  2. 运行 npm run seed-data 导入样例数据
  3. 运行 npm run test 运行测试脚本
`);
});
