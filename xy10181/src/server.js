const app = require('./app');
const logger = require('./utils/logger');
const { startCronJobs } = require('./services/cronService');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  logger.info(`限额审批服务启动成功，监听端口 ${PORT}`);
  startCronJobs();
});

process.on('SIGTERM', () => {
  logger.info('收到 SIGTERM 信号，正在优雅关闭服务...');
  server.close(() => {
    logger.info('服务已关闭');
    process.exit(0);
  });
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('未处理的 Promise 拒绝:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('未捕获的异常:', error);
  process.exit(1);
});
