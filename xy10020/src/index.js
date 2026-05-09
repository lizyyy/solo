const express = require('express');
const http = require('http');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const logger = require('./utils/logger');
const { initDatabase, closeDb } = require('./database/client');
const { closeRedis } = require('./redis/client');

const WebSocketService = require('./services/webSocketService');
const PushTaskService = require('./services/pushTaskService');

const errorHandler = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');
const idempotencyMiddleware = require('./middleware/idempotency');

const authRoutes = require('./routes/auth');
const liveRoomRoutes = require('./routes/liveRooms');
const messageRoutes = require('./routes/messages');
const pushTaskRoutes = require('./routes/pushTasks');
const logRoutes = require('./routes/logs');
const reportRoutes = require('./routes/reports');
const healthRoutes = require('./routes/health');

const app = express();
const server = http.createServer(app);

app.use(helmet({
  contentSecurityPolicy: false
}));

app.use(compression());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: '请求频繁',
    message: '请稍后再试'
  }
});
app.use(limiter);

app.use(requestLogger);
app.use(idempotencyMiddleware);

app.use('/api/auth', authRoutes);
app.use('/api/live-rooms', liveRoomRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/push-tasks', pushTaskRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/health', healthRoutes);

app.get('/', (req, res) => {
  res.json({
    name: '直播推送系统',
    version: '1.0.0',
    description: '稳定可靠的直播推送系统',
    endpoints: {
      auth: '/api/auth',
      liveRooms: '/api/live-rooms',
      messages: '/api/messages',
      pushTasks: '/api/push-tasks',
      logs: '/api/logs',
      reports: '/api/reports',
      health: '/api/health',
      websocket: '/ws'
    }
  });
});

app.use(errorHandler);

app.use('*', (req, res) => {
  res.status(404).json({
    error: '路由不存在',
    message: `无法找到 ${req.method} ${req.originalUrl}`
  });
});

let webSocketService = null;
let pushTaskService = null;

const startServer = async () => {
  try {
    initDatabase();

    webSocketService = new WebSocketService(server);
    pushTaskService = new PushTaskService(webSocketService);

    app.locals.webSocketService = webSocketService;
    app.locals.pushTaskService = pushTaskService;

    await pushTaskService.start();

    server.listen(config.port, () => {
      logger.info(`服务器启动成功，监听端口: ${config.port}`);
      logger.info(`健康检查: http://localhost:${config.port}/api/health`);
      logger.info(`WebSocket: ws://localhost:${config.port}/ws`);
    });

    const gracefulShutdown = async (signal) => {
      logger.info(`收到 ${signal} 信号，开始优雅关闭...`);

      await pushTaskService.stop();

      server.close(async () => {
        logger.info('HTTP服务器已关闭');
        await closeRedis();
        closeDb();
        logger.info('服务器已完全关闭');
        process.exit(0);
      });

      setTimeout(() => {
        logger.error('强制关闭服务器');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    process.on('uncaughtException', (error) => {
      logger.error('未捕获的异常:', error);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('未处理的Promise拒绝:', { reason, promise });
    });

  } catch (error) {
    logger.error('服务器启动失败:', error);
    process.exit(1);
  }
};

startServer();
