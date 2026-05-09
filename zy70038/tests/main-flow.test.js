const path = require('path');
const { setupTestEnvironment, cleanupTestEnvironment, assert, assertEqual, assertSuccess, assertFail } = require('./helpers');

process.env.TEST_DATA_DIR = path.join(process.cwd(), 'data-test');
process.env.TEST_EXPORT_DIR = path.join(process.cwd(), 'exports-test');

delete require.cache[require.resolve('../src/config')];
delete require.cache[require.resolve('../src/storage/file-storage')];
delete require.cache[require.resolve('../src/services/pickup-code.service')];
delete require.cache[require.resolve('../src/services/inventory.service')];
delete require.cache[require.resolve('../src/services/order.service')];
delete require.cache[require.resolve('../src/services/exception.service')];
delete require.cache[require.resolve('../src/services/export.service')];
delete require.cache[require.resolve('../src/index')];

const config = require('../src/config');
config.dataDir = process.env.TEST_DATA_DIR || config.dataDir;
config.exportDir = process.env.TEST_EXPORT_DIR || config.exportDir;

const { service, inventoryService } = require('../src/index');

let orderId = null;
let pickupCode = null;

console.log('\n========================================');
console.log('  主流程测试');
console.log('========================================\n');

try {
  setupTestEnvironment();
  
  console.log('【步骤1】初始化库存');
  service.initInventory();
  const inv1 = inventoryService.getInventory('001', 'SKU-A001');
  assertEqual(inv1.availableStock, 100, 'SKU-A001 可用库存为 100');
  assertEqual(inv1.reservedStock, 0, 'SKU-A001 预留库存为 0');
  console.log('');
  
  console.log('【步骤2】创建自提订单');
  const createResult = service.createSelfPickupOrder(
    '001',
    [
      { sku: 'SKU-A001', quantity: 2 },
      { sku: 'SKU-B002', quantity: 1 }
    ],
    '13800138001',
    '张三',
    2 * 60 * 60 * 1000
  );
  assertSuccess(createResult, '订单创建成功');
  orderId = createResult.order.orderId;
  pickupCode = createResult.order.pickupCode;
  assert(pickupCode && pickupCode.length === 6, '生成6位自提码');
  assertEqual(createResult.order.status, 'pending', '订单状态为待核销');
  console.log(`  📦 订单号: ${orderId}`);
  console.log(`  🔑 自提码: ${pickupCode}`);
  console.log('');
  
  console.log('【步骤3】验证库存已预留');
  const inv1After = inventoryService.getInventory('001', 'SKU-A001');
  assertEqual(inv1After.availableStock, 98, 'SKU-A001 可用库存减2，变为 98');
  assertEqual(inv1After.reservedStock, 2, 'SKU-A001 预留库存加2，变为 2');
  const inv2After = inventoryService.getInventory('001', 'SKU-B002');
  assertEqual(inv2After.availableStock, 49, 'SKU-B002 可用库存减1，变为 49');
  assertEqual(inv2After.reservedStock, 1, 'SKU-B002 预留库存加1，变为 1');
  console.log('');
  
  console.log('【步骤4】客服延长保留时长');
  const extendResult = service.extendHoldTime(
    orderId,
    60,
    '客服小王',
    '客户堵车，请求延长1小时'
  );
  assertSuccess(extendResult, '延长成功');
  const extendedOrder = service.getOrder(orderId);
  assertEqual(extendedOrder.extensions.length, 1, '有1次延长记录');
  assertEqual(extendedOrder.extensions[0].extendedBy, '客服小王', '延长人记录正确');
  console.log('');
  
  console.log('【步骤5】到店核销');
  const pickupResult = service.verifyAndPickup(
    pickupCode,
    '001',
    '店员小李'
  );
  assertSuccess(pickupResult, '核销成功');
  assertEqual(pickupResult.order.status, 'picked_up', '订单状态为已核销');
  assert(pickupResult.order.pickedUpAt !== null, '核销时间已记录');
  assertEqual(pickupResult.order.pickedUpBy, '店员小李', '核销人记录正确');
  console.log('');
  
  console.log('【步骤6】验证库存已扣减');
  const inv1Pickup = inventoryService.getInventory('001', 'SKU-A001');
  assertEqual(inv1Pickup.reservedStock, 0, 'SKU-A001 预留库存扣减为 0');
  assertEqual(inv1Pickup.totalStock, 98, 'SKU-A001 总库存扣减为 98');
  const inv2Pickup = inventoryService.getInventory('001', 'SKU-B002');
  assertEqual(inv2Pickup.reservedStock, 0, 'SKU-B002 预留库存扣减为 0');
  assertEqual(inv2Pickup.totalStock, 49, 'SKU-B002 总库存扣减为 49');
  console.log('');
  
  console.log('【步骤7】验证已核销订单无法再次核销');
  const pickupAgain = service.verifyAndPickup(
    pickupCode,
    '001',
    '店员小李'
  );
  assertFail(pickupAgain, '已使用自提码无法再次核销');
  console.log('');
  
  console.log('【步骤8】生成业务复核报表');
  const dailyReport = service.exportDailyReport();
  assertSuccess(dailyReport, '日报导出成功');
  console.log(`  📄 日报路径: ${dailyReport.filepath}`);
  console.log('');
  
  console.log('========================================');
  console.log('  ✅ 主流程测试全部通过！');
  console.log('========================================\n');
  
  process.exit(0);
  
} catch (error) {
  console.error('\n❌ 测试失败:', error.message);
  console.error(error.stack);
  try {
    cleanupTestEnvironment();
  } catch (e) {}
  process.exit(1);
}
