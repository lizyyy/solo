const config = require('./config');

const YARD_AREAS = {
  ZONE_A: { name: 'A区 - 爆炸品区', x: 0, y: 0, width: 100, height: 50, allowedCategories: ['EXPLOSIVES'] },
  ZONE_B: { name: 'B区 - 气体区', x: 150, y: 0, width: 100, height: 50, allowedCategories: ['GASES'] },
  ZONE_C: { name: 'C区 - 易燃液体区', x: 300, y: 0, width: 100, height: 50, allowedCategories: ['FLAMMABLE_LIQUIDS'] },
  ZONE_D: { name: 'D区 - 易燃固体区', x: 0, y: 100, width: 100, height: 50, allowedCategories: ['FLAMMABLE_SOLIDS'] },
  ZONE_E: { name: 'E区 - 氧化性物质区', x: 150, y: 100, width: 100, height: 50, allowedCategories: ['OXIDIZING'] },
  ZONE_F: { name: 'F区 - 毒性物质区', x: 300, y: 100, width: 100, height: 50, allowedCategories: ['TOXIC'] },
  ZONE_G: { name: 'G区 - 放射性物质区', x: 0, y: 200, width: 100, height: 50, allowedCategories: ['RADIOACTIVE'] },
  ZONE_H: { name: 'H区 - 腐蚀性物质区', x: 150, y: 200, width: 100, height: 50, allowedCategories: ['CORROSIVE'] },
  ZONE_I: { name: 'I区 - 杂项区', x: 300, y: 200, width: 100, height: 50, allowedCategories: ['MISCELLANEOUS'] }
};

let slotCounters = {};
let existingAssignments = [];

function initEngine(previousAssignments = []) {
  slotCounters = {};
  existingAssignments = previousAssignments;
  
  for (const zoneKey of Object.keys(YARD_AREAS)) {
    slotCounters[zoneKey] = 1;
  }
  
  for (const assignment of previousAssignments) {
    const zoneKey = assignment.zone;
    if (slotCounters[zoneKey] <= assignment.slot) {
      slotCounters[zoneKey] = assignment.slot + 1;
    }
  }
}

function getZoneForCategory(category) {
  for (const [zoneKey, zone] of Object.entries(YARD_AREAS)) {
    if (zone.allowedCategories.includes(category)) {
      return zoneKey;
    }
  }
  return null;
}

function calculateDistance(pos1, pos2) {
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function getCategoryPosition(category, slot) {
  const zoneKey = getZoneForCategory(category);
  if (!zoneKey) return null;
  
  const zone = YARD_AREAS[zoneKey];
  const cols = Math.floor(zone.width / 10);
  const row = Math.floor((slot - 1) / cols);
  const col = (slot - 1) % cols;
  
  return {
    zone: zoneKey,
    zoneName: zone.name,
    slot,
    x: zone.x + col * 10,
    y: zone.y + row * 10
  };
}

function checkIsolation(newGoods, existingGoodsList) {
  const newCategory = newGoods.category;
  const newPosition = getCategoryPosition(newCategory, slotCounters[getZoneForCategory(newCategory)]);
  
  if (!newPosition) {
    return {
      valid: false,
      errors: ['无法为该类别危险品找到合适区域']
    };
  }
  
  const errors = [];
  const warnings = [];
  const requiredDistance = config.ISOLATION_RULES.distances[newCategory] || 10;
  
  for (const existingGoods of existingGoodsList) {
    if (existingGoods.id === newGoods.id) continue;
    
    const existingCategory = existingGoods.category;
    const existingZoneKey = getZoneForCategory(existingCategory);
    if (!existingZoneKey) continue;
    
    const existingPosition = getCategoryPosition(existingCategory, existingGoods.slot);
    if (!existingPosition) continue;
    
    const distance = calculateDistance(newPosition, existingPosition);
    
    const isIncompatible = checkIncompatibleCategories(newCategory, existingCategory);
    
    if (isIncompatible) {
      errors.push(`与 ${existingGoods.goodsNo} (${config.ISOLATION_RULES.categories[existingCategory]?.name || existingCategory}) 属于不相容类别，距离不足`);
    } else if (distance < requiredDistance) {
      warnings.push(`与 ${existingGoods.goodsNo} 距离为 ${distance.toFixed(1)}m，建议隔离距离 ${requiredDistance}m`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    requiredDistance,
    position: newPosition
  };
}

function checkIncompatibleCategories(cat1, cat2) {
  for (const pair of config.ISOLATION_RULES.incompatible) {
    const [a, b] = pair;
    if (a === '*' || b === '*') {
      if (cat1 === a || cat2 === b || cat1 === b || cat2 === a) {
        return true;
      }
    } else {
      if ((cat1 === a && cat2 === b) || (cat1 === b && cat2 === a)) {
        return true;
      }
    }
  }
  return false;
}

function assignSlot(goods, existingGoodsList) {
  const zoneKey = getZoneForCategory(goods.category);
  if (!zoneKey) {
    return {
      success: false,
      error: `危险品类别 ${goods.category} 无效`
    };
  }
  
  const isolationCheck = checkIsolation(goods, existingGoodsList);
  
  if (!isolationCheck.valid) {
    return {
      success: false,
      error: isolationCheck.errors.join('; ')
    };
  }
  
  const slot = slotCounters[zoneKey]++;
  
  return {
    success: true,
    zone: zoneKey,
    zoneName: YARD_AREAS[zoneKey].name,
    slot,
    position: {
      x: isolationCheck.position.x,
      y: isolationCheck.position.y
    },
    warnings: isolationCheck.warnings,
    requiredDistance: isolationCheck.requiredDistance
  };
}

function generateJobPlan(goods, assignment, batchId) {
  const jobType = goods.operationType || 'IMPORT';
  const priority = getPriority(goods.category);
  
  return {
    batchId,
    jobNo: `JOB-${batchId}-${goods.goodsNo}`,
    goodsId: goods.id,
    goodsNo: goods.goodsNo,
    category: goods.category,
    categoryName: config.ISOLATION_RULES.categories[goods.category]?.name || goods.category,
    operationType: jobType,
    zone: assignment.zone,
    zoneName: assignment.zoneName,
    slot: assignment.slot,
    position: assignment.position,
    priority,
    status: jobType === 'IMPORT' ? 'PENDING_UNLOAD' : 'PENDING_LOAD',
    plannedTime: getPlannedTime(priority),
    requiredEquipment: getRequiredEquipment(goods.category)
  };
}

function getPriority(category) {
  const priorityMap = {
    EXPLOSIVES: 1,
    RADIOACTIVE: 1,
    TOXIC: 2,
    GASES: 2,
    OXIDIZING: 3,
    FLAMMABLE_LIQUIDS: 3,
    FLAMMABLE_SOLIDS: 4,
    CORROSIVE: 4,
    MISCELLANEOUS: 5
  };
  return priorityMap[category] || 5;
}

function getPlannedTime(priority) {
  const now = new Date();
  const hoursToAdd = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 24 }[priority] || 24;
  now.setHours(now.getHours() + hoursToAdd);
  return now.toISOString();
}

function getRequiredEquipment(category) {
  const equipmentMap = {
    EXPLOSIVES: ['防爆叉车', '防爆搬运车'],
    GASES: ['气体专用搬运车', '泄漏检测设备'],
    FLAMMABLE_LIQUIDS: ['防泄漏搬运车', '消防设备'],
    FLAMMABLE_SOLIDS: ['防火搬运车', '灭火毯'],
    OXIDIZING: ['耐腐蚀搬运车', '隔离设备'],
    TOXIC: ['防毒面具', '密封搬运箱'],
    RADIOACTIVE: ['铅屏蔽设备', '辐射检测仪'],
    CORROSIVE: ['耐腐蚀搬运车', '中和剂'],
    MISCELLANEOUS: ['标准搬运设备']
  };
  return equipmentMap[category] || ['标准搬运设备'];
}

module.exports = {
  initEngine,
  assignSlot,
  generateJobPlan,
  checkIncompatibleCategories,
  checkIsolation,
  YARD_AREAS
};
