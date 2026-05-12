const { storage, generateId, save, EQUIPMENT_STATUS } = require('../utils/storage');
const auditService = require('./auditService');

async function createEquipment(data, operator = 'system') {
  const equipmentId = generateId('EQ');
  const equipment = {
    equipmentId,
    name: data.name,
    model: data.model,
    category: data.category,
    depositAmount: data.depositAmount,
    dailyRentalFee: data.dailyRentalFee,
    overdueDailyRate: data.overdueDailyRate || 1.5,
    status: EQUIPMENT_STATUS.AVAILABLE,
    createdAt: new Date().toISOString(),
    createdBy: operator,
    lastModifiedAt: new Date().toISOString(),
    lastModifiedBy: operator
  };
  
  storage.equipment[equipmentId] = equipment;
  storage.statusHistory[equipmentId] = [];
  
  await auditService.log({
    entityType: 'EQUIPMENT',
    entityId: equipmentId,
    action: 'CREATE',
    before: null,
    after: equipment,
    operator,
    description: `创建设备: ${equipment.name} (${equipment.model})`
  });
  
  await save();
  return equipment;
}

async function updateEquipment(equipmentId, data, operator = 'system') {
  const equipment = storage.equipment[equipmentId];
  if (!equipment) {
    throw new Error(`设备不存在: ${equipmentId}`);
  }
  
  const before = JSON.parse(JSON.stringify(equipment));
  
  Object.assign(equipment, {
    ...data,
    lastModifiedAt: new Date().toISOString(),
    lastModifiedBy: operator
  });
  
  delete equipment.equipmentId;
  delete equipment.createdAt;
  delete equipment.createdBy;
  
  await auditService.log({
    entityType: 'EQUIPMENT',
    entityId: equipmentId,
    action: 'UPDATE',
    before,
    after: equipment,
    operator,
    description: `更新设备信息: ${equipment.name}`
  });
  
  await save();
  return equipment;
}

async function getEquipment(equipmentId) {
  return storage.equipment[equipmentId] || null;
}

async function listEquipment(filters = {}) {
  let list = Object.values(storage.equipment);
  
  if (filters.status) {
    list = list.filter(e => e.status === filters.status);
  }
  if (filters.category) {
    list = list.filter(e => e.category === filters.category);
  }
  
  return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function getEquipmentStatusHistory(equipmentId) {
  return storage.statusHistory[equipmentId] || [];
}

async function updateEquipmentStatus(equipmentId, status, operator = 'system', reason = '') {
  const equipment = storage.equipment[equipmentId];
  if (!equipment) {
    throw new Error(`设备不存在: ${equipmentId}`);
  }
  
  const beforeStatus = equipment.status;
  equipment.status = status;
  equipment.lastModifiedAt = new Date().toISOString();
  equipment.lastModifiedBy = operator;
  
  const historyEntry = {
    equipmentId,
    fromStatus: beforeStatus,
    toStatus: status,
    operator,
    reason,
    timestamp: new Date().toISOString()
  };
  
  if (!storage.statusHistory[equipmentId]) {
    storage.statusHistory[equipmentId] = [];
  }
  storage.statusHistory[equipmentId].push(historyEntry);
  
  await auditService.log({
    entityType: 'EQUIPMENT',
    entityId: equipmentId,
    action: 'STATUS_CHANGE',
    before: { status: beforeStatus },
    after: { status },
    operator,
    description: `设备状态变更: ${beforeStatus} -> ${status}${reason ? ` (${reason})` : ''}`
  });
  
  await save();
  return equipment;
}

module.exports = {
  createEquipment,
  updateEquipment,
  getEquipment,
  listEquipment,
  getEquipmentStatusHistory,
  updateEquipmentStatus
};