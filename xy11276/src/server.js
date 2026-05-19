const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const config = require('../config/default');
const routes = require('./routes');
const db = require('./database');
const logger = require('./utils/logger');

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  logger.info(`请求: ${req.method} ${req.path}`);
  next();
});

app.use('/api', routes);

app.use((err, req, res, next) => {
  logger.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误'
  });
});

const initServer = async () => {
  try {
    await db.initTables();
    logger.info('数据库初始化完成');
    
    const PORT = process.env.PORT || config.server.port;
    app.listen(PORT, () => {
      logger.info(`服务器启动成功，端口: ${PORT}`);
      logger.info(`健康检查: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    logger.error('服务器启动失败:', error);
    process.exit(1);
  }
};

process.on('SIGINT', async () => {
  logger.info('正在关闭服务器...');
  await db.closeConnection();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('正在关闭服务器...');
  await db.closeConnection();
  process.exit(0);
});

initServer();

module.exports = app;