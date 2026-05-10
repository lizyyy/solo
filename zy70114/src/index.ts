import { initDb } from './database';
import { app } from './api';

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await initDb();
    console.log('✓ 数据库初始化成功');
    
    app.listen(PORT, () => {
      console.log(`\n========================================`);
      console.log(`  外卖出餐超时补偿服务已启动`);
      console.log(`  服务端口: ${PORT}`);
      console.log(`========================================\n`);
      console.log(`可用接口:`);
      console.log(`  POST /api/orders                    - 创建订单`);
      console.log(`  POST /api/orders/:id/accept         - 商家接单`);
      console.log(`  POST /api/orders/:id/cooking        - 开始制作`);
      console.log(`  POST /api/orders/:id/meal-ready     - 出餐`);
      console.log(`  POST /api/orders/:id/pickup         - 骑手取餐`);
      console.log(`  POST /api/orders/:id/deliver        - 送达`);
      console.log(`  POST /api/orders/:id/assign-rider   - 分配骑手`);
      console.log(`  GET  /api/orders/:id                - 查询订单详情`);
      console.log(`  GET  /api/orders/by-no/:orderNo     - 按订单号查询`);
      console.log(`  POST /api/orders/:id/process-overtime - 处理超时`);
      console.log(`  GET  /api/reports/day|week|month    - 报表统计`);
      console.log(`  GET  /health                        - 健康检查`);
      console.log(`\n========================================\n`);
    });
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
};

startServer();
