const express = require('express');
const bodyParser = require('body-parser');
const { initDatabase } = require('./db/init');
const dbHelper = require('./utils/db-helper');
const { logger, consoleLogger } = require('./middleware/logger');
const repairRoutes = require('./routes/repair');
const reconcileRoutes = require('./routes/reconcile');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(logger);
app.use(consoleLogger);

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'property-repair-trace-service',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    database: dbHelper.db ? 'connected' : 'disconnected'
  });
});

app.use('/api/v1', repairRoutes);
app.use('/api/v1', reconcileRoutes);

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    error: err.message || '服务器内部错误',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在',
    path: req.path
  });
});

const startServer = async () => {
  try {
    await initDatabase();
    await dbHelper.connect();

    app.listen(PORT, () => {
      console.log(`\n========================================`);
      console.log(`物业维修派单验收回放链路服务已启动`);
      console.log(`服务地址: http://localhost:${PORT}`);
      console.log(`健康检查: http://localhost:${PORT}/health`);
      console.log(`API 版本: v1`);
      console.log(`========================================\n`);
    });
  } catch (err) {
    console.error('服务启动失败:', err);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
