import { app } from './app';
import { APP_CONFIG, prisma } from './config';
import { logger } from './utils/logger';

const startServer = async () => {
  try {
    await prisma.$connect();
    logger.info('数据库连接成功');

    app.listen(APP_CONFIG.PORT, () => {
      logger.info(`服务器启动成功: http://localhost:${APP_CONFIG.PORT}`);
    });
  } catch (error) {
    logger.error('服务器启动失败', error);
    process.exit(1);
  }
};

process.on('SIGINT', async () => {
  logger.info('正在关闭服务器...');
  await prisma.$disconnect();
  process.exit(0);
});

startServer();
