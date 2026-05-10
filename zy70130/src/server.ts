import app from './app';
import { config } from './config';
import { getDatabase, closeDatabase } from './database';

function main() {
  getDatabase();

  const server = app.listen(config.serverPort, () => {
    console.log(`数字藏品转赠风控 API 服务已启动`);
    console.log(`监听端口: ${config.serverPort}`);
    console.log(`数据库路径: ${config.dbPath}`);
    console.log(`冷却期: ${config.coolDownPeriodHours} 小时`);
    console.log(`每小时转赠上限: ${config.maxTransfersPerHour} 次`);
    console.log(`每日转赠上限: ${config.maxTransfersPerDay} 次`);
    console.log('');
    console.log('API 端点:');
    console.log('  GET  /health                          - 健康检查');
    console.log('  POST /users                           - 创建用户');
    console.log('  GET  /users/:id                       - 获取用户信息');
    console.log('  PUT  /users/:id/verify                - 更新实名认证状态');
    console.log('  GET  /users/:id/collections           - 获取用户藏品');
    console.log('  GET  /users/:id/transfers             - 获取用户转赠记录');
    console.log('  GET  /users/:id/audit                 - 获取用户操作审计');
    console.log('  GET  /users/:id/freeze-history        - 获取用户冻结历史');
    console.log('  POST /collections                     - 创建藏品');
    console.log('  GET  /collections/:id                 - 获取藏品信息');
    console.log('  GET  /collections/:id/transfers       - 获取藏品转赠历史');
    console.log('  POST /transfers                       - 创建转赠请求');
    console.log('  GET  /transfers/:id                   - 获取转赠详情');
    console.log('  POST /transfers/:id/approve           - 确认转赠');
    console.log('  POST /transfers/:id/cancel            - 取消转赠');
    console.log('  POST /transfers/:id/revoke            - 撤销已完成转赠');
    console.log('  PUT  /transfers/:id/status            - 人工修正状态');
    console.log('  POST /admin/freeze/user               - 冻结用户');
    console.log('  POST /admin/unfreeze/user             - 解冻用户');
    console.log('  POST /admin/freeze/collection         - 冻结藏品');
    console.log('  POST /admin/unfreeze/collection       - 解冻藏品');
  });

  process.on('SIGINT', () => {
    console.log('正在关闭服务器...');
    server.close(() => {
      closeDatabase();
      console.log('服务器已关闭');
      process.exit(0);
    });
  });
}

main();
