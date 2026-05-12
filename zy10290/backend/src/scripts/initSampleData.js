const { run, get, all } = require('../database/db');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const { ORDER_STATUS, PAYMENT_STATUS, SHIPPING_STATUS, REFUND_STATUS, COMPENSATION_STATUS } = require('../utils/constants');
const InventoryService = require('../services/inventoryService');
const OrderService = require('../services/orderService');

async function initSampleData() {
  console.log('开始初始化样例数据...');

  const activityId = uuidv4();
  await run(`
    INSERT INTO flash_sale_activities (id, name, start_time, end_time, status)
    VALUES (?, ?, ?, ?, 'ended')
  `, [activityId, '五一社群秒杀活动', dayjs().subtract(3, 'day').format('YYYY-MM-DD HH:mm:ss'), dayjs().subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss')]);

  const product1Id = uuidv4();
  await run(`
    INSERT INTO flash_sale_products (id, activity_id, name, sku, original_price, flash_price, total_stock, available_stock, locked_stock, sold_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
  `, [product1Id, activityId, '限量版口红', 'SKU001', 299.00, 99.00, 100, 100, 0, 0]);

  const product2Id = uuidv4();
  await run(`
    INSERT INTO flash_sale_products (id, activity_id, name, sku, original_price, flash_price, total_stock, available_stock, locked_stock, sold_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
  `, [product2Id, activityId, '网红面膜套装', 'SKU002', 199.00, 59.00, 200, 200, 0, 0]);

  console.log('创建活动和商品完成');

  const users = [
    { userId: 'u001', userName: '张三', userPhone: '13800138001' },
    { userId: 'u002', userName: '李四', userPhone: '13800138002' },
    { userId: 'u003', userName: '王五', userPhone: '13800138003' },
    { userId: 'u004', userName: '赵六', userPhone: '13800138004' },
  ];

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const productId = i < 2 ? product1Id : product2Id;
    const quantity = i % 2 === 0 ? 1 : 2;
    
    const result = await OrderService.createOrder(activityId, productId, user.userId, user.userName, user.userPhone, quantity);
    if (result.success) {
      await OrderService.processPaymentCallback(result.orderId, `TXN${Date.now() + i}`, true);
      console.log(`创建并支付订单: ${result.orderNo} - ${user.userName}`);
    }
  }

  const timeoutResult = await OrderService.createOrder(activityId, product1Id, 'u005', '钱七', '13800138005', 1);
  if (timeoutResult.success) {
    await OrderService.processTimeoutOrder(timeoutResult.orderId);
    console.log(`创建超时释放订单: ${timeoutResult.orderNo}`);
  }

  const failedResult = await OrderService.createOrder(activityId, product2Id, 'u006', '孙八', '13800138006', 2);
  if (failedResult.success) {
    await OrderService.processPaymentCallback(failedResult.orderId, `TXN_FAIL_${Date.now()}`, false);
    await OrderService.applyCompensation(failedResult.orderId, 'kefu001', '客服小美', '用户支付时网络异常扣款成功但订单未创建');
    
    const apps = await all('SELECT * FROM compensation_applications WHERE order_id = ?', [failedResult.orderId]);
    if (apps && apps.length > 0) {
      await OrderService.rejectCompensation(apps[0].id, 'manager001', '张经理', '经核实库存已售罄，无法补单，已建议用户退款');
    }
    console.log(`创建补单被拒绝订单: ${failedResult.orderNo}`);
  }

  const refundResult = await OrderService.createOrder(activityId, product2Id, 'u007', '周九', '13800138007', 1);
  if (refundResult.success) {
    await OrderService.processPaymentCallback(refundResult.orderId, `TXN_REFUND_${Date.now()}`, true);
    await OrderService.shipOrder(refundResult.orderId, 'SF1234567890', 'warehouse001', '仓库管理员');
    await OrderService.processRefund(refundResult.orderId, 59.00, 'kefu002', '客服小丽', true);
    console.log(`创建发货后退款订单: ${refundResult.orderNo}`);
  }

  console.log('\n✅ 样例数据初始化完成！');
  console.log('包含场景：');
  console.log('1. 正常支付订单 x 4');
  console.log('2. 支付超时释放订单（库存已回滚）');
  console.log('3. 补单申请被拒绝订单');
  console.log('4. 发货后退款订单（库存已回滚）');
}

initSampleData().catch(console.error);
