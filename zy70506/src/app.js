const express = require('express');
const bodyParser = require('body-parser');
const compensationRoutes = require('./routes/compensation');
require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'approval-callback-compensation-api',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/compensation', compensationRoutes);

app.use((req, res) => {
  res.status(404).json({
    code: 'NOT_FOUND',
    message: '接口不存在',
    path: req.path
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    code: 'INTERNAL_ERROR',
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║      审批回调补偿 API 服务已启动                           ║
║                                                            ║
║      服务地址: http://localhost:${PORT}                       ║
║      健康检查: http://localhost:${PORT}/health                ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;