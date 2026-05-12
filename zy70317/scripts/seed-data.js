const { initializeTables } = require('../database');
const services = require('../services');
const models = require('../models');

const sampleOrders = [
  { order_no: 'ORDER-2026-001', amount: 1000.00, type: 'normal' },
  { order_no: 'ORDER-2026-002', amount: 2500.50, type: 'missing_flow' },
  { order_no: 'ORDER-2026-003', amount: 5000.00, type: 'amount_mismatch' },
  { order_no: 'ORDER-2026-004', amount: 800.00, type: 'cancelled' }
];

(async () => {
  console.log('正在初始化数据库表...');
  await initializeTables();
  
  console.log('\n正在创建样例订单...');
  
  for (const sample of sampleOrders) {
    console.log(`  创建订单 ${sample.order_no}, 金额: ${sample.amount}`);
    await services.createBusinessOrder(sample.order_no, sample.amount);
    
    if (sample.type === 'normal' || sample.type === 'missing_flow' || sample.type === 'amount_mismatch') {
      console.log(`  模拟订单 ${sample.order_no} 支付完成`);
      await services.simulatePaymentComplete(sample.order_no);
    }
    
    if (sample.type === 'normal') {
      console.log(`  为订单 ${sample.order_no} 写入账务流水`);
      await services.writeAccountingFlow(sample.order_no, sample.amount, 'FLW-NORMAL-001');
    }
    
    if (sample.type === 'amount_mismatch') {
      console.log(`  为订单 ${sample.order_no} 写入金额不一致的流水 (实际 4800.00, 订单 5000.00)`);
      await services.writeAccountingFlow(sample.order_no, 4800.00, 'FLW-MISMATCH-001');
    }
    
    if (sample.type === 'cancelled') {
      console.log(`  模拟订单 ${sample.order_no} 支付完成后取消`);
      await services.simulatePaymentComplete(sample.order_no);
      await models.cancelOrder(sample.order_no);
    }
  }
  
  console.log('\n=== 样例数据创建完成 ===');
  console.log('\n订单类型说明:');
  console.log('  ORDER-2026-001: 正常订单 (已支付 + 有流水)');
  console.log('  ORDER-2026-002: 缺流水订单 (已支付 + 无流水)');
  console.log('  ORDER-2026-003: 金额不一致订单 (已支付 + 流水金额 4800.00 ≠ 订单金额 5000.00)');
  console.log('  ORDER-2026-004: 取消订单 (已支付后取消)');
  
  console.log('\n接下来运行: npm start 启动服务');
  console.log('然后执行: node scripts/test-demo.js 运行完整演示');
  
  process.exit(0);
})().catch(err => {
  console.error('初始化失败:', err);
  process.exit(1);
});
