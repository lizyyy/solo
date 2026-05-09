const express = require('express');
const db = require('./config/database');

const temperatureRoutes = require('./routes/temperatureRoutes');
const traceRoutes = require('./routes/traceRoutes');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

app.use('/api/temperature', temperatureRoutes);
app.use('/api/trace', traceRoutes);

app.get('/health', (req, res) => {
  res.json({
    success: true,
    code: 'HEALTHY',
    message: '服务运行正常',
    timestamp: new Date().toISOString(),
    database: 'connected'
  });
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    code: 'OK',
    message: '冷链温控追溯 API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      temperature: {
        import: 'POST /api/temperature/events',
        batchImport: 'POST /api/temperature/events/batch'
      },
      trace: {
        byOrder: 'GET /api/trace/order/:orderNumber',
        byBox: 'GET /api/trace/box/:boxNumber',
        byShift: 'GET /api/trace/shift/:shiftName',
        byTimeRange: 'GET /api/trace/time-range?startTime=xxx&endTime=xxx',
        statistics: 'GET /api/trace/statistics',
        eventDetail: 'GET /api/trace/events/:id'
      }
    }
  });
});

app.use((err, req, res, next) => {
  console.error('未捕获的错误:', err);
  res.status(500).json({
    success: false,
    code: 'INTERNAL_ERROR',
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    code: 'NOT_FOUND',
    message: '请求的资源不存在',
    path: req.originalUrl
  });
});

const server = app.listen(PORT, () => {
  console.log('========================================');
  console.log('   冷链温控追溯 API 服务已启动');
  console.log('========================================');
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log('========================================');
});

process.on('SIGINT', () => {
  console.log('\n正在关闭服务...');
  server.close(() => {
    db.close();
    console.log('服务已正常关闭');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n正在关闭服务...');
  server.close(() => {
    db.close();
    console.log('服务已正常关闭');
    process.exit(0);
  });
});

module.exports = { app, server };
