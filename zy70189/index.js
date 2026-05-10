const express = require('express');
const config = require('./config');
const logger = require('./src/logger');
const { initDatabase } = require('./src/database');

async function startServer() {
  await initDatabase();
  logger.info('数据库初始化完成');

  const categoriesRoute = require('./src/routes/categories');
  const limitsRoute = require('./src/routes/limits');
  const permissionsRoute = require('./src/routes/permissions');
  const refundsRoute = require('./src/routes/refunds');
  const approvalsRoute = require('./src/routes/approvals');
  const auditRoute = require('./src/routes/audit');

  const app = express();

  app.use(express.json({ limit: '10mb' }));

  app.use((req, res, next) => {
    logger.info('HTTP请求', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      operator_id: req.headers['x-operator-id']
    });
    next();
  });

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'refund-permission-api',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  });

  app.use('/api/categories', categoriesRoute);
  app.use('/api/limits', limitsRoute);
  app.use('/api/permissions', permissionsRoute);
  app.use('/api/refunds', refundsRoute);
  app.use('/api/approvals', approvalsRoute);
  app.use('/api/audit', auditRoute);

  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: '接口不存在',
      path: req.path
    });
  });

  app.use((err, req, res, next) => {
    logger.error('服务器错误', { error: err.message, stack: err.stack });
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      detail: err.message
    });
  });

  app.listen(config.server.port, () => {
    logger.info('服务器启动', {
      host: config.server.host,
      port: config.server.port
    });
    console.log(`客服退款权限API已启动: http://${config.server.host}:${config.server.port}`);
    console.log('健康检查: http://localhost:3000/health');
  });
}

startServer().catch(err => {
  logger.error('启动失败', { error: err.message });
  console.error('启动失败:', err.message);
  process.exit(1);
});
