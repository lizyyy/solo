import app from './app';
import { env } from './config';
import prisma from './utils/prisma';

async function startServer() {
  try {
    await prisma.$connect();
    console.log('✅ 数据库连接成功');

    app.listen(env.PORT, () => {
      console.log(`🚀 服务器运行在 http://localhost:${env.PORT}`);
      console.log(`📊 健康检查: http://localhost:${env.PORT}/health`);
      console.log(`🔗 API 信息: http://localhost:${env.PORT}/api`);
    });
  } catch (error) {
    console.error('❌ 启动失败:', error);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  console.log('\n⏹️  正在关闭服务器...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⏹️  正在关闭服务器...');
  await prisma.$disconnect();
  process.exit(0);
});

startServer();
