const store = require('../data/store');
const workOrderService = require('./workOrderService');

const RequisitionStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  ISSUED: 'ISSUED',
  CONSUMED: 'CONSUMED'
};

function checkDuplicateRequisition(workOrderId, partId, excludeReqId = null) {
  const existing = Array.from(store.requisitions.values())
    .find(r => r.workOrderId === workOrderId 
      && r.partId === partId 
      && r.status !== RequisitionStatus.REJECTED
      && r.id !== excludeReqId);
  
  if (existing) {
    const part = store.spareParts.get(partId);
    throw new Error(`同一工单下不能重复领用备件: ${part.name} (${partId})`);
  }
  return true;
}

function checkInventory(partId, requestedQuantity) {
  const stock = store.inventory.get(partId);
  if (!stock) {
    throw new Error(`备件库存记录不存在: ${partId}`);
  }
  if (stock.quantity < requestedQuantity) {
    const part = store.spareParts.get(partId);
    throw new Error(`库存不足: ${part.name} 库存 ${stock.quantity}, 申请 ${requestedQuantity}`);
  }
  return true;
}

function createRequisition(data) {
  const { workOrderId, partId, requestedQuantity, requestedBy, reason } = data;

  const canReq = workOrderService.canRequisitionParts(workOrderId);
  if (!canReq.allowed) {
    throw new Error(canReq.reason);
  }

  if (!store.spareParts.has(partId)) {
    throw new Error(`备件不存在: ${partId}`);
  }

  if (!requestedQuantity || requestedQuantity <= 0) {
    throw new Error('申请数量必须大于0');
  }

  checkDuplicateRequisition(workOrderId, partId);
  checkInventory(partId, requestedQuantity);

  const workOrder = workOrderService.getWorkOrder(workOrderId);
  const part = store.spareParts.get(partId);

  const requisition = {
    id: store.generateId(),
    workOrderId,
    workOrder: {
      id: workOrder.id,
      title: workOrder.title,
      equipment: workOrder.equipment
    },
    partId,
    part: { ...part },
    requestedQuantity,
    approvedQuantity: 0,
    issuedQuantity: 0,
    consumedQuantity: 0,
    returnedQuantity: 0,
    status: RequisitionStatus.PENDING,
    requestedBy,
    reason,
    createdAt: new Date().toISOString(),
    approvedBy: null,
    approvedAt: null,
    approvalRemark: null
  };

  store.requisitions.set(requisition.id, requisition);
  return requisition;
}

function updateRequisition(reqId, data) {
  const req = store.requisitions.get(reqId);
  if (!req) {
    throw new Error(`领用记录不存在: ${reqId}`);
  }

  if (workOrderService.isWorkOrderCompleted(req.workOrderId)) {
    throw new Error('工单已完工，不能修改领用数量');
  }

  if (req.status !== RequisitionStatus.PENDING) {
    throw new Error('只有待审批状态才能修改');
  }

  const { requestedQuantity } = data;
  if (requestedQuantity) {
    checkInventory(req.partId, requestedQuantity);
    req.requestedQuantity = requestedQuantity;
  }

  return req;
}

function approveRequisition(reqId, data) {
  const { approvedBy, approvedQuantity, approvalRemark } = data;
  const req = store.requisitions.get(reqId);

  if (!req) {
    throw new Error(`领用记录不存在: ${reqId}`);
  }

  if (req.status !== RequisitionStatus.PENDING) {
    throw new Error(`当前状态不能审批: ${req.status}`);
  }

  if (approvedQuantity > req.requestedQuantity) {
    throw new Error('审批数量不能大于申请数量');
  }

  if (approvedQuantity <= 0) {
    req.status = RequisitionStatus.REJECTED;
    req.approvedQuantity = 0;
  } else {
    checkInventory(req.partId, approvedQuantity);
    req.status = RequisitionStatus.APPROVED;
    req.approvedQuantity = approvedQuantity;
  }

  req.approvedBy = approvedBy;
  req.approvedAt = new Date().toISOString();
  req.approvalRemark = approvalRemark;

  const workOrder = workOrderService.getWorkOrder(req.workOrderId);
  if (workOrder && workOrder.status === 'ASSIGNED') {
    workOrder.status = 'IN_PROGRESS';
  }

  return req;
}

function issueRequisition(reqId, issuedBy) {
  const req = store.requisitions.get(reqId);
  if (!req) {
    throw new Error(`领用记录不存在: ${reqId}`);
  }

  if (req.status !== RequisitionStatus.APPROVED) {
    throw new Error(`当前状态不能出库: ${req.status}`);
  }

  checkInventory(req.partId, req.approvedQuantity);

  const stock = store.inventory.get(req.partId);
  stock.quantity -= req.approvedQuantity;

  req.status = RequisitionStatus.ISSUED;
  req.issuedQuantity = req.approvedQuantity;
  req.issuedBy = issuedBy;
  req.issuedAt = new Date().toISOString();

  return req;
}

function consumeRequisition(reqId, consumedQuantity) {
  const req = store.requisitions.get(reqId);
  if (!req) {
    throw new Error(`领用记录不存在: ${reqId}`);
  }

  if (req.status !== RequisitionStatus.ISSUED) {
    throw new Error(`当前状态不能消耗: ${req.status}`);
  }

  if (consumedQuantity < 0 || consumedQuantity > req.issuedQuantity) {
    throw new Error(`消耗数量必须在 0-${req.issuedQuantity} 之间`);
  }

  req.consumedQuantity = consumedQuantity;
  req.returnedQuantity = req.issuedQuantity - consumedQuantity;
  req.status = RequisitionStatus.CONSUMED;
  req.consumedAt = new Date().toISOString();

  return req;
}

function returnRequisition(reqId, returnRemark) {
  const req = store.requisitions.get(reqId);
  if (!req) {
    throw new Error(`领用记录不存在: ${reqId}`);
  }

  if (req.status !== RequisitionStatus.CONSUMED) {
    throw new Error(`当前状态不能退回: ${req.status}`);
  }

  if (req.returnedQuantity <= 0) {
    throw new Error('没有需要退回的备件');
  }

  const stock = store.inventory.get(req.partId);
  stock.quantity += req.returnedQuantity;

  req.returnedAt = new Date().toISOString();
  req.returnRemark = returnRemark;

  workOrderService.calculateWorkOrderCost(req.workOrderId);

  return req;
}

function getRequisition(reqId) {
  return store.requisitions.get(reqId);
}

function getRequisitionsByWorkOrder(workOrderId) {
  return Array.from(store.requisitions.values())
    .filter(r => r.workOrderId === workOrderId);
}

function getAllRequisitions() {
  return Array.from(store.requisitions.values());
}

module.exports = {
  RequisitionStatus,
  createRequisition,
  updateRequisition,
  approveRequisition,
  issueRequisition,
  consumeRequisition,
  returnRequisition,
  getRequisition,
  getRequisitionsByWorkOrder,
  getAllRequisitions
};
