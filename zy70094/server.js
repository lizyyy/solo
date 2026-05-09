const express = require('express');
const path = require('path');
const fs = require('fs');
const { initDatabase } = require('./database');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { createResponse } = require('./utils/helpers');

const applicationsRoutes = require('./routes/applications');
const surveysRoutes = require('./routes/surveys');
const approvalsRoutes = require('./routes/approvals');
const metersRoutes = require('./routes/meters');
const supplementsRoutes = require('./routes/supplements');
const reportsRoutes = require('./routes/reports');
const logsRoutes = require('./routes/logs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('数据目录已创建:', dataDir);
}

app.get('/health', (req, res) => {
  res.json(createResponse(true, { status: 'ok', timestamp: new Date().toISOString() }, '服务运行正常'));
});

app.get('/api/health', (req, res) => {
  res.json(createResponse(true, { status: 'ok', timestamp: new Date().toISOString() }, 'API运行正常'));
});

app.use('/api/applications', applicationsRoutes);
app.use('/api/surveys', surveysRoutes);
app.use('/api/approvals', approvalsRoutes);
app.use('/api/meters', metersRoutes);
app.use('/api/supplements', supplementsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/logs', logsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

async function startServer() {
  try {
    await initDatabase();
    console.log('数据库初始化完成');
    
    app.listen(PORT, () => {
      console.log(`
═══════════════════════════════════════════════════════════
  光伏并网申请服务已启动
  服务地址: http://localhost:${PORT}
  健康检查: http://localhost:${PORT}/health
  API 前缀: /api
═══════════════════════════════════════════════════════════
      `);
    });
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
