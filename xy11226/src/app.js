const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { initDatabase } = require('./models');
const ticketRoutes = require('./routes/tickets');
const auditRoutes = require('./routes/audit');
const logger = require('./config/logger');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  logger.info('请求开始', {
    method: req.method,
    url: req.url,
    ip: req.ip
  });
  next();
});

app.use('/api/tickets', ticketRoutes);
app.use('/api/audit', auditRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '服务运行正常',
    timestamp: new Date().toISOString()
  });
});

app.use((err, req, res, next) => {
  logger.error('服务器错误', { error: err.message, stack: err.stack });
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在'
  });
});

const startServer = async () => {
  try {
    await initDatabase();
    logger.info('数据库初始化完成');

    app.listen(PORT, () => {
      logger.info(`服务器启动成功，监听端口 ${PORT}`);
      console.log(`\n========================================`);
      console.log(`换电运营值班系统已启动`);
      console.log(`服务地址: http://localhost:${PORT}`);
      console.log(`健康检查: http://localhost:${PORT}/api/health`);
      console.log(`========================================\n`);
    });
  } catch (error) {
    logger.error('服务器启动失败', { error: error.message });
    process.exit(1);
  }
};

startServer();

module.exports = app;
