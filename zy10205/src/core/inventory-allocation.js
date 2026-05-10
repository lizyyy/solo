const orderManager = require('./order-manager');
const inventoryManager = require('./inventory-manager');

function getOrdersForAllocation() {
  const orders = orderManager.getOrders().filter(o => o.status !== 'cancelled');
  
  return orders.sort((a, b) => {
    if (a.deliverySlot && b.deliverySlot) {
      return a.deliverySlot.localeCompare(b.deliverySlot);
    }
    return (a.importedAt || '').localeCompare(b.importedAt || '');
  });
}

function calculateOrderFlowerRequirements(order) {
  const bouquetSpecs = orderManager.getBouquetSpecs();
  const requirements = {};
  
  order.bouquets.forEach(bouquet => {
    const spec = bouquetSpecs.find(s => s.specId === bouquet.specId);
    if (spec) {
      spec.flowers.forEach(flower => {
        const flowerName = flower.name;
        const needed = flower.quantity * bouquet.quantity;
        requirements[flowerName] = (requirements[flowerName] || 0) + needed;
      });
    }
  });
  
  return requirements;
}

function allocateInventory() {
  const orders = getOrdersForAllocation();
  const inventory = inventoryManager.getInventory();
  
  const availableStock = {};
  inventory.forEach(item => {
    availableStock[item.flowerName] = item.quantity;
  });
  
  const allocationResults = [];
  const totalRequirements = {};
  
  orders.forEach(order => {
    const requirements = calculateOrderFlowerRequirements(order);
    const orderAllocation = {
      orderId: order.orderId,
      order,
      requirements,
      allocation: {},
      shortage: {},
      canBeFulfilled: true
    };
    
    Object.entries(requirements).forEach(([flowerName, needed]) => {
      totalRequirements[flowerName] = (totalRequirements[flowerName] || 0) + needed;
      
      const available = availableStock[flowerName] || 0;
      
      if (available >= needed) {
        orderAllocation.allocation[flowerName] = {
          original: needed,
          fromOriginalStock: needed,
          fromReplacement: 0
        };
        availableStock[flowerName] = available - needed;
      } else {
        orderAllocation.allocation[flowerName] = {
          original: needed,
          fromOriginalStock: available,
          fromReplacement: 0
        };
        orderAllocation.shortage[flowerName] = needed - available;
        orderAllocation.canBeFulfilled = false;
        availableStock[flowerName] = 0;
      }
    });
    
    allocationResults.push(orderAllocation);
  });
  
  const remainingStock = { ...availableStock };
  
  const totalShortage = {};
  Object.entries(totalRequirements).forEach(([flowerName, needed]) => {
    const originalStock = inventory.find(i => i.flowerName === flowerName)?.quantity || 0;
    totalShortage[flowerName] = Math.max(0, needed - originalStock);
  });
  
  return {
    orders,
    allocationResults,
    totalRequirements,
    totalShortage,
    remainingStock,
    originalInventory: inventory
  };
}

function findFirstUnfulfillableOrder(flowerName) {
  const allocation = allocateInventory();
  
  for (const result of allocation.allocationResults) {
    if (result.shortage[flowerName] && result.shortage[flowerName] > 0) {
      return result;
    }
  }
  
  return null;
}

function getAllocationForOrder(orderId) {
  const allocation = allocateInventory();
  return allocation.allocationResults.find(r => r.orderId === orderId);
}

module.exports = {
  allocateInventory,
  calculateOrderFlowerRequirements,
  findFirstUnfulfillableOrder,
  getAllocationForOrder,
  getOrdersForAllocation
};
