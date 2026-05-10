const inventoryManager = require('./inventory-manager');
const orderManager = require('./order-manager');
const deliveryManager = require('./delivery-manager');
const validation = require('./validation');
const inventoryAllocation = require('./inventory-allocation');

function calculateReplacementForOrderWithAllocation(order, allocation) {
  const bouquetSpecs = orderManager.getBouquetSpecs();
  const replacements = [];
  const priceAdjustments = [];
  
  const orderAllocation = allocation?.allocationResults.find(
    r => r.orderId === order.orderId
  );
  
  if (!orderAllocation) {
    return {
      orderId: order.orderId,
      replacements: [],
      priceAdjustments: [],
      totalPriceDiff: 0,
      needsPriceSync: false
    };
  }
  
  Object.entries(orderAllocation.shortage).forEach(([flowerName, shortage]) => {
    if (shortage <= 0) return;
    
    const replacementOptions = inventoryManager.getReplacementOptions(flowerName);
    
    if (replacementOptions.length > 0) {
      const bestReplacement = replacementOptions[0];
      
      const flowerSpec = findFlowerPriceInOrder(order, flowerName);
      const originalPrice = flowerSpec?.price || 0;
      const replacementPrice = bestReplacement.price || originalPrice;
      const priceDiff = (replacementPrice - originalPrice) * shortage;
      
      replacements.push({
        originalFlower: flowerName,
        replacementFlower: bestReplacement.name,
        quantity: shortage,
        priority: bestReplacement.priority,
        note: bestReplacement.note || '',
        originalAllocated: orderAllocation.allocation[flowerName]?.fromOriginalStock || 0,
        originalRequired: orderAllocation.requirements[flowerName]
      });
      
      if (priceDiff !== 0) {
        priceAdjustments.push({
          orderId: order.orderId,
          flower: flowerName,
          originalPrice: originalPrice * shortage,
          replacementPrice: replacementPrice * shortage,
          priceDiff
        });
      }
    }
  });
  
  const totalPriceDiff = priceAdjustments.reduce((sum, p) => sum + p.priceDiff, 0);
  const originalOrderPrice = validation.calculateOrderOriginalPrice(order);
  
  return {
    orderId: order.orderId,
    replacements,
    priceAdjustments,
    totalPriceDiff,
    needsPriceSync: totalPriceDiff !== 0 && order.price !== (originalOrderPrice + totalPriceDiff)
  };
}

function findFlowerPriceInOrder(order, flowerName) {
  const bouquetSpecs = orderManager.getBouquetSpecs();
  
  for (const bouquet of order.bouquets) {
    const spec = bouquetSpecs.find(s => s.specId === bouquet.specId);
    if (spec) {
      const flower = spec.flowers.find(f => f.name === flowerName);
      if (flower) {
        return flower;
      }
    }
  }
  
  return null;
}

function calculateReplacementForOrder(orderId) {
  const order = orderManager.getOrderById(orderId);
  if (!order) {
    return null;
  }
  
  const allocation = inventoryAllocation.allocateInventory();
  return calculateReplacementForOrderWithAllocation(order, allocation);
}

function calculateReplacementsForAllOrders() {
  const allocation = inventoryAllocation.allocateInventory();
  return allocation.orders.map(order => 
    calculateReplacementForOrderWithAllocation(order, allocation)
  );
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
  calculateReplacementForOrderWithAllocation,
  calculateReplacementsForAllOrders,
  confirmReplacement,
  confirmPriceSync
};
