const validation = require('../core/validation');
const reports = require('../output/reports');
const chalk = require('chalk');

function validateAll(options = {}) {
  const reportType = options.report || 'all';
  
  console.log('');
  
  if (reportType === 'all' || reportType === 'before') {
    console.log(reports.formatBeforeFulfillment());
    console.log('');
  }
  
  if (reportType === 'all' || reportType === 'after') {
    console.log(reports.formatAfterReplacement());
    console.log('');
  }
  
  if (reportType === 'all' || reportType === 'out') {
    console.log(reports.formatOutOfStock());
    console.log('');
  }
  
  const result = validation.validateAllOrders();
  return result;
}

function validateOrder(orderId) {
  const orderManager = require('../core/order-manager');
  const order = orderManager.getOrderById(orderId);
  
  if (!order) {
    console.log(chalk.red(`❌ 订单 ${orderId} 不存在`));
    return null;
  }
  
  const result = validation.validateOrder(orderId);
  
  console.log('');
  console.log(chalk.bold.blue(`══════════ 订单 ${orderId} 校验结果 ══════════`));
  console.log('');
  
  const status = result.valid ? chalk.green('✅ 校验通过') : chalk.red('❌ 校验失败');
  console.log(`状态: ${status}`);
  console.log('');
  
  if (result.issues.length === 0) {
    console.log(chalk.green('订单无问题'));
  } else {
    console.log(chalk.bold('📋 问题列表:'));
    result.issues.forEach((issue, idx) => {
      const severityColor = issue.severity === 'error' ? chalk.red : 
                            issue.severity === 'warning' ? chalk.yellow : chalk.blue;
      console.log(`  ${idx + 1}. ${severityColor(`[${issue.severity.toUpperCase()}] ${issue.message}`)}`);
    });
  }
  
  console.log('');
  
  return result;
}

module.exports = {
  validateAll,
  validateOrder
};
