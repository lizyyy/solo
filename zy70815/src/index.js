const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const taskRoutes = require('./routes/tasks');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ship-berth-scheduler'
  });
});

app.use('/api/tasks', taskRoutes);

app.use((err, req, res, next) => {
  console.error('未处理的错误:', err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    message: err.message
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在'
  });
});

app.listen(PORT, () => {
  console.log(`
=======================================
船舶靠泊排队调度服务已启动
端口: ${PORT}
健康检查: http://localhost:${PORT}/health
=======================================

可用接口:
POST /api/tasks/submit          - 提交调度材料
GET  /api/tasks/:taskId         - 获取任务详情
GET  /api/tasks                 - 获取任务列表
PATCH /api/tasks/:taskId/status - 更新任务状态
GET  /api/tasks/:taskId/audit-logs - 获取审计日志
POST /api/tasks/:taskId/export  - 导出任务

POST /api/tasks/berth-assignments/:assignmentId/lock   - 锁定泊位
POST /api/tasks/berth-assignments/:assignmentId/adjust - 调整泊位
GET  /api/tasks/berth-assignments/:assignmentId/adjustments - 获取调整记录

POST /api/tasks/tides           - 添加潮汐数据
GET  /api/tasks/tides           - 获取潮汐数据
  `);
});
