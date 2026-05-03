const express = require('express');
const config = require('./config');
const initDb = require('./storage/database');
const Storage = require('./storage');
const Signature = require('./signature');
const Validation = require('./validation');
const Scheduler = require('./scheduler');
const Exporter = require('./exporter');

const subscriptionsRouter = require('./routes/subscriptions');
const eventsRouter = require('./routes/events');
const logsRouter = require('./routes/logs');
const deadLettersRouter = require('./routes/dead-letters');
const exportRouter = require('./routes/export');
const signatureRouter = require('./routes/signature');

const db = initDb(config.db.path);
const storage = new Storage(db);
const signature = new Signature();
const validation = new Validation(storage);
const scheduler = new Scheduler(storage, signature);
const exporter = new Exporter(storage);

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  res.set('X-Powered-By', 'Webhook Delivery Observer');
  next();
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    scheduler: {
      running: scheduler.isRunning
    }
  });
});

app.get('/stats', (req, res) => {
  const stats = storage.getStats();
  res.json(stats);
});

app.use('/api/subscriptions', subscriptionsRouter(storage, validation));
app.use('/api/events', eventsRouter(storage, validation, scheduler));
app.use('/api/logs', logsRouter(storage));
app.use('/api/dead-letters', deadLettersRouter(storage, scheduler));
app.use('/api/export', exportRouter(exporter));
app.use('/api/signature', signatureRouter(signature));

app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  console.error(err.stack);
  
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    method: req.method,
    path: req.path
  });
});

const PORT = config.port;

if (require.main === module) {
  scheduler.start();

  app.listen(PORT, () => {
    console.log(`Webhook Delivery Observer running on http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Stats: http://localhost:${PORT}/stats`);
    console.log('');
    console.log('Available API endpoints:');
    console.log('  POST   /api/subscriptions        - 创建订阅');
    console.log('  GET    /api/subscriptions        - 列出所有订阅');
    console.log('  GET    /api/subscriptions/:id    - 获取订阅详情');
    console.log('  PATCH  /api/subscriptions/:id    - 更新订阅');
    console.log('  DELETE /api/subscriptions/:id    - 删除订阅');
    console.log('');
    console.log('  POST   /api/events               - 发送事件');
    console.log('  GET    /api/events/samples       - 获取示例事件');
    console.log('  GET    /api/events/:id           - 获取事件详情');
    console.log('  GET    /api/events/:id/logs      - 获取事件投递日志');
    console.log('  POST   /api/events/:id/retry     - 重试投递事件');
    console.log('');
    console.log('  GET    /api/logs                 - 获取投递日志');
    console.log('  GET    /api/logs/stats           - 获取统计信息');
    console.log('');
    console.log('  GET    /api/dead-letters         - 获取死信队列');
    console.log('  POST   /api/dead-letters/:id/retry - 重试死信');
    console.log('  DELETE /api/dead-letters/:id     - 删除死信');
    console.log('');
    console.log('  GET    /api/export/json          - 导出 JSON 审计报告');
    console.log('  GET    /api/export/markdown      - 导出 Markdown 审计报告');
    console.log('');
    console.log('  POST   /api/signature/verify     - 验证签名');
    console.log('  POST   /api/signature/generate   - 生成签名');
  });

  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down...');
    scheduler.stop();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down...');
    scheduler.stop();
    process.exit(0);
  });
}

module.exports = { app, storage, signature, validation, scheduler, exporter, db };