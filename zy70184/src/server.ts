import app from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './config/database';

const startServer = async (): Promise<void> => {
  try {
    await prisma.$connect();
    logger.info('数据库连接成功');

    const server = app.listen(env.port, () => {
      logger.info(`服务器启动成功，监听端口: ${env.port}`);
      logger.info(`环境: ${env.nodeEnv}`);
      logger.info(`API版本: ${env.apiVersion}`);
      logger.info(`访问地址: http://localhost:${env.port}`);
    });

    const shutdown = async () => {
      logger.info('正在关闭服务器...');
      server.close(async () => {
        await prisma.$disconnect();
        logger.info('服务器已关闭');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    process.on('uncaughtException', (error: Error) => {
      logger.error('未捕获的异常:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason: unknown) => {
      logger.error('未处理的Promise拒绝:', reason);
      process.exit(1);
    });
  } catch (error) {
    logger.error('服务器启动失败:', error);
    process.exit(1);
  }
};

startServer();
