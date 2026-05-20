const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

require('./database');
const taskRoutes = require('./routes/tasks');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.use('/api/tasks', taskRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    message: '服务器内部错误'
  });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`API文档:`);
  console.log(`  POST /api/tasks/submit - 提交材料`);
  console.log(`  PATCH /api/tasks/:taskId/status - 更新任务状态`);
  console.log(`  GET /api/tasks/:taskId - 获取任务详情`);
  console.log(`  GET /api/tasks - 获取任务列表`);
  console.log(`  GET /api/tasks/statistics - 获取统计信息`);
  console.log(`  GET /api/tasks/:taskId/audit-logs - 获取审计日志`);
  console.log(`  POST /api/tasks/:taskId/export - 导出任务`);
  console.log(`  GET /api/tasks/:taskId/export-history - 获取导出历史`);
});

module.exports = app;