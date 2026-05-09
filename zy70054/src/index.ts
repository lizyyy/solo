import { createApp } from './app';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

const app = createApp();

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  银行卡换卡寄送 API 服务已启动`);
  console.log(`  监听端口: ${PORT}`);
  console.log(`  健康检查: http://localhost:${PORT}/health`);
  console.log(`========================================\n`);
});
