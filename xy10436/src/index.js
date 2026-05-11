const express = require('express');
const bodyParser = require('body-parser');
const db = require('./db');

const streamsRouter = require('./routes/streams');
const productsRouter = require('./routes/products');
const couponsRouter = require('./routes/coupons');
const promotionsRouter = require('./routes/promotions');
const ordersRouter = require('./routes/orders');
const statisticsRouter = require('./routes/statistics');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

app.use('/api/streams', streamsRouter);
app.use('/api/products', productsRouter);
app.use('/api/coupons', couponsRouter);
app.use('/api/promotions', promotionsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/statistics', statisticsRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const startServer = async () => {
  await db.init();
  
  app.listen(PORT, () => {
    console.log(`直播间优惠叠加 API 服务已启动: http://localhost:${PORT}`);
    console.log('');
    console.log('可用API端点:');
    console.log('  POST /api/streams          - 创建直播场次');
    console.log('  POST /api/products         - 创建商品');
    console.log('  POST /api/coupons          - 创建优惠券');
    console.log('  POST /api/promotions/full-reduction  - 创建满减规则');
    console.log('  POST /api/promotions/gift  - 创建赠品规则');
    console.log('  POST /api/orders/preview   - 订单试算');
    console.log('  POST /api/orders/confirm   - 确认订单');
    console.log('  POST /api/orders/:order_no/refund/partial - 部分退款');
    console.log('  POST /api/orders/:order_no/refund/full    - 整单退款');
    console.log('  GET  /api/statistics/stream/:stream_id    - 直播统计');
  });
};

startServer().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});
