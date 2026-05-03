const app = require('./app');
const db = require('./db');

const PORT = process.env.PORT || 3000;

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

const startServer = async () => {
  try {
    await db.raw('SELECT 1');
    console.log('数据库连接成功');

    const server = app.listen(PORT, () => {
      console.log(`服务器启动成功，端口: ${PORT}`);
      console.log(`环境: ${process.env.NODE_ENV || 'development'}`);
      console.log(`API 根地址: http://localhost:${PORT}/api/v1`);
      console.log(`健康检查: http://localhost:${PORT}/api/v1/health`);
    });

    process.on('SIGTERM', () => {
      console.log('收到 SIGTERM 信号，正在关闭服务器...');
      server.close(async () => {
        console.log('HTTP 服务器已关闭');
        await db.destroy();
        console.log('数据库连接已关闭');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('收到 SIGINT 信号，正在关闭服务器...');
      server.close(async () => {
        console.log('HTTP 服务器已关闭');
        await db.destroy();
        console.log('数据库连接已关闭');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
};

startServer();
