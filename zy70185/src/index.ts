import app from './app';
import { config } from './config';
import prisma from './db/prisma';

async function main() {
  try {
    await prisma.$connect();
    console.log('✅ 数据库连接成功');

    const server = app.listen(config.port, () => {
      console.log(`🚀 预算滚动预测锁定 API 系统已启动`);
      console.log(`📍 服务地址: http://localhost:${config.port}`);
      console.log(`🌍 环境: ${config.nodeEnv}`);
    });

    const shutdown = async () => {
      console.log('\n⚠️  正在关闭服务...');
      server.close(async () => {
        await prisma.$disconnect();
        console.log('👋 服务已优雅关闭');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    console.error('❌ 启动失败:', error);
    process.exit(1);
  }
}

main();
