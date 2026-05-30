const express = require('express');
const config = require('./config');
const routes = require('./routes');
const { initDatabase } = require('./db/connection');

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

app.use('/api', routes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    path: req.path
  });
});

const startServer = async () => {
  await initDatabase();
  console.log('Database initialized');

  const server = app.listen(config.server.port, config.server.host, () => {
    console.log(`
  ╔════════════════════════════════════════════════════════════╗
  ║  乐队设备租赁结算服务启动成功                              ║
  ║  服务地址: http://${config.server.host}:${config.server.port}        ║
  ║  API 前缀: /api                                           ║
  ║  健康检查: /api/health                                    ║
  ║  配置信息: /api/config                                    ║
  ╚════════════════════════════════════════════════════════════╝
  `);
  });

  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
};

startServer().catch(console.error);

module.exports = app;
