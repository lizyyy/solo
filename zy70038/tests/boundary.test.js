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
config.defaultHoldTime = 2 * 1000;
config.maxHoldTime = 10 * 1000;
config.checkInterval = 500;

const { service, inventoryService, exceptionService, orderService } = require('../src/index');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('\n========================================');
  console.log('  边界条件测试');
  console.log('========================================\n');

  let timeoutOrderId = null;
  let timeoutPickupCode = null;

  try {
    setupTestEnvironment();
    
    console.log('【边界测试1】库存不足时无法创建订单');
    service.initInventory();
    const lowStockResult = service.createSelfPickupOrder(
      '001',
      [{ sku: 'SKU-A001', quantity: 999 }],
      '13800138002',
      '库存测试用户'
    );
    assertFail(lowStockResult, '库存不足时订单创建失败');
    assert(lowStockResult.details && lowStockResult.details.length > 0, '返回库存不足详情');
    console.log('');
    
    console.log('【边界测试2】无效门店无法创建订单');
    const invalidStoreResult = service.createSelfPickupOrder(
      '999',
      [{ sku: 'SKU-A001', quantity: 1 }],
      '13800138003'
    );
    assertFail(invalidStoreResult, '无效门店时订单创建失败');
    console.log('');
    
    console.log('【边界测试3】创建短超时订单（用于测试超时释放）');
    const shortTimeoutResult = service.createSelfPickupOrder(
      '001',
      [{ sku: 'SKU-A001', quantity: 1 }],
      '13800138004',
      '超时测试用户',
      2 * 1000
    );
    assertSuccess(shortTimeoutResult, '短超时订单创建成功');
    timeoutOrderId = shortTimeoutResult.order.orderId;
    timeoutPickupCode = shortTimeoutResult.order.pickupCode;
    console.log(`  📦 超时测试订单号: ${timeoutOrderId}`);
    console.log('');
    
    console.log('【边界测试4】等待订单超时（2秒）...');
    const invBefore = inventoryService.getInventory('001', 'SKU-A001');
    assertEqual(invBefore.reservedStock, 1, '超时前库存已预留');
    
    await sleep(3000);
    
    const expiredOrder = service.getOrder(timeoutOrderId);
    assert(expiredOrder.isExpired(), '订单已超时');
    console.log('');
    
    console.log('【边界测试5】超时订单无法核销');
    const expiredPickup = service.verifyAndPickup(
      timeoutPickupCode,
      '001',
      '店员'
    );
    assertFail(expiredPickup, '超时订单核销失败');
    console.log('');
    
    console.log('【边界测试6】执行超时释放，库存回补');
    const releaseResult = service.checkAndReleaseTimeouts('001');
    assertEqual(releaseResult.totalChecked, 1, '检查了1个待处理订单');
    assertEqual(releaseResult.releasedCount, 1, '成功释放1个订单');
    
    const releasedOrder = service.getOrder(timeoutOrderId);
    assertEqual(releasedOrder.status, 'timeout_released', '订单状态为超时释放');
    assertEqual(releasedOrder.stockRestored, true, '库存已回补');
    
    const invAfter = inventoryService.getInventory('001', 'SKU-A001');
    assertEqual(invAfter.reservedStock, 0, '释放后预留库存为0');
    assertEqual(invAfter.availableStock, invAfter.totalStock, '可用库存等于总库存（已完全回补）');
    console.log('');
    
    console.log('【边界测试7】已释放订单无法再次释放');
    const releaseAgain = service.checkAndReleaseTimeouts('001');
    assertEqual(releaseAgain.totalChecked, 0, '没有待处理订单可检查');
    console.log('');
    
    console.log('【边界测试8】验证异常记录可查询');
    const stats = service.getStatistics();
    assert(stats.total >= 0, '异常统计可获取');
    console.log(`  📊 异常总数: ${stats.total}`);
    console.log(`  📋 待处理: ${stats.unresolved}`);
    console.log('');
    
    console.log('【边界测试9】验证待处理列表可获取');
    const pendingList = service.getPendingList('001');
    assert(Array.isArray(pendingList), '待处理列表是数组');
    console.log(`  📝 门店001待处理项数: ${pendingList.length}`);
    console.log('');
    
    console.log('【边界测试10】导出超时复核报告');
    const timeoutReview = service.exportTimeoutReview();
    assertSuccess(timeoutReview, '超时复核报告导出成功');
    assert(timeoutReview.orderCount >= 1, '报告包含超时订单');
    console.log(`  📄 报告路径: ${timeoutReview.filepath}`);
    console.log(`  📦 报告订单数: ${timeoutReview.orderCount}`);
    console.log('');
    
    console.log('========================================');
    console.log('  ✅ 边界测试全部通过！');
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
}

runTests();
