const utils = require('./utils');
const {
  MATERIALS_FILE,
  ACTIVITIES_FILE,
  LEADERS_FILE,
  RETURNS_FILE,
  LOSSES_FILE,
  DAMAGES_FILE,
  CONSUMPTIONS_FILE,
  INVENTORY_FILE,
  ACTIVITY_DEMANDS_FILE,
  readJSON,
  writeJSON,
  generateId
} = utils;

function addMaterial({ code, name, unit, initialStock, description }) {
  const materials = readJSON(MATERIALS_FILE, []);
  if (materials.some(m => m.code === code)) {
    throw new Error(`物料代码 ${code} 已存在`);
  }
  
  const material = {
    id: generateId(),
    code,
    name,
    unit,
    initialStock: initialStock || 0,
    description: description || '',
    createdAt: new Date().toISOString()
  };
  
  materials.push(material);
  writeJSON(MATERIALS_FILE, materials);
  
  updateInventory(code, initialStock || 0);
  
  return material;
}

function getMaterials() {
  return readJSON(MATERIALS_FILE, []);
}

function getMaterialByCode(code) {
  return getMaterials().find(m => m.code === code);
}

function addActivity({ id, name, startDate, endDate, location }) {
  const activities = readJSON(ACTIVITIES_FILE, []);
  if (activities.some(a => a.id === id)) {
    throw new Error(`活动ID ${id} 已存在`);
  }
  
  const activity = {
    id,
    name,
    startDate,
    endDate,
    location: location || '',
    createdAt: new Date().toISOString()
  };
  
  activities.push(activity);
  writeJSON(ACTIVITIES_FILE, activities);
  
  return activity;
}

function getActivities() {
  return readJSON(ACTIVITIES_FILE, []);
}

function getActivityById(id) {
  return getActivities().find(a => a.id === id);
}

function addLeader(activityId, materials) {
  if (!getActivityById(activityId)) {
    throw new Error(`活动ID ${activityId} 不存在`);
  }
  
  const leaders = readJSON(LEADERS_FILE, []);
  
  for (const item of materials) {
    const material = getMaterialByCode(item.code);
    if (!material) {
      throw new Error(`物料代码 ${item.code} 不存在`);
    }
    
    const leader = {
      id: generateId(),
      activityId,
      materialCode: item.code,
      materialName: material.name,
      quantity: item.quantity,
      unit: material.unit,
      createdAt: new Date().toISOString()
    };
    
    leaders.push(leader);
  }
  
  writeJSON(LEADERS_FILE, leaders);
  
  for (const item of materials) {
    updateInventory(item.code, -item.quantity);
  }
  
  return materials.map((item, index) => ({
    ...leaders[leaders.length - materials.length + index]
  }));
}

function getLeaders() {
  return readJSON(LEADERS_FILE, []);
}

function getLeadersByActivity(activityId) {
  return getLeaders().filter(l => l.activityId === activityId);
}

function addReturn({ activityId, materialCode, quantity, remark }) {
  const material = getMaterialByCode(materialCode);
  if (!material) {
    throw new Error(`物料代码 ${materialCode} 不存在`);
  }
  
  if (!getActivityById(activityId)) {
    throw new Error(`活动ID ${activityId} 不存在`);
  }
  
  const leaders = getLeadersByActivity(activityId);
  const leader = leaders.find(l => l.materialCode === materialCode);
  if (!leader) {
    throw new Error(`活动 ${activityId} 没有领用物料 ${materialCode}`);
  }
  
  const returns = readJSON(RETURNS_FILE, []);
  const returnItem = {
    id: generateId(),
    activityId,
    materialCode,
    materialName: material.name,
    quantity,
    unit: material.unit,
    remark: remark || '',
    createdAt: new Date().toISOString()
  };
  
  returns.push(returnItem);
  writeJSON(RETURNS_FILE, returns);
  
  updateInventory(materialCode, quantity);
  
  return returnItem;
}

function getReturns() {
  return readJSON(RETURNS_FILE, []);
}

function getReturnsByActivity(activityId) {
  return getReturns().filter(r => r.activityId === activityId);
}

function getReturnsByMaterial(activityId, materialCode) {
  return getReturns().filter(r => r.activityId === activityId && r.materialCode === materialCode);
}

function addLoss({ activityId, materialCode, quantity, reason, remark }) {
  const material = getMaterialByCode(materialCode);
  if (!material) {
    throw new Error(`物料代码 ${materialCode} 不存在`);
  }
  
  if (!getActivityById(activityId)) {
    throw new Error(`活动ID ${activityId} 不存在`);
  }
  
  const losses = readJSON(LOSSES_FILE, []);
  const lossItem = {
    id: generateId(),
    activityId,
    materialCode,
    materialName: material.name,
    quantity,
    unit: material.unit,
    reason: reason || '未说明',
    remark: remark || '',
    createdAt: new Date().toISOString()
  };
  
  losses.push(lossItem);
  writeJSON(LOSSES_FILE, losses);
  
  return lossItem;
}

function getLosses() {
  return readJSON(LOSSES_FILE, []);
}

function getLossesByActivity(activityId) {
  return getLosses().filter(l => l.activityId === activityId);
}

function addDamage({ activityId, materialCode, quantity, reason, remark }) {
  const material = getMaterialByCode(materialCode);
  if (!material) {
    throw new Error(`物料代码 ${materialCode} 不存在`);
  }
  
  if (!getActivityById(activityId)) {
    throw new Error(`活动ID ${activityId} 不存在`);
  }
  
  const damages = readJSON(DAMAGES_FILE, []);
  const damageItem = {
    id: generateId(),
    activityId,
    materialCode,
    materialName: material.name,
    quantity,
    unit: material.unit,
    reason: reason || '未说明',
    remark: remark || '',
    createdAt: new Date().toISOString()
  };
  
  damages.push(damageItem);
  writeJSON(DAMAGES_FILE, damages);
  
  return damageItem;
}

function getDamages() {
  return readJSON(DAMAGES_FILE, []);
}

function getDamagesByActivity(activityId) {
  return getDamages().filter(d => d.activityId === activityId);
}

function addConsumption({ activityId, materialCode, quantity, description }) {
  const material = getMaterialByCode(materialCode);
  if (!material) {
    throw new Error(`物料代码 ${materialCode} 不存在`);
  }
  
  if (!getActivityById(activityId)) {
    throw new Error(`活动ID ${activityId} 不存在`);
  }
  
  if (!description || description.trim() === '') {
    throw new Error('礼品消耗必须说明消耗原因/去向');
  }
  
  const consumptions = readJSON(CONSUMPTIONS_FILE, []);
  const consumptionItem = {
    id: generateId(),
    activityId,
    materialCode,
    materialName: material.name,
    quantity,
    unit: material.unit,
    description,
    createdAt: new Date().toISOString()
  };
  
  consumptions.push(consumptionItem);
  writeJSON(CONSUMPTIONS_FILE, consumptions);
  
  return consumptionItem;
}

function getConsumptions() {
  return readJSON(CONSUMPTIONS_FILE, []);
}

function getConsumptionsByActivity(activityId) {
  return getConsumptions().filter(c => c.activityId === activityId);
}

function updateInventory(materialCode, quantityChange) {
  const inventory = readJSON(INVENTORY_FILE, {});
  const current = inventory[materialCode] || 0;
  inventory[materialCode] = current + quantityChange;
  writeJSON(INVENTORY_FILE, inventory);
}

function getInventory() {
  return readJSON(INVENTORY_FILE, {});
}

function getMaterialInventory(materialCode) {
  const inventory = getInventory();
  return inventory[materialCode] || 0;
}

function addActivityDemand(activityId, demands) {
  if (!getActivityById(activityId)) {
    throw new Error(`活动ID ${activityId} 不存在`);
  }
  
  const allDemands = readJSON(ACTIVITY_DEMANDS_FILE, {});
  const activityDemand = allDemands[activityId] || [];
  
  for (const item of demands) {
    const material = getMaterialByCode(item.code);
    if (!material) {
      throw new Error(`物料代码 ${item.code} 不存在`);
    }
    
    const existing = activityDemand.find(d => d.materialCode === item.code);
    if (existing) {
      existing.quantity = item.quantity;
    } else {
      activityDemand.push({
        materialCode: item.code,
        materialName: material.name,
        quantity: item.quantity,
        unit: material.unit
      });
    }
  }
  
  allDemands[activityId] = activityDemand;
  writeJSON(ACTIVITY_DEMANDS_FILE, allDemands);
  
  return activityDemand;
}

function getActivityDemands() {
  return readJSON(ACTIVITY_DEMANDS_FILE, {});
}

function getActivityDemand(activityId) {
  const allDemands = getActivityDemands();
  return allDemands[activityId] || [];
}

module.exports = {
  addMaterial,
  getMaterials,
  getMaterialByCode,
  addActivity,
  getActivities,
  getActivityById,
  addLeader,
  getLeaders,
  getLeadersByActivity,
  addReturn,
  getReturns,
  getReturnsByActivity,
  getReturnsByMaterial,
  addLoss,
  getLosses,
  getLossesByActivity,
  addDamage,
  getDamages,
  getDamagesByActivity,
  addConsumption,
  getConsumptions,
  getConsumptionsByActivity,
  updateInventory,
  getInventory,
  getMaterialInventory,
  addActivityDemand,
  getActivityDemands,
  getActivityDemand
};
