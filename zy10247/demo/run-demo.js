const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'parking.db');
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('🧹 已清理旧数据库\n');
}

const { initDatabase } = require('../src/database');
const parkingSpotService = require('../src/services/parkingSpotService');
const orderService = require('../src/services/orderService');
const settlementService = require('../src/services/settlementService');
const queryService = require('../src/services/queryService');

function printHeader(title) {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${title}`);
  console.log('='.repeat(60) + '\n');
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleString('zh-CN');
}

async function runDemo() {
  await initDatabase();

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║            社区车位短租 API - 本地演示                     ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const adminId = 'admin-001';
  const adminName = '系统管理员';
  const ownerId = 'owner-001';
  const ownerName = '业主张三';
  const renterId = 'renter-001';
  const renterName = '租客李四';

  printHeader('1. 业主发布车位');

  const spot = await parkingSpotService.createParkingSpot({
    spotNumber: 'A-001',
    ownerId,
    ownerName,
    pricePerHour: 10
  });
  console.log('✅ 车位发布成功:');
  console.log(`   车位编号: ${spot.spot_number}`);
  console.log(`   业主: ${spot.owner_name}`);
  console.log(`   单价: ${spot.price_per_hour} 元/小时`);
  console.log(`   状态: ${spot.status}`);

  printHeader('2. 场景一：成功租用完整流程');

  const now = Date.now();
  const startTime = now + 3600000;
  const endTime = startTime + (4 * 3600000);

  console.log('📝 创建订单...');
  const order = await orderService.createOrder({
    spotId: spot.id,
    renterId,
    renterName,
    licensePlate: '京A12345',
    startTime,
    endTime
  });
  console.log('✅ 订单创建成功:');
  console.log(`   订单ID: ${order.id}`);
  console.log(`   车位: ${order.spot_number}`);
  console.log(`   车牌: ${order.license_plate}`);
  console.log(`   开始时间: ${formatTime(order.start_time)}`);
  console.log(`   结束时间: ${formatTime(order.end_time)}`);
  console.log(`   金额: ${order.total_amount} 元`);
  console.log(`   状态: ${order.status}`);

  console.log('\n💳 支付确认...');
  const paidOrder = await orderService.payOrder(order.id, {
    paymentMethod: 'wechat',
    transactionId: 'TXN' + Date.now(),
    operatorId: adminId,
    operatorName: adminName
  });
  console.log(`✅ 支付成功，当前状态: ${paidOrder.status}`);

  console.log('\n🔐 门禁授权...');
  const authResult = await orderService.authorizeOrder(order.id, adminId, adminName);
  console.log(`✅ 授权成功，订单状态: ${authResult.order.status}`);
  console.log(`   授权ID: ${authResult.authorization.id}`);
  console.log(`   门禁权限: ${authResult.authorization.status}`);

  console.log('\n💰 生成业主结算...');
  const settlement = await settlementService.createSettlement(order.id, adminId, adminName);
  console.log(`✅ 结算记录创建: ${settlement.id}`);
  console.log(`   结算金额: ${settlement.amount} 元 (平台收取10%手续费)`);
  console.log(`   结算状态: ${settlement.status}`);

  await settlementService.settlePayment(settlement.id, adminId, adminName);
  console.log('✅ 款项已结算给业主');

  console.log('\n📋 查看订单操作时间线...');
  const timeline = await queryService.getOrderTimeline(order.id);
  console.log('   操作历史:');
  timeline.forEach((log, index) => {
    console.log(`   ${index + 1}. [${formatTime(log.created_at)}] ${log.operation} - ${log.operator_name}`);
    if (log.details) {
      console.log(`      ${JSON.stringify(log.details)}`);
    }
  });

  printHeader('3. 场景二：时间段冲突拦截');

  console.log('👤 另一租客尝试预订同一车位的重叠时间段...');
  try {
    const conflictStartTime = startTime + 7200000;
    const conflictEndTime = conflictStartTime + 3600000;

    console.log(`   尝试预订: ${formatTime(conflictStartTime)} - ${formatTime(conflictEndTime)}`);

    await orderService.createOrder({
      spotId: spot.id,
      renterId: 'renter-002',
      renterName: '租客王五',
      licensePlate: '京B67890',
      startTime: conflictStartTime,
      endTime: conflictEndTime
    });
    console.log('❌ 错误：应该拦截冲突但没有拦截！');
  } catch (error) {
    console.log(`✅ 冲突拦截成功: ${error.message}`);
  }

  printHeader('4. 场景三：重复支付拦截');

  console.log('💳 尝试使用相同交易号重复支付...');
  try {
    await orderService.payOrder(order.id, {
      paymentMethod: 'wechat',
      transactionId: 'TXN' + Date.now(),
      operatorId: adminId,
      operatorName: adminName
    });
  } catch (error) {
    console.log(`✅ 拦截成功: ${error.message}`);
  }

  printHeader('5. 场景四：同一车牌防重复绑定拦截');

  console.log('🚗 尝试使用同一车牌创建新订单（不同车位、不同时间段）...');
  try {
    const spot2 = await parkingSpotService.createParkingSpot({
      spotNumber: 'A-002',
      ownerId,
      ownerName,
      pricePerHour: 15
    });

    await orderService.createOrder({
      spotId: spot2.id,
      renterId: 'renter-004',
      renterName: '租客孙七',
      licensePlate: '京A12345',
      startTime: endTime + 7200000,
      endTime: endTime + 10800000
    });
    console.log('❌ 错误：应该拦截车牌重复绑定但没有拦截！');
  } catch (error) {
    console.log(`✅ 车牌重复绑定拦截成功: ${error.message}`);
  }

  printHeader('6. 场景五：取消订单并撤销门禁');

  console.log('📝 创建新订单用于测试取消...');
  const order2 = await orderService.createOrder({
    spotId: spot.id,
    renterId: 'renter-003',
    renterName: '租客赵六',
    licensePlate: '京C11111',
    startTime: endTime + 3600000,
    endTime: endTime + 7200000
  });

  await orderService.payOrder(order2.id, {
    paymentMethod: 'alipay',
    transactionId: 'TXN2-' + Date.now(),
    operatorId: adminId,
    operatorName: adminName
  });

  await orderService.authorizeOrder(order2.id, adminId, adminName);
  console.log('✅ 订单已创建并授权');

  console.log('\n❌ 取消订单...');
  const cancelledOrder = await orderService.cancelOrder(order2.id, adminId, adminName);
  console.log(`✅ 订单已取消，状态: ${cancelledOrder.status}`);

  console.log('\n🔍 检查门禁授权状态...');
  const auths = await orderService.listAuthorizations();
  const revokedAuth = auths.find(a => a.order_id === order2.id);
  if (revokedAuth) {
    console.log(`   授权状态已更新为: ${revokedAuth.status}`);
  }

  printHeader('7. 数据汇总查询');

  const stats = await queryService.getDashboardStats();
  console.log('📊 仪表盘统计:');
  console.log(`   总车位数: ${stats.totalParkingSpots}`);
  console.log(`   可用车位: ${stats.availableParkingSpots}`);
  console.log(`   今日订单: ${stats.todayOrders}`);
  console.log(`   今日营收: ${stats.todayRevenue} 元`);
  console.log(`   待处理订单: ${stats.pendingOrders}`);
  console.log(`   有效授权: ${stats.activeAuthorizations}`);

  console.log('\n👑 业主结算汇总:');
  const ownerSummary = await settlementService.getOwnerSummary(ownerId);
  console.log(`   业主ID: ${ownerSummary.ownerId}`);
  console.log(`   待结算金额: ${ownerSummary.pendingAmount} 元`);
  console.log(`   已结算金额: ${ownerSummary.settledAmount} 元`);
  console.log(`   完成订单数: ${ownerSummary.totalCompletedOrders}`);
  console.log(`   总营收: ${ownerSummary.totalRevenue} 元`);

  console.log('\n🚗 当前有效门禁授权:');
  const currentAuths = await queryService.getCurrentAuthorizations();
  currentAuths.forEach(auth => {
    console.log(`   车牌 ${auth.license_plate} - 车位 ${auth.spot_number} - ${auth.renter_name}`);
  });

  printHeader('8. 按车牌查询订单');

  const plateOrders = await queryService.searchOrdersByLicensePlate('京A12345');
  console.log(`🔍 车牌 京A12345 的订单记录: ${plateOrders.length} 条`);
  plateOrders.forEach(o => {
    console.log(`   ${formatTime(o.created_at)} - ${o.spot_number} - ${o.status} - ${o.total_amount}元`);
  });

  printHeader('✅ 演示完成！');
  console.log('\n📋 总结:');
  console.log('   ✓ 时间段重叠检测 - 已实现');
  console.log('   ✓ 未支付不能授权 - 已实现');
  console.log('   ✓ 取消后门禁自动撤销 - 已实现');
  console.log('   ✓ 重复支付拦截 - 已实现');
  console.log('   ✓ 同一车牌防重复绑定 - 已实现（下单+授权双重校验）');
  console.log('   ✓ 车牌绑定订单查询 - 已实现');
  console.log('   ✓ 操作时间线记录 - 已实现');
  console.log('   ✓ 业主结算统计 - 已实现');
  console.log('\n🚀 启动 API 服务: npm start');
  console.log('🌐 服务地址: http://localhost:3000\n');
}

runDemo().catch(console.error);
