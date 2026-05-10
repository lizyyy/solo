import { createApp } from './app';

const app = createApp();
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`渠道激励达标复核服务已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
  console.log('');
  console.log('API 端点:');
  console.log('  POST   /api/target-snapshots          - 创建目标快照');
  console.log('  POST   /api/target-snapshots/:id/finalize - 锁定目标快照');
  console.log('  POST   /api/achievements              - 创建达标记录');
  console.log('  POST   /api/protections               - 创建保护期');
  console.log('  POST   /api/cross-region              - 创建跨区归属');
  console.log('  POST   /api/disputes                  - 提出争议');
  console.log('  POST   /api/incentives/calculate      - 计算激励');
  console.log('  GET    /api/logs/history/:type/:id    - 查看实体历史');
  console.log('');
  console.log('请求头要求:');
  console.log('  x-operator-id: 操作人ID');
  console.log('  x-operator-name: 操作人姓名');
  console.log('  x-operator-role: 操作人角色 (可选)');
});
