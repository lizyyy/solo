const app = require('./app');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                宠物寄养喂药 API 服务已启动                     ║
╠═══════════════════════════════════════════════════════════════╣
║  服务地址: http://localhost:${PORT}                             ║
║  健康检查: http://localhost:${PORT}/health                      ║
║  API 入口: http://localhost:${PORT}/api                         ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});

process.on('SIGTERM', () => {
  console.log('收到 SIGTERM 信号，正在关闭服务器...');
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('收到 SIGINT 信号，正在关闭服务器...');
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});
