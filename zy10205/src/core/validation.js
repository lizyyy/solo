const orderManager = require('./order-manager');
const inventoryManager = require('./inventory-manager');
const deliveryManager = require('./delivery-manager');

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

function validateOrder(order) {
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
    hasReplacementOption
  };
}

function validateAllOrders() {
  const orders = orderManager.getOrders();
  const results = orders.map(order => validateOrder(order));
  
  const validOrders = results.filter(r => r.valid);
  const invalidOrders = results.filter(r => !r.valid);
  
  const inventoryStatus = inventoryManager.checkInventoryStatus();
  
  return {
    summary: {
      total: orders.length,
      valid: validOrders.length,
      invalid: invalidOrders.length,
      withIssues: results.filter(r => r.issues.length > 0).length
    },
    details: results,
    inventoryStatus
  };
}

module.exports = {
  validateOrder,
  validateAllOrders,
  calculateOrderOriginalPrice
};
