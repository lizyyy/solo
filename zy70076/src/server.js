const express = require('express');
require('dotenv').config();

const travelRequestRoutes = require('./routes/travel-requests');
const departmentRoutes = require('./routes/departments');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`, {
    method: req.method,
    url: req.url,
    ip: req.ip
  });
  next();
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '差旅预算占用 API 服务正常运行',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.use('/api/travel-requests', travelRequestRoutes);
app.use('/api/departments', departmentRoutes);

app.use((err, req, res, next) => {
  logger.error('未捕获的错误', { error: err.message });
  res.status(500).json({
    success: false,
    businessCode: 'SERVER_ERROR',
    message: '服务器内部错误',
    data: process.env.NODE_ENV === 'development' ? { error: err.stack } : null
  });
});

app.listen(PORT, () => {
  logger.info(`差旅预算占用 API 服务已启动`, {
    port: PORT,
    environment: process.env.NODE_ENV || 'development'
  });
  console.log(`\n========================================`);
  console.log(`  差旅预算占用 API 服务已启动`);
  console.log(`  端口: ${PORT}`);
  console.log(`  健康检查: http://localhost:${PORT}/health`);
  console.log(`========================================\n`);
});

module.exports = app;
