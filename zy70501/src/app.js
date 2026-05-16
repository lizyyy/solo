const express = require('express');
const bodyParser = require('body-parser');
const idempotentRoutes = require('./routes/idempotent');
const { STATUS } = require('./models/IdempotentRequest');
const { ACTIONS } = require('./models/MediationRecord');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    code: 'HEALTH_OK',
    message: '服务运行正常',
    data: {
      timestamp: new Date().toISOString(),
      service: 'idempotent-mediation-api'
    }
  });
});

app.get('/api/status-enum', (req, res) => {
  res.json({
    success: true,
    code: 'SUCCESS',
    data: STATUS
  });
});

app.get('/api/actions-enum', (req, res) => {
  res.json({
    success: true,
    code: 'SUCCESS',
    data: ACTIONS
  });
});

app.use('/api/idempotent', idempotentRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    code: 'NOT_FOUND',
    message: '接口不存在',
    path: req.path,
    method: req.method
  });
});

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    code: 'INTERNAL_ERROR',
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║      幂等窗口调停API服务已启动                              ║
║                                                            ║
║      服务地址: http://localhost:${PORT}                      ║
║      健康检查: http://localhost:${PORT}/health                ║
║                                                            ║
║      API 接口前缀: /api/idempotent                          ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
