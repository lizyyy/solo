const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { initDatabase } = require('./database');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

initDatabase();

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.use('/api', routes);

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '账号批量停用API服务运行正常',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在',
    path: req.path
  });
});

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    message: err.message
  });
});

app.listen(PORT, () => {
  console.log('=' .repeat(60));
  console.log('  账号批量停用API服务已启动');
  console.log(`  服务地址: http://localhost:${PORT}`);
  console.log(`  健康检查: http://localhost:${PORT}/health`);
  console.log(`  API 基础路径: http://localhost:${PORT}/api`);
  console.log('=' .repeat(60));
  console.log('');
  console.log('  可用接口:');
  console.log('  GET  /api/systems              - 获取支持的系统列表');
  console.log('  POST /api/tasks                - 创建停用任务');
  console.log('  GET  /api/tasks                - 查询任务列表');
  console.log('  GET  /api/tasks/:taskId        - 查询单个任务详情');
  console.log('  POST /api/tasks/:taskId/start  - 启动任务');
  console.log('  POST /api/tasks/:taskId/items/:itemId/process  - 处理单个系统');
  console.log('  POST /api/tasks/:taskId/items/:itemId/retry    - 重试失败的系统');
  console.log('  POST /api/tasks/:taskId/items/:itemId/manual   - 人工修正');
  console.log('  GET  /api/tasks/:taskId/audit  - 查看审计日志');
  console.log('  GET  /api/tasks/:taskId/report - 导出报告 (?format=csv)');
  console.log('');
});
