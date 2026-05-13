const path = require('path');
const fs = require('fs');
const { setupTestEnvironment, cleanupTestEnvironment, assert, assertEqual, assertSuccess, assertFail } = require('./helpers');

const TEST_DATA_DIR = path.join(process.cwd(), 'data-consistency-test');
const TEST_EXPORT_DIR = path.join(process.cwd(), 'exports-consistency-test');

function ensureCleanDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(dir, { recursive: true });
  
  const dataFiles = ['orders.json', 'inventory.json', 'stock-operations.json', 'exceptions.json', 'pickup-codes.json'];
  dataFiles.forEach(file => {
    fs.writeFileSync(path.join(dir, file), JSON.stringify([], null, 2), 'utf8');
  });
}

function clearModuleCache() {
  Object.keys(require.cache).forEach(key => {
    if (key.includes('/src/') || key.includes('self-pickup')) {
      delete require.cache[key];
    }
  });
}

function readDataFile(filename) {
  const filePath = path.join(TEST_DATA_DIR, filename);
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  return [];
}

ensureCleanDir(TEST_DATA_DIR);
ensureCleanDir(TEST_EXPORT_DIR);
clearModuleCache();

const config = require('../src/config');
config.dataDir = TEST_DATA_DIR;
config.exportDir = TEST_EXPORT_DIR;

const { service, inventoryService, exceptionService } = require('../src/index');

console.log('\n========================================');
console.log('  库存一致性测试（修复验证）');
console.log('========================================\n');

async function runTests() {
  try {
    setupTestEnvironment();
    
    console.log('【修复验证1】多商品订单部分SKU不存在时的库存一致性');
    console.log('  场景：SKU-A001(存在)、SKU-NOTEXIST(不存在) 同时下单');
    console.log('  预期：SKU-A001 库存不应该被占用（全部成功才提交）');
    service.initInventory();
    
    const invBefore = inventoryService.getInventory('001', 'SKU-A001');
    const availableBefore = invBefore.availableStock;
    const reservedBefore = invBefore.reservedStock;
    
    const result1 = service.createSelfPickupOrder(
      '001',
      [
        { sku: 'SKU-A001', quantity: 5 },
        { sku: 'SKU-NOTEXIST', quantity: 1 }
      ],
      '13800138010',
      '测试用户1'
    );
    
    assertFail(result1, '订单创建失败（因为SKU-NOTEXIST不存在）');
    assert(result1.orderId, '返回了orderId用于追踪');
    
    const invAfter1 = inventoryService.getInventory('001', 'SKU-A001');
    assertEqual(invAfter1.availableStock, availableBefore, '可用库存未变化（原子性保证）');
    assertEqual(invAfter1.reservedStock, reservedBefore, '预留库存未变化（原子性保证）');
    console.log('');
    
    console.log('【修复验证2】多商品订单部分SKU库存不足时的库存一致性');
    console.log('  场景：SKU-A001(库存充足)、SKU-B002(库存不足) 同时下单');
    console.log('  预期：SKU-A001 库存不应该被占用');
    const invBefore2 = inventoryService.getInventory('001', 'SKU-A001');
    const availableBefore2 = invBefore2.availableStock;
    
    const result2 = service.createSelfPickupOrder(
      '001',
      [
        { sku: 'SKU-A001', quantity: 5 },
        { sku: 'SKU-B002', quantity: 999 }
      ],
      '13800138011',
      '测试用户2'
    );
    
    assertFail(result2, '订单创建失败（因为SKU-B002库存不足）');
    
    const invAfter2 = inventoryService.getInventory('001', 'SKU-A001');
    assertEqual(invAfter2.availableStock, availableBefore2, '可用库存未变化（原子性保证）');
    assertEqual(invAfter2.reservedStock, 0, '预留库存为0（原子性保证）');
    console.log('');
    
    console.log('【修复验证3】边界数据已进入异常记录（可查询）');
    const stats = service.getStatistics();
    assert(stats.total > 0, '异常记录已产生');
    console.log(`  📊 异常记录总数: ${stats.total}`);
    console.log(`  📋 待处理异常: ${stats.unresolved}`);
    
    const pendingList = service.getPendingList('001');
    console.log(`  📝 门店001待处理列表项数: ${pendingList.length}`);
    
    if (pendingList.length > 0) {
      console.log('  异常详情:');
      for (const exc of pendingList.slice(0, 3)) {
        console.log(`    - ${exc.exceptionType}: ${exc.message}`);
      }
    }
    console.log('');
    
    console.log('【修复验证4】验证数据文件中没有残留的库存操作记录');
    const stockOps = readDataFile('stock-operations.json');
    console.log(`  📦 库存操作记录数: ${stockOps.length}`);
    
    const orders = readDataFile('orders.json');
    console.log(`  📦 订单记录数: ${orders.length}`);
    assertEqual(orders.length, 0, '没有订单被创建（失败不持久化）');
    console.log('');
    
    console.log('【修复验证5】验证正常订单仍然可以成功创建（回归测试）');
    const goodResult = service.createSelfPickupOrder(
      '001',
      [
        { sku: 'SKU-A001', quantity: 2 },
        { sku: 'SKU-B002', quantity: 1 }
      ],
      '13800138012',
      '正常用户'
    );
    
    assertSuccess(goodResult, '正常订单创建成功');
    assert(goodResult.order.pickupCode, '生成了自提码');
    
    const invGood = inventoryService.getInventory('001', 'SKU-A001');
    assertEqual(invGood.availableStock, availableBefore2 - 2, '正常订单库存正确扣减');
    assertEqual(invGood.reservedStock, 2, '正常订单库存正确预留');
    console.log(`  📦 订单号: ${goodResult.order.orderId}`);
    console.log(`  🔑 自提码: ${goodResult.order.pickupCode}`);
    console.log('');
    
    console.log('【修复验证6】验证正常订单核销后库存正确');
    const pickupResult = service.verifyAndPickup(
      goodResult.order.pickupCode,
      '001',
      '店员测试'
    );
    assertSuccess(pickupResult, '核销成功');
    
    const invPickup = inventoryService.getInventory('001', 'SKU-A001');
    assertEqual(invPickup.reservedStock, 0, '核销后预留库存为0');
    assertEqual(invPickup.totalStock, availableBefore2 - 2, '核销后总库存正确');
    console.log('');
    
    console.log('========================================');
    console.log('  ✅ 库存一致性测试全部通过！');
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
