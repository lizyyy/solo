const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

const batchRoutes = require('./routes/batches');
const orderRoutes = require('./routes/orders');
const reportRoutes = require('./routes/reports');
const taskRoutes = require('./routes/tasks');

app.use('/api/batches', batchRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/tasks', taskRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: '物业维修派单权限追责台账 API'
  });
});

app.get('/api/constants', (req, res) => {
  const constants = require('./utils/constants');
  res.json(constants);
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

app.use((req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`物业维修派单权限追责台账 API`);
  console.log(`服务已启动: http://localhost:${PORT}`);
  console.log(`========================================\n`);
  console.log(`主要接口:`);
  console.log(`  GET  /api/health - 健康检查`);
  console.log(`  GET  /api/constants - 常量定义`);
  console.log(`  GET  /api/batches - 批次列表`);
  console.log(`  POST /api/batches - 创建批次`);
  console.log(`  GET  /api/orders - 工单列表`);
  console.log(`  POST /api/orders - 创建工单`);
  console.log(`  GET  /api/reports/project-manager - 项目经理视图`);
  console.log(`  GET  /api/reports/failed-items - 失败项目导出`);
  console.log(`\n使用示例: npm run seed (导入样例数据)`);
  console.log(`         npm test (运行演示脚本)\n`);
});

module.exports = app;
