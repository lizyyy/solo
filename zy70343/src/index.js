const express = require('express');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api', routes);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`并发库存扣减 API 服务已启动: http://localhost:${PORT}`);
  console.log('');
  console.log('可用接口:');
  console.log('  POST /api/inventory/init    - 初始化商品库存');
  console.log('  GET  /api/inventory/:id     - 查询商品库存');
  console.log('  POST /api/orders/lock       - 下单锁定库存');
  console.log('  POST /api/orders/pay        - 支付确认');
  console.log('  POST /api/orders/cancel     - 取消订单释放库存');
  console.log('  POST /api/orders/timeout    - 超时关闭订单');
  console.log('  GET  /api/compensation/report - 补偿查询报告');
  console.log('');
});

module.exports = app;
