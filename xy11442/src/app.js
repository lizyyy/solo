require('dotenv').config();
const express = require('express');
const config = require('./config');
const logger = require('./config/logger');
const { sequelize } = require('./models');
const routes = require('./routes');
const CompensationWorker = require('./workers/compensationWorker');
const QueueService = require('./services/queueService');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', routes);

app.use((err, req, res, next) => {
  logger.error('未处理的错误:', err);
  res.status(500).json({ error: '服务器内部错误', message: err.message });
});

async function startServer() {
  try {
    await sequelize.authenticate();
    logger.info('数据库连接成功');
    
    await sequelize.sync();
    logger.info('数据库同步完成');

    CompensationWorker.start();
    logger.info('队列处理器已启动');

    await QueueService.recoverJobsOnStartup();

    app.listen(config.port, () => {
      logger.info(`服务器运行在 http://localhost:${config.port}`);
      logger.info('生鲜分拣损耗重试补偿队列服务启动成功');
    });
  } catch (error) {
    logger.error('服务启动失败:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  logger.info('收到SIGTERM信号，正在关闭服务...');
  const { closeAllQueues } = require('./config/queue');
  await closeAllQueues();
  await sequelize.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('收到SIGINT信号，正在关闭服务...');
  const { closeAllQueues } = require('./config/queue');
  await closeAllQueues();
  await sequelize.close();
  process.exit(0);
});

if (require.main === module) {
  startServer();
}

module.exports = app;
