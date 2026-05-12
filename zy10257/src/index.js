const express = require('express');
const memberRoutes = require('./routes/memberRoutes');
const syncRoutes = require('./routes/syncRoutes');
const db = require('./models/database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api/members', memberRoutes);
app.use('/api/sync', syncRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '跨店会员权益同步API运行正常',
    timestamp: new Date(),
    version: '1.0.0'
  });
});

app.get('/api/stores', (req, res) => {
  const stores = db.getAllStores();
  res.json({ success: true, data: stores });
});

app.listen(PORT, () => {
  console.log(`🚀 跨店会员权益同步API已启动，端口: ${PORT}`);
  console.log(`📊 已初始化门店: ${db.getAllStores().length} 个`);
  console.log(`👤 示例会员ID: member_001`);
  console.log(`🎫 示例券ID: coupon_001, coupon_002`);
  console.log(`\n📖 API文档:`);
  console.log(`  GET  /api/health                  - 健康检查`);
  console.log(`  GET  /api/stores                  - 门店列表`);
  console.log(`  GET  /api/members/:id/summary     - 会员汇总`);
  console.log(`  GET  /api/members/:id/coupons     - 会员券列表`);
  console.log(`  POST /api/members/coupon/redeem   - 核销券`);
  console.log(`  POST /api/sync/batch              - 提交离线批次`);
  console.log(`  GET  /api/sync/status             - 同步状态`);
  console.log(`  GET  /api/sync/conflicts          - 冲突列表`);
});

module.exports = app;
