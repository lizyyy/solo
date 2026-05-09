const express = require('express');
const cors = require('cors');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const logger = require('./utils/logger');
const { checkIdempotency, cleanupExpiredIdempotency } = require('./utils/idempotency');
const taskQueue = require('./utils/taskQueue');

const usersRouter = require('./routes/users');
const billsRouter = require('./routes/bills');
const reportsRouter = require('./routes/reports');
const auditRouter = require('./routes/audit');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({
  contentSecurityPolicy: false
}));

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Request-Id', 'X-User-Id']
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' }
});

app.use('/api/', apiLimiter);

app.use(checkIdempotency);

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    requestId: req.headers['x-request-id']
  });
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/users', usersRouter);
app.use('/api/bills', billsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/audit', auditRouter);

app.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });
  
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

taskQueue.startProcessor(3000);

const IDEMPOTENCY_CLEANUP_INTERVAL = 60 * 60 * 1000;
const idempotencyCleanupInterval = setInterval(cleanupExpiredIdempotency, IDEMPOTENCY_CLEANUP_INTERVAL);

const TASK_CLEANUP_INTERVAL = 24 * 60 * 60 * 1000;
const taskCleanupInterval = setInterval(() => {
  taskQueue.cleanupCompletedTasks();
}, TASK_CLEANUP_INTERVAL);

const server = app.listen(PORT, () => {
  logger.info(`Bill splitting system server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}, starting graceful shutdown...`);
  
  taskQueue.stopProcessor();
  clearInterval(idempotencyCleanupInterval);
  clearInterval(taskCleanupInterval);
  
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  
  setTimeout(() => {
    logger.error('Force shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise rejection', { reason: reason?.message, stack: reason?.stack });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

module.exports = app;
