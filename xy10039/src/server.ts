import app from './app';
import { config } from './config/environment';
import { logger } from './config/logger';
import { connectDatabase, syncDatabase } from './config/database';
import './models';

async function startServer(): Promise<void> {
  try {
    await connectDatabase();
    await syncDatabase();

    app.listen(config.port, () => {
      logger.info(`服务器运行在 http://localhost:${config.port}`);
      logger.info(`环境: ${config.nodeEnv}`);
      logger.info('API文档:');
      logger.info('  GET  /health - 健康检查');
      logger.info('  POST /api/auth/login - 登录');
      logger.info('  POST /api/auth/register - 注册');
      logger.info('  GET  /api/activities - 活动列表');
      logger.info('  GET  /api/registrations - 报名列表');
    });
  } catch (error) {
    logger.error('服务器启动失败:', error);
    process.exit(1);
  }
}

startServer();
