const dataStore = require('./dataStore');

function calculateActivityBalance(activityId) {
  const leaders = dataStore.getLeadersByActivity(activityId);
  const returns = dataStore.getReturnsByActivity(activityId);
  const losses = dataStore.getLossesByActivity(activityId);
  const damages = dataStore.getDamagesByActivity(activityId);
  const consumptions = dataStore.getConsumptionsByActivity(activityId);
  
  const balance = {};
  
  for (const leader of leaders) {
    const code = leader.materialCode;
    if (!balance[code]) {
      balance[code] = {
        materialCode: code,
        materialName: leader.materialName,
        unit: leader.unit,
        borrowed: 0,
        returned: 0,
        lost: 0,
        damaged: 0,
        consumed: 0,
        balance: 0
      };
    }
    balance[code].borrowed += leader.quantity;
  }
  
  for (const ret of returns) {
    const code = ret.materialCode;
    if (!balance[code]) {
      balance[code] = {
        materialCode: code,
        materialName: ret.materialName,
        unit: ret.unit,
        borrowed: 0,
        returned: 0,
        lost: 0,
        damaged: 0,
        consumed: 0,
        balance: 0
      };
    }
    balance[code].returned += ret.quantity;
  }
  
  for (const loss of losses) {
    const code = loss.materialCode;
    if (!balance[code]) {
      balance[code] = {
        materialCode: code,
        materialName: loss.materialName,
        unit: loss.unit,
        borrowed: 0,
        returned: 0,
        lost: 0,
        damaged: 0,
        consumed: 0,
        balance: 0
      };
    }
    balance[code].lost += loss.quantity;
  }
  
  for (const damage of damages) {
    const code = damage.materialCode;
    if (!balance[code]) {
      balance[code] = {
        materialCode: code,
        materialName: damage.materialName,
        unit: damage.unit,
        borrowed: 0,
        returned: 0,
        lost: 0,
        damaged: 0,
        consumed: 0,
        balance: 0
      };
    }
    balance[code].damaged += damage.quantity;
  }
  
  for (const consumption of consumptions) {
    const code = consumption.materialCode;
    if (!balance[code]) {
      balance[code] = {
        materialCode: code,
        materialName: consumption.materialName,
        unit: consumption.unit,
        borrowed: 0,
        returned: 0,
        lost: 0,
        damaged: 0,
        consumed: 0,
        balance: 0
      };
    }
    balance[code].consumed += consumption.quantity;
  }
  
  for (const code in balance) {
    const item = balance[code];
    item.balance = item.borrowed - item.returned - item.lost - item.damaged - item.consumed;
  }
  
  return Object.values(balance);
}

function validateReturn(activityId, materialCode, quantity) {
  const errors = [];
  const warnings = [];
  
  const leaders = dataStore.getLeadersByActivity(activityId);
  const leader = leaders.find(l => l.materialCode === materialCode);
  
  if (!leader) {
    errors.push(`活动 ${activityId} 没有领用物料 ${materialCode}`);
    return { errors, warnings, valid: false };
  }
  
  const existingReturns = dataStore.getReturnsByMaterial(activityId, materialCode);
  const totalReturned = existingReturns.reduce((sum, r) => sum + r.quantity, 0);
  const newTotal = totalReturned + quantity;
  
  if (newTotal > leader.quantity) {
    errors.push(`归还数量 (${newTotal} ${leader.unit}) 大于借出数量 (${leader.quantity} ${leader.unit})`);
  }
  
  if (existingReturns.length > 0) {
    warnings.push(`物料 ${materialCode} 已归还过 ${existingReturns.length} 次，累计 ${totalReturned} ${leader.unit}`);
  }
  
  return {
    errors,
    warnings,
    valid: errors.length === 0
  };
}

function checkActivityCompletion(activityId) {
  const balance = calculateActivityBalance(activityId);
  const issues = [];
  
  for (const item of balance) {
    if (item.balance > 0) {
      issues.push({
        type: 'unreturned',
        materialCode: item.materialCode,
        materialName: item.materialName,
        message: `还有 ${item.balance} ${item.unit} ${item.materialName} 未处理（借出${item.borrowed}，归还${item.returned}，丢失${item.lost}，报损${item.damaged}，消耗${item.consumed}）`
      });
    }
    
    if (item.balance < 0) {
      issues.push({
        type: 'over_returned',
        materialCode: item.materialCode,
        materialName: item.materialName,
        message: `归还数量异常，多出 ${Math.abs(item.balance)} ${item.unit} ${item.materialName}`
      });
    }
  }
  
  return issues;
}

function checkInventoryAgainstFutureActivities() {
  const currentInventory = dataStore.getInventory();
  const allDemands = dataStore.getActivityDemands();
  const activities = dataStore.getActivities();
  
  const sortedActivities = [...activities].sort((a, b) => {
    const dateA = new Date(a.startDate);
    const dateB = new Date(b.startDate);
    return dateA - dateB;
  });
  
  const results = [];
  
  for (const activity of sortedActivities) {
    const demands = allDemands[activity.id] || [];
    const shortages = [];
    
    for (const demand of demands) {
      const code = demand.materialCode;
      const currentStock = currentInventory[code] || 0;
      
      if (currentStock < demand.quantity) {
        shortages.push({
          materialCode: code,
          materialName: demand.materialName,
          unit: demand.unit,
          currentStock,
          required: demand.quantity,
          shortage: demand.quantity - currentStock
        });
      }
    }
    
    if (shortages.length > 0) {
      results.push({
        activityId: activity.id,
        activityName: activity.name,
        startDate: activity.startDate,
        shortages
      });
    }
  }
  
  return results;
}

function generatePurchaseSuggestions() {
  const shortages = checkInventoryAgainstFutureActivities();
  
  if (shortages.length === 0) {
    return {
      hasSuggestions: false,
      suggestions: []
    };
  }
  
  const suggestions = [];
  
  for (const activityShortage of shortages) {
    for (const item of activityShortage.shortages) {
      suggestions.push({
        materialCode: item.materialCode,
        materialName: item.materialName,
        unit: item.unit,
        currentStock: item.currentStock,
        requiredForActivity: item.required,
        needToPurchase: item.shortage,
        affectedActivityId: activityShortage.activityId,
        affectedActivityName: activityShortage.activityName,
        affectedActivityDate: activityShortage.startDate
      });
    }
  }
  
  return {
    hasSuggestions: true,
    suggestions
  };
}

module.exports = {
  calculateActivityBalance,
  validateReturn,
  checkActivityCompletion,
  checkInventoryAgainstFutureActivities,
  generatePurchaseSuggestions
};
