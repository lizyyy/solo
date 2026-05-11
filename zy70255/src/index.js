const express = require('express');
const path = require('path');
const fs = require('fs');
const { initDb } = require('./db');
const { response } = require('./utils');
const idempotencyService = require('./services/idempotencyService');

const driversRoute = require('./routes/drivers');
const vouchersRoute = require('./routes/vouchers');
const queuesRoute = require('./routes/queues');

const app = express();
const PORT = process.env.PORT || 3000;

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

app.get('/health', (req, res) => {
  response(res, { status: 'ok', ts: Date.now() });
});

app.use('/api/drivers', driversRoute);
app.use('/api/vouchers', vouchersRoute);
app.use('/api/queues', queuesRoute);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: '服务器内部错误' });
});

const gracefulShutdown = (server) => {
  console.log('正在关闭服务...');
  server.close(() => {
    try {
      require('./db').closeDb();
      console.log('服务已安全关闭');
    } catch (e) {
      console.error('关闭数据库时出错', e);
    }
    process.exit(0);
  });
};

const startServer = async () => {
  try {
    await initDb();
    console.log('数据库初始化完成');

    const server = app.listen(PORT, () => {
      console.log(`机场排队券 API 运行在端口 ${PORT}`);
      console.log(`健康检查: http://localhost:${PORT}/health`);
    });

    process.on('SIGTERM', () => gracefulShutdown(server));
    process.on('SIGINT', () => gracefulShutdown(server));

    setInterval(() => {
      idempotencyService.cleanup();
    }, 60 * 60 * 1000);

    module.exports = app;
  } catch (err) {
    console.error('启动失败:', err);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = app;
