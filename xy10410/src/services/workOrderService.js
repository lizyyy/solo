const store = require('../data/store');

const WorkOrderStatus = {
  CREATED: 'CREATED',
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
};

function createWorkOrder(data) {
  const { equipmentId, title, description, priority, createdBy } = data;

  if (!store.equipment.has(equipmentId)) {
    throw new Error(`设备不存在: ${equipmentId}`);
  }

  const workOrder = {
    id: store.generateId(),
    equipmentId,
    equipment: store.equipment.get(equipmentId),
    title,
    description,
    priority: priority || 'NORMAL',
    status: WorkOrderStatus.CREATED,
    createdBy,
    createdAt: new Date().toISOString(),
    assignedTo: null,
    assignedAt: null,
    completedAt: null,
    totalCost: 0,
    warrantyCost: 0,
    nonWarrantyCost: 0
  };

  store.workOrders.set(workOrder.id, workOrder);
  return workOrder;
}

function assignWorkOrder(workOrderId, staffId) {
  const workOrder = store.workOrders.get(workOrderId);
  if (!workOrder) {
    throw new Error(`工单不存在: ${workOrderId}`);
  }

  if (!store.maintenanceStaff.has(staffId)) {
    throw new Error(`维修人员不存在: ${staffId}`);
  }

  if (workOrder.status !== WorkOrderStatus.CREATED) {
    throw new Error(`当前状态不能派工: ${workOrder.status}`);
  }

  workOrder.status = WorkOrderStatus.ASSIGNED;
  workOrder.assignedTo = staffId;
  workOrder.assignedAt = new Date().toISOString();
  workOrder.staff = store.maintenanceStaff.get(staffId);

  return workOrder;
}

function completeWorkOrder(workOrderId, remarks) {
  const workOrder = store.workOrders.get(workOrderId);
  if (!workOrder) {
    throw new Error(`工单不存在: ${workOrderId}`);
  }

  if (workOrder.status !== WorkOrderStatus.IN_PROGRESS && workOrder.status !== WorkOrderStatus.ASSIGNED) {
    throw new Error(`当前状态不能完工: ${workOrder.status}`);
  }

  calculateWorkOrderCost(workOrderId);

  workOrder.status = WorkOrderStatus.COMPLETED;
  workOrder.completedAt = new Date().toISOString();
  workOrder.remarks = remarks;

  return workOrder;
}

function getWorkOrder(workOrderId) {
  return store.workOrders.get(workOrderId);
}

function getAllWorkOrders() {
  return Array.from(store.workOrders.values());
}

function calculateWorkOrderCost(workOrderId) {
  const workOrder = store.workOrders.get(workOrderId);
  if (!workOrder) {
    throw new Error(`工单不存在: ${workOrderId}`);
  }

  const reqs = Array.from(store.requisitions.values())
    .filter(r => r.workOrderId === workOrderId && r.status !== 'REJECTED');

  let totalCost = 0;
  let warrantyCost = 0;
  let nonWarrantyCost = 0;

  reqs.forEach(req => {
    const consumedQuantity = req.consumedQuantity || 0;
    if (consumedQuantity > 0) {
      const part = store.spareParts.get(req.partId);
      const itemCost = consumedQuantity * part.unitPrice;
      totalCost += itemCost;

      if (part.underWarranty) {
        warrantyCost += itemCost;
      } else {
        nonWarrantyCost += itemCost;
      }
    }
  });

  workOrder.totalCost = totalCost;
  workOrder.warrantyCost = warrantyCost;
  workOrder.nonWarrantyCost = nonWarrantyCost;

  return { totalCost, warrantyCost, nonWarrantyCost };
}

function canRequisitionParts(workOrderId) {
  const workOrder = store.workOrders.get(workOrderId);
  if (!workOrder) {
    throw new Error(`工单不存在: ${workOrderId}`);
  }

  if (workOrder.status === WorkOrderStatus.CREATED) {
    return { allowed: false, reason: '工单未派工，不能领料' };
  }

  if (workOrder.status === WorkOrderStatus.COMPLETED) {
    return { allowed: false, reason: '工单已完工' };
  }

  return { allowed: true };
}

function isWorkOrderCompleted(workOrderId) {
  const workOrder = store.workOrders.get(workOrderId);
  return workOrder && workOrder.status === WorkOrderStatus.COMPLETED;
}

module.exports = {
  WorkOrderStatus,
  createWorkOrder,
  assignWorkOrder,
  completeWorkOrder,
  getWorkOrder,
  getAllWorkOrders,
  calculateWorkOrderCost,
  canRequisitionParts,
  isWorkOrderCompleted
};
