const validation = require('../core/validation');
const replacementCalculator = require('../core/replacement-calculator');
const orderManager = require('../core/order-manager');
const inventoryManager = require('../core/inventory-manager');
const chalk = require('chalk');

function formatBeforeFulfillment() {
  const validationResult = validation.validateAllOrders();
  const inventoryStatus = validationResult.inventoryStatus;
  
  const lines = [];
  lines.push(chalk.bold.blue('════════════════════════════════════════════'));
  lines.push(chalk.bold.blue('         配货前检查报告 (Before Fulfillment)'));
  lines.push(chalk.bold.blue('════════════════════════════════════════════'));
  lines.push('');
  lines.push(chalk.bold('📊 订单汇总'));
  lines.push(`  总订单数: ${validationResult.summary.total}`);
  lines.push(`  有效订单: ${validationResult.summary.valid}`);
  lines.push(`  有问题订单: ${validationResult.summary.withIssues}`);
  lines.push('');
  
  lines.push(chalk.bold('🌷 花材库存状态'));
  if (inventoryStatus.summary.length === 0) {
    lines.push('  暂无花材需求');
  } else {
    inventoryStatus.summary.forEach(item => {
      const status = item.hasShortage ? chalk.red('❌ 不足') : chalk.green('✅ 充足');
      lines.push(`  ${item.flowerName}: 需求 ${item.required} 枝 / 库存 ${item.stock} 枝 ${status}`);
      if (item.shortage > 0) {
        lines.push(`    缺口: ${item.shortage} 枝`);
        if (item.replacementOptions.length > 0) {
          lines.push(`    可替换: ${item.replacementOptions.map(r => r.name).join(', ')}`);
        } else {
          lines.push(`    ⚠️ 无可替换花材！`);
        }
      }
    });
  }
  lines.push('');
  
  lines.push(chalk.bold('📋 订单详情'));
  validationResult.details.forEach(detail => {
    const status = detail.valid ? chalk.green('✓ 有效') : chalk.red('✗ 无效');
    lines.push(`\n  订单 ${detail.orderId}: ${status}`);
    
    detail.issues.forEach(issue => {
      const severityColor = issue.severity === 'error' ? chalk.red : 
                            issue.severity === 'warning' ? chalk.yellow : chalk.blue;
      lines.push(`    ${severityColor(`[${issue.severity.toUpperCase()}] ${issue.message}`)}`);
    });
  });
  
  return lines.join('\n');
}

function formatAfterReplacement() {
  const replacements = replacementCalculator.calculateReplacementsForAllOrders();
  const ordersWithReplacements = replacements.filter(r => r.replacements.length > 0);
  
  const lines = [];
  lines.push(chalk.bold.green('════════════════════════════════════════════'));
  lines.push(chalk.bold.green('         替换后确认报告 (After Replacement)'));
  lines.push(chalk.bold.green('════════════════════════════════════════════'));
  lines.push('');
  
  if (ordersWithReplacements.length === 0) {
    lines.push(chalk.green('✅ 所有订单花材充足，无需替换'));
    return lines.join('\n');
  }
  
  lines.push(chalk.bold('📦 花材替换汇总'));
  lines.push(`  需要替换的订单数: ${ordersWithReplacements.length}`);
  const totalPriceDiff = replacements.reduce((sum, r) => sum + r.totalPriceDiff, 0);
  lines.push(`  价格调整总额: ${totalPriceDiff >= 0 ? '+' : ''}${totalPriceDiff} 元`);
  lines.push('');
  
  replacements.forEach(r => {
    if (r.replacements.length > 0) {
      lines.push(chalk.bold(`\n  📝 订单 ${r.orderId}`));
      r.replacements.forEach(rep => {
        lines.push(`    ${rep.originalFlower} (${rep.quantity}枝) → ${rep.replacementFlower}`);
        if (rep.note) {
          lines.push(`      备注: ${rep.note}`);
        }
      });
      if (r.needsPriceSync) {
        lines.push(chalk.yellow(`    ⚠️ 需要同步价格: +${r.totalPriceDiff} 元`));
      }
    }
  });
  
  return lines.join('\n');
}

function formatOutOfStock() {
  const validationResult = validation.validateAllOrders();
  const ordersWithNoReplacement = validationResult.details.filter(d => {
    return d.issues.some(i => i.type === 'inventory_shortage_no_replacement');
  });
  
  const lines = [];
  lines.push(chalk.bold.red('════════════════════════════════════════════'));
  lines.push(chalk.bold.red('         缺货待确认报告 (Out of Stock)'));
  lines.push(chalk.bold.red('════════════════════════════════════════════'));
  lines.push('');
  
  if (ordersWithNoReplacement.length === 0) {
    lines.push(chalk.green('✅ 所有缺货订单都有可替换花材'));
    return lines.join('\n');
  }
  
  lines.push(chalk.red.bold(`⚠️ 有 ${ordersWithNoReplacement.length} 个订单缺货且无可替换花材`));
  lines.push('');
  
  ordersWithNoReplacement.forEach(detail => {
    lines.push(chalk.bold(`\n  ❌ 订单 ${detail.orderId} - 需人工确认`));
    detail.issues
      .filter(i => i.type === 'inventory_shortage_no_replacement')
      .forEach(issue => {
        lines.push(`    ${issue.flower}: 缺 ${issue.shortage} 枝（需求 ${issue.required}，库存 ${issue.stock}）`);
      });
  });
  
  return lines.join('\n');
}

function formatPickingList() {
  const orders = orderManager.getOrders().filter(o => o.status !== 'cancelled');
  const bouquetSpecs = orderManager.getBouquetSpecs();
  const deliverySlots = require('../core/delivery-manager').getDeliverySlots();
  
  const slots = {};
  deliverySlots.forEach(slot => {
    slots[slot.slotId] = {
      name: slot.name,
      orders: []
    };
  });
  
  orders.forEach(order => {
    const slot = slots[order.deliverySlot];
    if (slot) {
      const orderPicking = {
        orderId: order.orderId,
        customer: order.customerName,
        bouquets: order.bouquets.map(b => {
          const spec = bouquetSpecs.find(s => s.specId === b.specId);
          return {
            specName: spec ? spec.name : b.specId,
            quantity: b.quantity,
            flowers: spec ? spec.flowers.map(f => ({
              name: f.name,
              quantity: f.quantity * b.quantity
            })) : []
          };
        }),
        card: order.card,
        replacements: order.replacements || []
      };
      slot.orders.push(orderPicking);
    }
  });
  
  const lines = [];
  lines.push(chalk.bold.magenta('════════════════════════════════════════════'));
  lines.push(chalk.bold.magenta('         分批拣花单 (Picking List)'));
  lines.push(chalk.bold.magenta('════════════════════════════════════════════'));
  lines.push('');
  
  Object.entries(slots).forEach(([slotId, slotData]) => {
    if (slotData.orders.length === 0) return;
    
    lines.push(chalk.bold(`📦 配送时段: ${slotData.name} (${slotId})`));
    lines.push(`  订单数: ${slotData.orders.length}`);
    lines.push('');
    
    slotData.orders.forEach((order, idx) => {
      lines.push(`  ${idx + 1}. 订单 ${order.orderId} - ${order.customer}`);
      order.bouquets.forEach(b => {
        lines.push(`     🎀 ${b.specName} x ${b.quantity}`);
        b.flowers.forEach(f => {
          lines.push(`        🌿 ${f.name}: ${f.quantity} 枝`);
        });
      });
      if (order.card) {
        lines.push(`     💌 卡片: ${order.card.content}`);
      }
      if (order.replacements.length > 0) {
        lines.push(`     🔄 替换:`);
        order.replacements.forEach(r => {
          lines.push(`        ${r.originalFlower} → ${r.replacementFlower} (${r.quantity}枝)`);
        });
      }
      lines.push('');
    });
  });
  
  const totalFlowers = {};
  orders.forEach(order => {
    order.bouquets.forEach(bouquet => {
      const spec = bouquetSpecs.find(s => s.specId === bouquet.specId);
      if (spec) {
        spec.flowers.forEach(flower => {
          const needed = flower.quantity * bouquet.quantity;
          totalFlowers[flower.name] = (totalFlowers[flower.name] || 0) + needed;
        });
      }
    });
  });
  
  lines.push(chalk.bold('════════════════════════════════════════════'));
  lines.push(chalk.bold('🌷 汇总花材需求'));
  Object.entries(totalFlowers).forEach(([name, qty]) => {
    const stock = inventoryManager.getFlowerStock(name);
    const status = stock >= qty ? chalk.green('✓') : chalk.red('✗');
    lines.push(`  ${name}: ${qty} 枝 (库存: ${stock}) ${status}`);
  });
  
  return lines.join('\n');
}

module.exports = {
  formatBeforeFulfillment,
  formatAfterReplacement,
  formatOutOfStock,
  formatPickingList
};
