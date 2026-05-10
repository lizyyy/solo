const validation = require('../core/validation');
const replacementCalculator = require('../core/replacement-calculator');
const orderManager = require('../core/order-manager');
const inventoryManager = require('../core/inventory-manager');
const deliveryManager = require('../core/delivery-manager');
const inventoryAllocation = require('../core/inventory-allocation');
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
        lines.push(`    总缺口: ${item.shortage} 枝`);
        if (item.ordersWithShortage && item.ordersWithShortage.length > 0) {
          lines.push(chalk.red(`    ⚠️ 无法满足的订单:`));
          item.ordersWithShortage.forEach(os => {
            lines.push(`       - 订单 ${os.orderId}: 缺 ${os.shortage} 枝（需求 ${os.required}）`);
          });
        }
        if (item.replacementOptions.length > 0) {
          lines.push(`    可替换: ${item.replacementOptions.map(r => r.name).join(', ')}`);
        } else {
          lines.push(chalk.red(`    ⚠️ 无可替换花材！需要紧急采购`));
        }
      }
    });
  }
  lines.push('');
  
  lines.push(chalk.bold('📋 订单详情（按配送顺序分配库存）'));
  validationResult.details.forEach(detail => {
    const status = detail.valid ? chalk.green('✓ 有效') : chalk.red('✗ 无效');
    lines.push(`\n  订单 ${detail.orderId}: ${status}`);
    
    detail.issues.forEach(issue => {
      const severityColor = issue.severity === 'error' ? chalk.red : 
                            issue.severity === 'warning' ? chalk.yellow : chalk.blue;
      lines.push(`    ${severityColor(`[${issue.severity.toUpperCase()}] ${issue.message}`)}`);
    });
    
    if (detail.allocation && Object.keys(detail.allocation.allocation).length > 0) {
      lines.push(`    📦 库存分配:`);
      Object.entries(detail.allocation.allocation).forEach(([flower, alloc]) => {
        const shortage = detail.allocation.shortage[flower] || 0;
        if (shortage > 0) {
          lines.push(chalk.red(`       ${flower}: 需求 ${alloc.original} / 分配 ${alloc.fromOriginalStock} / 缺口 ${shortage}`));
        } else {
          lines.push(chalk.green(`       ${flower}: 需求 ${alloc.original} / 分配 ${alloc.fromOriginalStock} / 充足`));
        }
      });
    }
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
  
  const totalReplacements = ordersWithReplacements.reduce(
    (sum, r) => sum + r.replacements.reduce((s, rep) => s + rep.quantity, 0), 0
  );
  
  lines.push(chalk.bold('📦 花材替换汇总'));
  lines.push(`  需要替换的订单数: ${ordersWithReplacements.length}`);
  lines.push(`  替换总枝数: ${totalReplacements} 枝`);
  const totalPriceDiff = replacements.reduce((sum, r) => sum + r.totalPriceDiff, 0);
  lines.push(`  价格调整总额: ${totalPriceDiff >= 0 ? '+' : ''}${totalPriceDiff} 元`);
  lines.push('');
  
  replacements.forEach(r => {
    if (r.replacements.length > 0) {
      lines.push(chalk.bold(`\n  📝 订单 ${r.orderId}`));
      r.replacements.forEach(rep => {
        lines.push(`    ${rep.originalFlower} (${rep.quantity}枝) → ${rep.replacementFlower}`);
        lines.push(`       (原需求 ${rep.originalRequired}，已分配 ${rep.originalAllocated})`);
        if (rep.note) {
          lines.push(`       备注: ${rep.note}`);
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
  lines.push(chalk.red('   这些订单需要人工确认（退款、换货、紧急采购等）'));
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
  const deliverySlots = deliveryManager.getDeliverySlots();
  const promisedSlots = deliverySlots.filter(s => s.isPromised);
  
  const slots = {};
  promisedSlots.forEach(slot => {
    slots[slot.slotId] = {
      name: slot.name,
      orders: []
    };
  });
  
  const orders = orderManager.getOrders().filter(o => {
    if (o.status === 'cancelled') return false;
    const slotValidation = deliveryManager.validateDeliverySlot(o.deliverySlot);
    return slotValidation.valid;
  });
  
  const bouquetSpecs = orderManager.getBouquetSpecs();
  const allocation = inventoryAllocation.allocateInventory();
  
  orders.forEach(order => {
    const slot = slots[order.deliverySlot];
    if (slot) {
      const orderAllocation = allocation.allocationResults.find(
        r => r.orderId === order.orderId
      );
      
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
        replacements: order.replacements || [],
        allocation: orderAllocation
      };
      slot.orders.push(orderPicking);
    }
  });
  
  const lines = [];
  lines.push(chalk.bold.magenta('════════════════════════════════════════════'));
  lines.push(chalk.bold.magenta('         分批拣花单 (Picking List)'));
  lines.push(chalk.bold.magenta('════════════════════════════════════════════'));
  lines.push('');
  lines.push(chalk.gray('⚠️  仅显示配送时段有效的订单'));
  lines.push('');
  
  Object.entries(slots).forEach(([slotId, slotData]) => {
    if (slotData.orders.length === 0) return;
    
    lines.push(chalk.bold(`📦 配送时段: ${slotData.name} (${slotId})`));
    lines.push(`  订单数: ${slotData.orders.length}`);
    lines.push('');
    
    slotData.orders.forEach((order, idx) => {
      const hasShortage = order.allocation && 
        Object.values(order.allocation.shortage).some(s => s > 0);
      
      const statusMarker = hasShortage ? chalk.yellow('⚠️') : chalk.green('✓');
      
      lines.push(`  ${idx + 1}. ${statusMarker} 订单 ${order.orderId} - ${order.customer}`);
      order.bouquets.forEach(b => {
        lines.push(`     🎀 ${b.specName} x ${b.quantity}`);
        b.flowers.forEach(f => {
          const shortage = order.allocation?.shortage?.[f.name] || 0;
          const allocated = order.allocation?.allocation?.[f.name]?.fromOriginalStock || f.quantity;
          
          if (shortage > 0) {
            lines.push(chalk.yellow(`        🌿 ${f.name}: 需求 ${f.quantity} 枝 / 分配 ${allocated} 枝 / 缺 ${shortage} 枝`));
          } else {
            lines.push(`        🌿 ${f.name}: ${f.quantity} 枝`);
          }
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
      if (hasShortage) {
        lines.push(chalk.yellow(`     ⚠️ 此订单有库存缺口，需要替换或人工确认`));
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
    const shortage = Math.max(0, qty - stock);
    const status = stock >= qty ? chalk.green('✓ 充足') : chalk.red(`✗ 缺 ${shortage} 枝`);
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
