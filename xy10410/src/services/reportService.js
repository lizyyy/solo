const store = require('../data/store');
const workOrderService = require('./workOrderService');

function getCostByStaff(staffId = null, startDate = null, endDate = null) {
  const workOrders = workOrderService.getAllWorkOrders()
    .filter(wo => wo.status === 'COMPLETED' && wo.assignedTo)
    .filter(wo => {
      if (!staffId) return true;
      return wo.assignedTo === staffId;
    })
    .filter(wo => {
      if (!startDate || !endDate) return true;
      const completedDate = new Date(wo.completedAt);
      return completedDate >= new Date(startDate) && completedDate <= new Date(endDate);
    });

  const staffMap = new Map();

  workOrders.forEach(wo => {
    const staff = store.maintenanceStaff.get(wo.assignedTo);
    if (!staff) return;

    if (!staffMap.has(wo.assignedTo)) {
      staffMap.set(wo.assignedTo, {
        staffId: staff.id,
        staffName: staff.name,
        department: staff.department,
        workOrderCount: 0,
        totalCost: 0,
        warrantyCost: 0,
        nonWarrantyCost: 0,
        workOrders: []
      });
    }

    const summary = staffMap.get(wo.assignedTo);
    summary.workOrderCount++;
    summary.totalCost += wo.totalCost;
    summary.warrantyCost += wo.warrantyCost;
    summary.nonWarrantyCost += wo.nonWarrantyCost;
    summary.workOrders.push({
      id: wo.id,
      title: wo.title,
      equipment: wo.equipment?.name,
      totalCost: wo.totalCost,
      warrantyCost: wo.warrantyCost,
      nonWarrantyCost: wo.nonWarrantyCost,
      completedAt: wo.completedAt
    });
  });

  return Array.from(staffMap.values());
}

function getCostByEquipmentType(equipmentType = null, startDate = null, endDate = null) {
  const workOrders = workOrderService.getAllWorkOrders()
    .filter(wo => wo.status === 'COMPLETED' && wo.equipment)
    .filter(wo => {
      if (!equipmentType) return true;
      return wo.equipment.type === equipmentType;
    })
    .filter(wo => {
      if (!startDate || !endDate) return true;
      const completedDate = new Date(wo.completedAt);
      return completedDate >= new Date(startDate) && completedDate <= new Date(endDate);
    });

  const typeMap = new Map();
  const typeNames = {
    'AC': '空调设备',
    'MOTOR': '电机设备',
    'SENSOR': '传感器设备'
  };

  workOrders.forEach(wo => {
    const type = wo.equipment.type;
    if (!typeMap.has(type)) {
      typeMap.set(type, {
        equipmentType: type,
        typeName: typeNames[type] || type,
        equipmentCount: new Set(),
        workOrderCount: 0,
        totalCost: 0,
        warrantyCost: 0,
        nonWarrantyCost: 0,
        workOrders: []
      });
    }

    const summary = typeMap.get(type);
    summary.equipmentCount.add(wo.equipment.id);
    summary.workOrderCount++;
    summary.totalCost += wo.totalCost;
    summary.warrantyCost += wo.warrantyCost;
    summary.nonWarrantyCost += wo.nonWarrantyCost;
    summary.workOrders.push({
      id: wo.id,
      title: wo.title,
      equipmentId: wo.equipment.id,
      equipmentName: wo.equipment.name,
      totalCost: wo.totalCost,
      warrantyCost: wo.warrantyCost,
      nonWarrantyCost: wo.nonWarrantyCost,
      completedAt: wo.completedAt
    });
  });

  return Array.from(typeMap.values()).map(item => ({
    ...item,
    equipmentCount: item.equipmentCount.size
  }));
}

function getInventoryStatus() {
  return Array.from(store.inventory.values()).map(item => {
    const part = store.spareParts.get(item.partId);
    return {
      partId: item.partId,
      partName: part.name,
      category: part.category,
      unitPrice: part.unitPrice,
      underWarranty: part.underWarranty,
      quantity: item.quantity,
      minStock: item.minStock,
      totalValue: item.quantity * part.unitPrice,
      lowStock: item.quantity <= item.minStock
    };
  });
}

module.exports = {
  getCostByStaff,
  getCostByEquipmentType,
  getInventoryStatus
};
