const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const healthCheckRoutes = require('./routes/healthCheck');
const isolationRoutes = require('./routes/isolation');
const exportRoutes = require('./routes/export');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.use('/api/health-check', healthCheckRoutes);
app.use('/api/isolation', isolationRoutes);
app.use('/api/export', exportRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '托育园保健室晨检隔离API服务运行正常',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在'
  });
});

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: err.message
  });
});

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║    托育园保健室晨检隔离 API 服务已启动                        ║
║                                                              ║
║    服务地址: http://localhost:${PORT}                           ║
║    健康检查: http://localhost:${PORT}/api/health               ║
║                                                              ║
║    接口列表:                                                  ║
║      - POST /api/health-check/single    - 单条晨检录入        ║
║      - POST /api/health-check/batch     - 批量晨检导入        ║
║      - POST /api/isolation/single       - 单条隔离录入        ║
║      - POST /api/isolation/batch        - 批量隔离导入        ║
║      - GET  /api/export/health-check/:date - 导出晨检记录    ║
║      - GET  /api/export/isolation        - 导出隔离记录        ║
║      - GET  /api/export/daily-report/:date - 日报统计         ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
  `);
});
