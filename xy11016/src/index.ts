import express from 'express';
import orderRoutes from './routes/orders';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api/orders', orderRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '烘焙工坊蛋糕急单排产API运行正常' });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log('API 端点:');
  console.log('  GET  /api/orders              - 订单列表');
  console.log('  GET  /api/orders/:id          - 订单详情');
  console.log('  GET  /api/orders/:id/history  - 订单修改历史');
  console.log('  POST /api/orders              - 创建订单');
  console.log('  PUT  /api/orders/:id          - 更新订单');
  console.log('  POST /api/orders/:id/schedule-urgent  - 急单排产');
  console.log('  POST /api/orders/:id/recall   - 撤回订单');
  console.log('  POST /api/orders/:id/resubmit - 重新提交');
  console.log('  POST /api/orders/:id/manual-processing - 进入人工处理');
  console.log('  POST /api/orders/:id/remark   - 添加备注');
  console.log('  GET  /api/orders/capacity/verify/:ovenId/:date - 产能校验');
});

export default app;