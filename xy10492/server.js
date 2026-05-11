const express = require('express');
const { initSampleData } = require('./storage');
const {
  createCoupon,
  bindStores,
  refundCoupon,
  redeemCoupon,
  queryAbnormal,
  getStatistics
} = require('./service');

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

initSampleData();

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '团购核销防串码API运行中' });
});

app.post('/api/coupons', (req, res) => {
  const coupon = createCoupon(req.body);
  res.json({
    success: true,
    data: coupon,
    message: '券码创建成功'
  });
});

app.post('/api/coupons/:couponId/bind', (req, res) => {
  const { couponId } = req.params;
  const { storeIds } = req.body;
  
  if (!storeIds || !Array.isArray(storeIds) || storeIds.length === 0) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_PARAMS', message: '请提供有效的门店ID列表', type: 'SYSTEM' }
    });
  }
  
  const result = bindStores(couponId, storeIds);
  
  if (!result.success) {
    return res.status(400).json(result);
  }
  
  res.json(result);
});

app.post('/api/coupons/:couponId/refund', (req, res) => {
  const { couponId } = req.params;
  const result = refundCoupon(couponId);
  
  if (!result.success) {
    return res.status(400).json(result);
  }
  
  res.json({
    success: true,
    data: result.coupon,
    message: '退款成功'
  });
});

app.post('/api/coupons/redeem', (req, res) => {
  const { couponCode, storeId, requestId } = req.body;
  
  if (!couponCode) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_PARAMS', message: '请提供券码', type: 'SYSTEM' }
    });
  }
  
  if (!storeId) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_PARAMS', message: '请提供门店ID', type: 'SYSTEM' }
    });
  }
  
  const result = redeemCoupon(couponCode, storeId, requestId);
  
  if (!result.success) {
    return res.status(403).json({
      success: false,
      error: result.error
    });
  }
  
  res.json({
    success: true,
    data: result.coupon,
    message: '核销成功'
  });
});

app.get('/api/coupons/:couponId/abnormal', (req, res) => {
  const { couponId } = req.params;
  const logs = queryAbnormal(couponId);
  
  res.json({
    success: true,
    data: logs,
    total: logs.length
  });
});

app.get('/api/statistics', (req, res) => {
  const stats = getStatistics();
  
  res.json({
    success: true,
    data: stats
  });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`团购核销防串码API服务器已启动: http://localhost:${PORT}`);
  console.log('\n预设数据说明:');
  console.log('  门店 STORE001: 美味轩中餐厅（上海）');
  console.log('  门店 STORE002: 北京烤鸭店（北京）');
  console.log('  门店 STORE003: 欢乐亲子乐园（上海）');
  console.log('  门店 STORE004: 宝贝王国（北京）');
  console.log('\n  券码 FOOD-SH-001-ABC123: 上海餐饮券（ACTIVE）');
  console.log('  券码 FOOD-BJ-002-XYZ789: 北京餐饮券（ACTIVE）');
  console.log('  券码 FAMILY-SH-003-DEF456: 上海亲子券（ACTIVE）');
  console.log('  券码 FAMILY-BJ-004-GHI012: 北京亲子券（REFUNDED）');
  console.log('  券码 FOOD-SH-005-JKL345: 上海餐饮券（REDEEMED）');
});
