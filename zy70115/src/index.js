const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const basicRoutes = require('./routes/basic');
const mealPlanRoutes = require('./routes/mealPlans');
const processRoutes = require('./routes/process');
const studentCountRoutes = require('./routes/studentCount');
const deliveryRoutes = require('./routes/delivery');
const exportRoutes = require('./routes/exports');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.get('/', (req, res) => {
  res.json({
    name: '中央厨房配餐路由 API',
    version: '1.0.0',
    description: '实现过敏源、班级人数和配送线路同时匹配的配餐管理系统',
    health: '/api/health',
    apiGroups: [
      { name: '基础数据', prefix: '/api', endpoints: ['/health', '/schools', '/classes', '/routes', '/allergens'] },
      { name: '配餐计划', prefix: '/api/mealPlans' },
      { name: '流程管理', prefix: '/api/process' },
      { name: '人数变更', prefix: '/api/studentCount' },
      { name: '配送管理', prefix: '/api/delivery' },
      { name: '导出服务', prefix: '/api/exports' }
    ]
  });
});

app.use('/api', basicRoutes);
app.use('/api/mealPlans', mealPlanRoutes);
app.use('/api/process', processRoutes);
app.use('/api/studentCount', studentCountRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/exports', exportRoutes);

const exportsDir = path.join(__dirname, '../exports');
if (!fs.existsSync(exportsDir)) {
  fs.mkdirSync(exportsDir, { recursive: true });
}

app.use('/exports', express.static(exportsDir));

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    errorCode: 500,
    message: '服务器内部错误',
    details: err.message,
    timestamp: new Date().toISOString()
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    errorCode: 404,
    message: '请求的接口不存在',
    path: req.path,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  中央厨房配餐路由 API 已启动`);
  console.log(`  服务地址: http://localhost:${PORT}`);
  console.log(`  健康检查: http://localhost:${PORT}/api/health`);
  console.log(`========================================\n`);
});

module.exports = app;
