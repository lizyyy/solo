const fs = require('fs');
const path = require('path');
const orderManager = require('../core/order-manager');
const inventoryManager = require('../core/inventory-manager');
const deliveryManager = require('../core/delivery-manager');
const reports = require('../output/reports');
const chalk = require('chalk');

function exportOrders(outputPath, options = {}) {
  const orders = orderManager.getOrders();
  const absolutePath = path.resolve(outputPath);
  
  fs.writeFileSync(absolutePath, JSON.stringify(orders, null, 2), 'utf-8');
  orderManager.addHistory('export', { type: 'orders', file: absolutePath });
  
  console.log(chalk.green(`✅ 订单导出成功: ${absolutePath}`));
  console.log(`   共 ${orders.length} 个订单`);
  
  return orders;
}

function exportInventory(outputPath) {
  const inventory = inventoryManager.getInventory();
  const absolutePath = path.resolve(outputPath);
  
  fs.writeFileSync(absolutePath, JSON.stringify(inventory, null, 2), 'utf-8');
  orderManager.addHistory('export', { type: 'inventory', file: absolutePath });
  
  console.log(chalk.green(`✅ 库存导出成功: ${absolutePath}`));
  console.log(`   共 ${inventory.length} 种花材`);
  
  return inventory;
}

function exportPickingList(outputPath) {
  const pickingList = reports.formatPickingList();
  const absolutePath = path.resolve(outputPath);
  
  fs.writeFileSync(absolutePath, pickingList, 'utf-8');
  orderManager.addHistory('export', { type: 'picking-list', file: absolutePath });
  
  console.log(chalk.green(`✅ 拣花单导出成功: ${absolutePath}`));
  
  return pickingList;
}

function exportReport(reportType, outputPath) {
  let content = '';
  
  switch (reportType) {
    case 'before':
      content = reports.formatBeforeFulfillment();
      break;
    case 'after':
      content = reports.formatAfterReplacement();
      break;
    case 'out':
      content = reports.formatOutOfStock();
      break;
    case 'all':
      content = [
        reports.formatBeforeFulfillment(),
        '',
        reports.formatAfterReplacement(),
        '',
        reports.formatOutOfStock()
      ].join('\n');
      break;
    default:
      console.log(chalk.red(`❌ 未知的报告类型: ${reportType}`));
      return null;
  }
  
  const absolutePath = path.resolve(outputPath);
  fs.writeFileSync(absolutePath, content, 'utf-8');
  orderManager.addHistory('export', { type: `report-${reportType}`, file: absolutePath });
  
  console.log(chalk.green(`✅ 报告导出成功: ${absolutePath}`));
  
  return content;
}

function handleExport(type, outputPath, options = {}) {
  try {
    switch (type) {
      case 'orders':
        return exportOrders(outputPath, options);
      case 'inventory':
        return exportInventory(outputPath);
      case 'picking-list':
        return exportPickingList(outputPath);
      case 'report':
        const reportType = options.report || 'all';
        return exportReport(reportType, outputPath);
      default:
        console.log(chalk.red(`❌ 未知的导出类型: ${type}`));
        console.log('可用类型: orders, inventory, picking-list, report');
        return null;
    }
  } catch (error) {
    console.log(chalk.red(`❌ 导出失败: ${error.message}`));
    return null;
  }
}

module.exports = {
  handleExport,
  exportOrders,
  exportInventory,
  exportPickingList,
  exportReport
};
