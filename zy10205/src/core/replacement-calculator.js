const inventoryManager = require('./inventory-manager');
const orderManager = require('./order-manager');
const deliveryManager = require('./delivery-manager');
const validation = require('./validation');

function calculateReplacementForOrder(order) {
  const bouquetSpecs = orderManager.getBouquetSpecs();
  const replacements = [];
  const priceAdjustments = [];
  
  order.bouquets.forEach(bouquet => {
    const spec = bouquetSpecs.find(s => s.specId === bouquet.specId);
    if (!spec) return;
    
    spec.flowers.forEach(flower => {
      const required = flower.quantity * bouquet.quantity;
      const stock = inventoryManager.getFlowerStock(flower.name);
      
      if (stock < required) {
        const shortage = required - stock;
        const replacementOptions = inventoryManager.getReplacementOptions(flower.name);
        
        if (replacementOptions.length > 0) {
          const bestReplacement = replacementOptions[0];
          const replacementStock = inventoryManager.getFlowerStock(bestReplacement.name);
          
          if (replacementStock >= shortage) {
            const originalCost = flower.price * shortage;
            const replacementCost = bestReplacement.price * shortage;
            const priceDiff = replacementCost - originalCost;
            
            replacements.push({
              originalFlower: flower.name,
              replacementFlower: bestReplacement.name,
              quantity: shortage,
              priority: bestReplacement.priority,
              note: bestReplacement.note || ''
            });
            
            if (priceDiff !== 0) {
              priceAdjustments.push({
                orderId: order.orderId,
                flower: flower.name,
                originalPrice: originalCost,
                replacementPrice: replacementCost,
                priceDiff
              });
            }
          }
        }
      }
    });
  });
  
  const totalPriceDiff = priceAdjustments.reduce((sum, p) => sum + p.priceDiff, 0);
  
  return {
    orderId: order.orderId,
    replacements,
    priceAdjustments,
    totalPriceDiff,
    needsPriceSync: totalPriceDiff !== 0 && order.price !== (validation.calculateOrderOriginalPrice(order) + totalPriceDiff)
  };
}

function calculateReplacementsForAllOrders() {
  const orders = orderManager.getOrders();
  return orders.map(order => calculateReplacementForOrder(order));
}

function confirmReplacement(orderId, replacementData, confirmedBy) {
  const order = orderManager.getOrderById(orderId);
  if (!order) {
    return { success: false, message: `订单 ${orderId} 不存在` };
  }
  
  const confirmations = deliveryManager.getOrderConfirmations(orderId);
  const existingReplacementConf = confirmations.find(c => c.confirmationType === 'replacement');
  
  if (existingReplacementConf) {
    return {
      success: false,
      duplicate: true,
      message: `订单 ${orderId} 的花材替换已确认过`
    };
  }
  
  const confirmationResult = deliveryManager.addConfirmation(orderId, {
    confirmationType: 'replacement',
    replacements: replacementData.replacements,
    priceAdjustments: replacementData.priceAdjustments,
    totalPriceDiff: replacementData.totalPriceDiff,
    confirmedBy,
    status: 'confirmed'
  });
  
  if (confirmationResult.success) {
    orderManager.updateOrder(orderId, {
      status: 'replacement_confirmed',
      replacements: replacementData.replacements,
      priceDiff: replacementData.totalPriceDiff
    });
    
    orderManager.addHistory('confirm_replacement', {
      orderId,
      replacements: replacementData.replacements
    });
  }
  
  return confirmationResult;
}

function confirmPriceSync(orderId, newPrice, confirmedBy) {
  const confirmations = deliveryManager.getOrderConfirmations(orderId);
  const existingPriceConf = confirmations.find(c => c.confirmationType === 'price_sync');
  
  if (existingPriceConf) {
    return {
      success: false,
      duplicate: true,
      message: `订单 ${orderId} 的价格同步已确认过`
    };
  }
  
  const confirmationResult = deliveryManager.addConfirmation(orderId, {
    confirmationType: 'price_sync',
    originalPrice: confirmations.find(c => c.confirmationType === 'replacement')?.priceAdjustments,
    newPrice,
    confirmedBy,
    status: 'confirmed'
  });
  
  if (confirmationResult.success) {
    orderManager.updateOrder(orderId, {
      price: newPrice,
      priceSynced: true
    });
    
    orderManager.addHistory('confirm_price_sync', {
      orderId,
      newPrice
    });
  }
  
  return confirmationResult;
}

module.exports = {
  calculateReplacementForOrder,
  calculateReplacementsForAllOrders,
  confirmReplacement,
  confirmPriceSync
};
