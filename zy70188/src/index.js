require('dotenv').config();
require('express-async-errors');
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const sequelize = require('./config/database');
const logger = require('./config/logger');
const routes = require('./routes');
const { handleError } = require('./utils/response');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || uuidv4();
  req.ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  
  logger.info('收到请求:', {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    operatorId: req.headers['x-operator-id'],
    operatorName: req.headers['x-operator-name']
  });
  
  next();
});

app.use('/api', routes);

app.use((err, req, res, next) => {
  logger.error('全局错误处理:', {
    requestId: req.requestId,
    error: err.message,
    stack: err.stack
  });
  
  const response = handleError(err);
  res.status(response.code >= 100 ? response.code : 500).json(response.toJSON());
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    code: 404,
    message: '请求的资源不存在',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

async function startServer() {
  try {
    await sequelize.authenticate();
    logger.info('数据库连接成功');

    await sequelize.sync({ alter: true });
    logger.info('数据库模型同步完成');

    app.listen(PORT, () => {
      logger.info(`统一收据号段API服务已启动`);
      logger.info(`服务地址: http://localhost:${PORT}`);
      logger.info(`健康检查: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    logger.error('服务启动失败:', error);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  logger.info('收到关闭信号，正在优雅关闭服务...');
  try {
    await sequelize.close();
    logger.info('数据库连接已关闭');
    process.exit(0);
  } catch (error) {
    logger.error('关闭过程中发生错误:', error);
    process.exit(1);
  }
});

process.on('uncaughtException', (error) => {
  logger.error('未捕获的异常:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('未处理的Promise拒绝:', { reason, promise });
});

startServer();

module.exports = app;
