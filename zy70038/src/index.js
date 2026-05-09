const orderService = require('./services/order.service');
const inventoryService = require('./services/inventory.service');
const pickupCodeService = require('./services/pickup-code.service');
const exceptionService = require('./services/exception.service');
const exportService = require('./services/export.service');
const config = require('./config');

class SelfPickupTimeoutService {
  initInventory() {
    inventoryService.createOrUpdateInventory('001', 'SKU-A001', 100);
    inventoryService.createOrUpdateInventory('001', 'SKU-B002', 50);
    inventoryService.createOrUpdateInventory('002', 'SKU-A001', 80);
    inventoryService.createOrUpdateInventory('003', 'SKU-C003', 200);
    console.log('✅ 示例库存数据已初始化');
  }
  
  createSelfPickupOrder(storeId, items, customerPhone, customerName = '', holdTime = null) {
    return orderService.createOrder({
      storeId: storeId,
      items: items,
      customerPhone: customerPhone,
      customerName: customerName,
      holdTime: holdTime
    });
  }
  
  verifyAndPickup(pickupCode, storeId, operator = 'unknown') {
    return orderService.validateAndPickup(pickupCode, storeId, operator);
  }
  
  extendHoldTime(orderId, additionalMinutes, extendedBy, reason) {
    return orderService.extendOrder(
      orderId,
      additionalMinutes * 60 * 1000,
      extendedBy,
      reason
    );
  }
  
  checkAndReleaseTimeouts(storeId = null) {
    return orderService.checkAndReleaseExpired(storeId);
  }
  
  getOrder(orderId) {
    return orderService.getOrder(orderId);
  }
  
  getPendingList(storeId = null) {
    return exceptionService.getPendingList(storeId);
  }
  
  resolveException(exceptionId, resolvedBy, notes = '') {
    return exceptionService.resolveException(exceptionId, resolvedBy, notes);
  }
  
  getStatistics() {
    return exceptionService.getStatistics();
  }
  
  exportTimeoutReview(startDate = null, endDate = null) {
    return exportService.exportTimeoutReleasedOrders(startDate, endDate);
  }
  
  exportDailyReport(date = null) {
    return exportService.exportDailySummary(date);
  }
}

const service = new SelfPickupTimeoutService();

function formatHelp() {
  console.log('\n========================================');
  console.log('  到店自提超时释放服务 - 使用说明');
  console.log('========================================\n');
  console.log('核心服务:');
  console.log('  service.initInventory()               - 初始化示例库存');
  console.log('  service.createSelfPickupOrder()       - 创建自提订单');
  console.log('  service.verifyAndPickup()             - 到店核销');
  console.log('  service.extendHoldTime()              - 客服延长');
  console.log('  service.checkAndReleaseTimeouts()     - 超时检测与释放');
  console.log('');
  console.log('查询与导出:');
  console.log('  service.getOrder(orderId)             - 查询订单详情');
  console.log('  service.getPendingList(storeId)       - 获取待处理列表');
  console.log('  service.getStatistics()               - 获取异常统计');
  console.log('  service.exportTimeoutReview()         - 导出超时复核报告');
  console.log('  service.exportDailyReport()           - 导出日报');
  console.log('');
  console.log('数据文件位置:');
  console.log(`  订单数据: ${config.dataDir}/orders.json`);
  console.log(`  库存数据: ${config.dataDir}/inventory.json`);
  console.log(`  异常记录: ${config.dataDir}/exceptions.json`);
  console.log(`  自提码:   ${config.dataDir}/pickup-codes.json`);
  console.log(`  导出文件: ${config.exportDir}/`);
  console.log('\n运行测试:');
  console.log('  npm run test                          - 运行全部测试');
  console.log('  npm run test:main                     - 运行主流程测试');
  console.log('  npm run test:boundary                 - 运行边界测试');
  console.log('');
}

module.exports = {
  service,
  SelfPickupTimeoutService,
  orderService,
  inventoryService,
  pickupCodeService,
  exceptionService,
  exportService,
  config,
  formatHelp
};

if (require.main === module) {
  formatHelp();
}
