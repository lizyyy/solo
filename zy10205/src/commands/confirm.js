const replacementCalculator = require('../core/replacement-calculator');
const orderManager = require('../core/order-manager');
const deliveryManager = require('../core/delivery-manager');
const validation = require('../core/validation');
const chalk = require('chalk');

function confirmReplacement(orderId, options = {}) {
  const order = orderManager.getOrderById(orderId);
  
  if (!order) {
    console.log(chalk.red(`❌ 订单 ${orderId} 不存在`));
    return { success: false };
  }
  
  const confirmations = deliveryManager.getOrderConfirmations(orderId);
  const existingReplacement = confirmations.find(c => c.confirmationType === 'replacement');
  
  if (existingReplacement) {
    console.log(chalk.yellow(`⚠ 订单 ${orderId} 的花材替换已确认过，不会重复处理`));
    return { success: false, duplicate: true };
  }
  
  const replacementData = replacementCalculator.calculateReplacementForOrder(orderId);
  
  if (!replacementData || replacementData.replacements.length === 0) {
    console.log(chalk.green(`✅ 订单 ${orderId} 花材充足，无需替换`));
    return { success: true, noReplacementNeeded: true };
  }
  
  const confirmedBy = options.by || '系统';
  const result = replacementCalculator.confirmReplacement(orderId, replacementData, confirmedBy);
  
  if (result.success) {
    console.log(chalk.green(`✅ 订单 ${orderId} 花材替换确认成功`));
    console.log('');
    console.log(chalk.bold('📦 替换详情:'));
    replacementData.replacements.forEach((rep, idx) => {
      console.log(`  ${idx + 1}. ${rep.originalFlower} (${rep.quantity}枝) → ${rep.replacementFlower}`);
    });
    
    if (replacementData.needsPriceSync) {
      console.log('');
      console.log(chalk.yellow(`⚠️ 需要同步价格: +${replacementData.totalPriceDiff} 元`));
      console.log(chalk.blue(`   请执行: flower-shop confirm price ${orderId} --new-price ${order.price + replacementData.totalPriceDiff}`));
    }
    
    return { success: true, replacementData };
  } else {
    console.log(chalk.red(`❌ 确认失败: ${result.message}`));
    return { success: false, message: result.message };
  }
}

function confirmPrice(orderId, newPrice, options = {}) {
  const order = orderManager.getOrderById(orderId);
  
  if (!order) {
    console.log(chalk.red(`❌ 订单 ${orderId} 不存在`));
    return { success: false };
  }
  
  const confirmations = deliveryManager.getOrderConfirmations(orderId);
  const existingPrice = confirmations.find(c => c.confirmationType === 'price_sync');
  
  if (existingPrice) {
    console.log(chalk.yellow(`⚠ 订单 ${orderId} 的价格已确认过，不会重复处理`));
    return { success: false, duplicate: true };
  }
  
  const originalPrice = validation.calculateOrderOriginalPrice(order);
  
  if (typeof newPrice === 'undefined' || newPrice === null) {
    const replacementData = replacementCalculator.calculateReplacementForOrder(orderId);
    const priceDiff = replacementData?.totalPriceDiff || 0;
    newPrice = originalPrice + priceDiff;
    console.log(chalk.blue(`ℹ️ 使用自动计算价格: ${newPrice} 元 (原价格: ${originalPrice} 元, 差价: +${priceDiff} 元)`));
  }
  
  const confirmedBy = options.by || '系统';
  const result = replacementCalculator.confirmPriceSync(orderId, Number(newPrice), confirmedBy);
  
  if (result.success) {
    console.log(chalk.green(`✅ 订单 ${orderId} 价格同步确认成功`));
    console.log(`   新价格: ${newPrice} 元`);
    return { success: true };
  } else {
    console.log(chalk.red(`❌ 确认失败: ${result.message}`));
    return { success: false, message: result.message };
  }
}

function confirmAll(options = {}) {
  const orders = orderManager.getOrders().filter(o => o.status !== 'cancelled');
  let confirmedCount = 0;
  let duplicateCount = 0;
  let failedCount = 0;
  
  console.log(chalk.bold('════════════════════════════════════════════'));
  console.log(chalk.bold('           批量确认花材替换'));
  console.log(chalk.bold('════════════════════════════════════════════'));
  console.log('');
  
  orders.forEach(order => {
    const result = confirmReplacement(order.orderId, options);
    if (result.success) {
      confirmedCount++;
    } else if (result.duplicate) {
      duplicateCount++;
    } else if (!result.noReplacementNeeded) {
      failedCount++;
    }
    console.log('');
  });
  
  console.log('');
  console.log(chalk.bold('📊 批量确认结果:'));
  console.log(`  确认成功: ${confirmedCount} 个`);
  console.log(`  已确认过: ${duplicateCount} 个`);
  console.log(`  失败: ${failedCount} 个`);
  
  return { confirmedCount, duplicateCount, failedCount };
}

module.exports = {
  confirmReplacement,
  confirmPrice,
  confirmAll
};
