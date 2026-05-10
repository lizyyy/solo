const orderManager = require('./order-manager');
const inventoryManager = require('./inventory-manager');
const deliveryManager = require('./delivery-manager');
const inventoryAllocation = require('./inventory-allocation');

function calculateOrderOriginalPrice(order) {
  const bouquetSpecs = orderManager.getBouquetSpecs();
  let total = 0;
  
  order.bouquets.forEach(bouquet => {
    const spec = bouquetSpecs.find(s => s.specId === bouquet.specId);
    if (spec) {
      total += spec.price * bouquet.quantity;
    }
  });
  
  return total;
}

function validateOrderWithAllocation(order, allocation) {
  const issues = [];
  const bouquetSpecs = orderManager.getBouquetSpecs();
  
  const deliveryValidation = deliveryManager.validateDeliverySlot(order.deliverySlot);
  if (!deliveryValidation.valid) {
    issues.push({
      type: 'delivery_slot',
      severity: 'error',
      message: deliveryValidation.message
    });
  }
  
  let hasInventoryIssue = false;
  let hasReplacementOption = true;
  
  const orderAllocation = allocation?.allocationResults.find(
    r => r.orderId === order.orderId
  );
  
  if (orderAllocation) {
    Object.entries(orderAllocation.shortage).forEach(([flowerName, shortage]) => {
      if (shortage > 0) {
        hasInventoryIssue = true;
        const replacements = inventoryManager.getReplacementOptions(flowerName);
        const originalStock = inventoryManager.getFlowerStock(flowerName);
        const required = orderAllocation.requirements[flowerName];
        const allocated = orderAllocation.allocation[flowerName]?.fromOriginalStock || 0;
        
        if (replacements.length === 0) {
          hasReplacementOption = false;
          issues.push({
            type: 'inventory_shortage_no_replacement',
            severity: 'error',
            flower: flowerName,
            required,
            stock: originalStock,
            allocated,
            shortage,
            message: `${flowerName} 库存不足 ${shortage} 枝（需求 ${required}，库存 ${originalStock}，已分配给前面订单 ${originalStock - allocated}），且无可替换花材`
          });
        } else {
          issues.push({
            type: 'inventory_shortage_with_replacement',
            severity: 'warning',
            flower: flowerName,
            required,
            stock: originalStock,
            allocated,
            shortage,
            replacements,
            message: `${flowerName} 库存不足 ${shortage} 枝（需求 ${required}，库存 ${originalStock}，已分配给前面订单 ${originalStock - allocated}），有 ${replacements.length} 个可替换选项`
          });
        }
      }
    });
  } else {
    order.bouquets.forEach(bouquet => {
      const spec = bouquetSpecs.find(s => s.specId === bouquet.specId);
      if (!spec) {
        issues.push({
          type: 'missing_spec',
          severity: 'error',
          message: `花束规格 ${bouquet.specId} 不存在`
        });
        return;
      }
      
      spec.flowers.forEach(flower => {
        const required = flower.quantity * bouquet.quantity;
        const stock = inventoryManager.getFlowerStock(flower.name);
        
        if (stock < required) {
          hasInventoryIssue = true;
          const shortage = required - stock;
          const replacements = inventoryManager.getReplacementOptions(flower.name);
          
          if (replacements.length === 0) {
            hasReplacementOption = false;
            issues.push({
              type: 'inventory_shortage_no_replacement',
              severity: 'error',
              flower: flower.name,
              required,
              stock,
              shortage,
              message: `${flower.name} 库存不足 ${shortage} 枝，且无可替换花材`
            });
          } else {
            issues.push({
              type: 'inventory_shortage_with_replacement',
              severity: 'warning',
              flower: flower.name,
              required,
              stock,
              shortage,
              replacements,
              message: `${flower.name} 库存不足 ${shortage} 枝，有 ${replacements.length} 个可替换选项`
            });
          }
        }
      });
    });
  }
  
  const originalPrice = calculateOrderOriginalPrice(order);
  if (order.price !== originalPrice) {
    issues.push({
      type: 'price_mismatch',
      severity: 'warning',
      expectedPrice: originalPrice,
      actualPrice: order.price,
      message: `订单价格与计算价格不一致，预期 ${originalPrice} 元，实际 ${order.price} 元`
    });
  }
  
  const confirmations = deliveryManager.getOrderConfirmations(order.orderId);
  if (confirmations.length > 0) {
    issues.push({
      type: 'already_confirmed',
      severity: 'info',
      message: `订单已被确认过 ${confirmations.length} 次`
    });
  }
  
  return {
    orderId: order.orderId,
    valid: issues.filter(i => i.severity === 'error').length === 0,
    issues,
    hasInventoryIssue,
    hasReplacementOption,
    allocation: orderAllocation
  };
}

function validateOrder(orderId) {
  const order = orderManager.getOrderById(orderId);
  if (!order) {
    return null;
  }
  
  const allocation = inventoryAllocation.allocateInventory();
  return validateOrderWithAllocation(order, allocation);
}

function validateAllOrders() {
  const orders = orderManager.getOrders();
  const allocation = inventoryAllocation.allocateInventory();
  
  const results = orders.map(order => validateOrderWithAllocation(order, allocation));
  
  const validOrders = results.filter(r => r.valid);
  const invalidOrders = results.filter(r => !r.valid);
  
  const inventoryStatus = buildInventoryStatus(allocation);
  
  return {
    summary: {
      total: orders.length,
      valid: validOrders.length,
      invalid: invalidOrders.length,
      withIssues: results.filter(r => r.issues.length > 0).length
    },
    details: results,
    inventoryStatus,
    allocation
  };
}

function buildInventoryStatus(allocation) {
  const summary = [];
  
  Object.entries(allocation.totalRequirements).forEach(([flowerName, required]) => {
    const stock = allocation.originalInventory.find(i => i.flowerName === flowerName)?.quantity || 0;
    const shortage = allocation.totalShortage[flowerName] || 0;
    const replacementOptions = inventoryManager.getReplacementOptions(flowerName);
    
    const ordersWithShortage = allocation.allocationResults
      .filter(r => r.shortage[flowerName] && r.shortage[flowerName] > 0)
      .map(r => ({
        orderId: r.orderId,
        shortage: r.shortage[flowerName],
        required: r.requirements[flowerName]
      }));
    
    summary.push({
      flowerName,
      required,
      stock,
      shortage,
      hasShortage: shortage > 0,
      replacementOptions,
      ordersWithShortage,
      firstUnfulfillableOrder: ordersWithShortage[0]?.orderId
    });
  });
  
  return {
    summary,
    totalShortage: Object.values(allocation.totalShortage).reduce((sum, s) => sum + s, 0),
    flowersWithShortage: summary.filter(s => s.hasShortage).map(s => s.flowerName)
  };
}

module.exports = {
  validateOrder,
  validateOrderWithAllocation,
  validateAllOrders,
  calculateOrderOriginalPrice
};
