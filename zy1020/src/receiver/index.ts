import express from 'express';
import { receiverRouter } from './routes';

const PORT = process.env.RECEIVER_PORT || 3001;

const app = express();

app.use((req, res, next) => {
  console.log(`[Receiver] ${req.method} ${req.path}`);
  next();
});

app.use(receiverRouter);

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`Webhook 示例接收端已启动`);
  console.log(`========================================`);
  console.log(`监听端口: ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`Webhook 端点: http://localhost:${PORT}/webhook`);
  console.log(`失败测试: http://localhost:${PORT}/webhook/fail?type=server_error`);
  console.log(`查看幂等键: http://localhost:${PORT}/webhook/idempotency-keys`);
  console.log(`========================================`);
  console.log(`预设事件端点:`);
  console.log(`  order.paid:  http://localhost:${PORT}/webhook/order-paid`);
  console.log(`  stock.locked: http://localhost:${PORT}/webhook/stock-locked`);
  console.log(`  repo.pushed:  http://localhost:${PORT}/webhook/repo-pushed`);
  console.log(`========================================`);
  console.log(`可用的失败类型 (?type=):`);
  console.log(`  - timeout      (504, 15秒延迟)`);
  console.log(`  - rate_limit   (429)`);
  console.log(`  - server_error (500)`);
  console.log(`  - bad_gateway  (502)`);
  console.log(`  - unavailable  (503)`);
  console.log(`========================================\n`);
});
