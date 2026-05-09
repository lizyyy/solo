import express from 'express';
import { config } from './config';
import logger from './config/logger';
import prisma from './config/prisma';
import authRoutes from './routes/auth-routes';
import refundRoutes from './routes/refund-routes';
import importExportRoutes from './routes/import-export-routes';
import { requestLogger } from './middleware/request-logger';
import { errorHandler, notFoundHandler } from './middleware/error-handler';

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(requestLogger);

app.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: '服务运行正常',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/refunds', refundRoutes);
app.use('/api/io', importExportRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(config.port, async () => {
  try {
    await prisma.$connect();
    logger.info(`✅ 数据库连接成功`);
    logger.info(`🚀 服务启动成功，监听端口: ${config.port}`);
    logger.info(`📊 健康检查: http://localhost:${config.port}/health`);
  } catch (error) {
    logger.error('❌ 启动失败:', error);
    process.exit(1);
  }
});

const shutdown = async (signal: string) => {
  logger.info(`接收到 ${signal} 信号，准备关闭服务...`);
  
  server.close(async () => {
    try {
      await prisma.$disconnect();
      logger.info('✅ 数据库连接已关闭');
      process.exit(0);
    } catch (error) {
      logger.error('❌ 关闭过程中出错:', error);
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  logger.error('未捕获的异常:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('未处理的Promise拒绝:', reason);
});

export default app;
