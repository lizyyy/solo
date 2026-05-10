const config = require('./config');
const utils = require('./utils');
const { readData } = require('./data');

function checkDailyCapacity(date, requiredCapacity, hasDeposit, orderId = null) {
  const dailyCapacity = readData('dailyCapacity.json', {});
  const dayCap = dailyCapacity[date] || { total: config.DAILY_CAPACITY, used: 0 };
  
  let usedCapacity = dayCap.used;
  
  if (orderId) {
    const orders = readData('orders.json', []);
    const existingOrder = orders.find(o => o.id === orderId);
    if (existingOrder && existingOrder.pickupDate === date) {
      usedCapacity -= existingOrder.capacityUsed || 0;
    }
  }
  
  const effectiveMax = hasDeposit 
    ? dayCap.total 
    : dayCap.total * config.MAX_CAPACITY_WITH_DEPOSIT;
  
  const remaining = effectiveMax - usedCapacity;
  const available = remaining >= requiredCapacity;
  
  return {
    available,
    requiredCapacity,
    usedCapacity,
    effectiveMax,
    totalCapacity: dayCap.total,
    remaining: Math.max(0, remaining),
    message: available 
      ? `产能充足：当日已用 ${usedCapacity.toFixed(1)}/${dayCap.total}${!hasDeposit ? `（未付定金订单上限 ${effectiveMax.toFixed(1)}）` : ''}`
      : `产能不足：已用 ${usedCapacity.toFixed(1)}/${dayCap.total}${!hasDeposit ? `，未付定金订单上限为 ${effectiveMax.toFixed(1)}` : ''}，需要 ${requiredCapacity}`
  };
}

function checkMaterialStock(flavorId, sizeId, date, orderId = null) {
  const materials = readData('materials.json', {});
  const materialUsage = readData('materialUsage.json', {});
  const orders = readData('orders.json', []);
  
  const ingredients = utils.calculateIngredients(flavorId, sizeId);
  const dayUsage = materialUsage[date] || {};
  
  const gap = {};
  const warnings = {};
  let overallOk = true;
  let hasWarning = false;
  
  for (const [key, required] of Object.entries(ingredients)) {
    const material = materials[key];
    if (!material) continue;
    
    let alreadyUsed = 0;
    for (const [d, usage] of Object.entries(materialUsage)) {
      if (d >= date && usage[key]) {
        alreadyUsed += usage[key];
      }
    }
    
    if (orderId) {
      const existingOrder = orders.find(o => o.id === orderId);
      if (existingOrder) {
        const existingIngredients = utils.calculateIngredients(existingOrder.flavor, existingOrder.size);
        for (const [d, usage] of Object.entries(materialUsage)) {
          if (d >= existingOrder.pickupDate && usage[key] && existingIngredients[key]) {
            alreadyUsed -= existingIngredients[key];
          }
        }
      }
    }
    
    const willBeUsed = alreadyUsed + required;
    const remaining = material.stock - willBeUsed;
    
    if (remaining < 0) {
      overallOk = false;
      gap[key] = {
        name: material.name,
        unit: material.unit,
        stock: material.stock,
        alreadyUsed: Math.round(alreadyUsed * 100) / 100,
        required: Math.round(required * 100) / 100,
        willBeUsed: Math.round(willBeUsed * 100) / 100,
        deficit: Math.round(Math.abs(remaining) * 100) / 100
      };
    } else if (remaining < material.minStock) {
      hasWarning = true;
      warnings[key] = {
        name: material.name,
        unit: material.unit,
        stock: material.stock,
        alreadyUsed: Math.round(alreadyUsed * 100) / 100,
        required: Math.round(required * 100) / 100,
        willBeUsed: Math.round(willBeUsed * 100) / 100,
        remaining: Math.round(remaining * 100) / 100,
        minStock: material.minStock,
        deficit: Math.round(material.minStock - remaining * 100) / 100
      };
    }
  }
  
  return {
    ok: overallOk,
    hasWarning,
    gap,
    warnings,
    message: overallOk 
      ? (hasWarning ? '材料库存接近安全线，请及时补货' : '材料库存充足')
      : '材料库存不足，无法接单'
  };
}

function checkCanCreateOrder(orderData) {
  const { pickupDate, flavor, size, depositPaid } = orderData;
  const requiredCapacity = utils.calculateCapacityUsage(size);
  
  const results = {};
  
  if (!utils.isWeekend(pickupDate)) {
    return { canCreate: false, message: '只能在周末（周六、周日）生产', type: 'not_weekend' };
  }
  
  if (utils.isCutoffPassed(pickupDate)) {
    return { canCreate: false, message: `已过截单时间（取货日${config.CUTOFF_DAYS_BEFORE}天前18:00）`, type: 'cutoff_passed' };
  }
  
  const capacityCheck = checkDailyCapacity(pickupDate, requiredCapacity, depositPaid);
  results.capacity = capacityCheck;
  
  const materialCheck = checkMaterialStock(flavor, size, pickupDate);
  results.materials = materialCheck;
  
  const canCreate = capacityCheck.available && materialCheck.ok;
  
  return {
    canCreate,
    results,
    message: canCreate ? '可以接单' : '无法接单，请检查产能或材料'
  };
}

function checkCanReschedule(orderId, newDate) {
  const orders = readData('orders.json', []);
  const order = orders.find(o => o.id === orderId);
  
  if (!order) {
    return { canReschedule: false, message: '订单不存在' };
  }
  
  if (order.status === 'completed' || order.status === 'cancelled') {
    return { canReschedule: false, message: '已完成或已取消的订单不能改期' };
  }
  
  const needsReview = utils.isCutoffPassed(order.pickupDate) || order.status === 'confirmed';
  
  const results = {};
  
  if (!utils.isWeekend(newDate)) {
    return { canReschedule: false, message: '只能改到周末' };
  }
  
  if (utils.isCutoffPassed(newDate)) {
    return { canReschedule: false, message: '目标日期已过截单时间' };
  }
  
  const capacityCheck = checkDailyCapacity(newDate, order.capacityUsed, order.depositPaid, orderId);
  results.capacity = capacityCheck;
  
  const materialCheck = checkMaterialStock(order.flavor, order.size, newDate, orderId);
  results.materials = materialCheck;
  
  const canReschedule = capacityCheck.available && materialCheck.ok;
  
  return {
    canReschedule,
    needsReview,
    results,
    message: needsReview 
      ? (canReschedule ? '需要审核通过后改期' : '需要审核，但目标日期产能或材料不足')
      : (canReschedule ? '可以改期' : '无法改期')
  };
}

function calculateMaterialGap() {
  const materials = readData('materials.json', {});
  const materialUsage = readData('materialUsage.json', {});
  const orders = readData('orders.json', []);
  
  const activeOrders = orders.filter(o => 
    o.status === 'confirmed' || o.status === 'reschedule_pending'
  );
  
  const futureDates = Object.keys(materialUsage)
    .filter(d => new Date(d) >= new Date(new Date().toISOString().split('T')[0]))
    .sort();
  
  const totalUsage = {};
  const usageByDate = {};
  
  for (const date of futureDates) {
    usageByDate[date] = {};
    const usage = materialUsage[date] || {};
    for (const [key, amount] of Object.entries(usage)) {
      totalUsage[key] = (totalUsage[key] || 0) + amount;
      usageByDate[date][key] = amount;
    }
  }
  
  const gap = {};
  const warnings = {};
  
  for (const [key, material] of Object.entries(materials)) {
    const used = totalUsage[key] || 0;
    const remaining = material.stock - used;
    
    if (remaining < 0) {
      gap[key] = {
        ...material,
        used: Math.round(used * 100) / 100,
        remaining: Math.round(remaining * 100) / 100,
        deficit: Math.round(Math.abs(remaining) * 100) / 100,
        urgency: remaining < -500 ? 'high' : 'medium'
      };
    } else if (remaining < material.minStock) {
      warnings[key] = {
        ...material,
        used: Math.round(used * 100) / 100,
        remaining: Math.round(remaining * 100) / 100,
        deficit: Math.round(material.minStock - remaining * 100) / 100,
        urgency: remaining < material.minStock * 0.3 ? 'high' : 'low'
      };
    }
  }
  
  return {
    gap,
    warnings,
    totalUsage,
    usageByDate,
    futureDates,
    activeOrdersCount: activeOrders.length
  };
}

module.exports = {
  checkDailyCapacity,
  checkMaterialStock,
  checkCanCreateOrder,
  checkCanReschedule,
  calculateMaterialGap
};
