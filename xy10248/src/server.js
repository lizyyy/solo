const express = require('express');
const bodyParser = require('body-parser');

const ordersRouter = require('./routes/orders');
const claimsRouter = require('./routes/claims');
const devicesRouter = require('./routes/devices');
const couponsRouter = require('./routes/coupons');
const statsRouter = require('./routes/stats');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.use('/api/orders', ordersRouter);
app.use('/api/claims', claimsRouter);
app.use('/api/devices', devicesRouter);
app.use('/api/coupons', couponsRouter);
app.use('/api/stats', statsRouter);

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'laundry-claim-api',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  自助洗衣店故障赔付 API 服务已启动`);
  console.log(`  服务地址: http://localhost:${PORT}`);
  console.log(`  健康检查: http://localhost:${PORT}/health`);
  console.log(`========================================\n`);
  console.log(`API 接口:`);
  console.log(`  POST   /api/orders              - 创建洗衣订单`);
  console.log(`  GET    /api/orders              - 查询订单列表`);
  console.log(`  GET    /api/orders/:orderNo     - 查询订单详情`);
  console.log(`  POST   /api/orders/:orderNo/advance - 推进订单状态`);
  console.log(`  POST   /api/orders/:orderNo/progress - 模拟洗衣进度`);
  console.log(``);
  console.log(`  POST   /api/claims              - 创建赔付申请`);
  console.log(`  GET    /api/claims              - 查询赔付列表`);
  console.log(`  GET    /api/claims/:claimNo     - 查询赔付详情`);
  console.log(`  POST   /api/claims/:claimNo/review - 审核赔付`);
  console.log(`  POST   /api/claims/:claimNo/compensate - 发放补偿`);
  console.log(`  POST   /api/claims/:claimNo/withdraw - 撤回申请`);
  console.log(`  POST   /api/claims/:claimNo/correct - 修正赔付`);
  console.log(``);
  console.log(`  POST   /api/devices/:deviceId/logs - 上报设备日志`);
  console.log(`  GET    /api/devices/:deviceId/logs - 查询设备日志`);
  console.log(``);
  console.log(`  POST   /api/coupons             - 发放优惠券`);
  console.log(`  GET    /api/coupons             - 查询优惠券`);
  console.log(``);
  console.log(`  GET    /api/stats               - 统计汇总`);
  console.log(`  GET    /api/stats/export        - 导出全量数据`);
  console.log(`  POST   /api/stats/reset         - 重置所有数据`);
  console.log(`\n`);
});

module.exports = app;
