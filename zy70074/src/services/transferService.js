const { 
  storage, 
  TransferStatus, 
  TransferValidTransitions, 
  AssetStatus,
  generateId 
} = require('../data/store');
const { createError, ErrorCodes: EC } = require('./errors');
const assetService = require('./assetService');

function getTransferById(id) {
  return storage.transferOrders.find(t => t.id === id);
}

function getActiveTransferByAsset(assetId) {
  return storage.transferOrders.find(t => 
    t.assetId === assetId && 
    [TransferStatus.DRAFT, TransferStatus.PENDING_APPROVAL, TransferStatus.APPROVED].includes(t.status)
  );
}

function listTransfers(filters = {}) {
  let results = [...storage.transferOrders];
  
  if (filters.assetId) {
    results = results.filter(t => t.assetId === filters.assetId);
  }
  if (filters.status) {
    results = results.filter(t => t.status === filters.status);
  }
  if (filters.outgoingDepartment) {
    results = results.filter(t => t.outgoingDepartment === filters.outgoingDepartment);
  }
  if (filters.incomingDepartment) {
    results = results.filter(t => t.incomingDepartment === filters.incomingDepartment);
  }
  
  return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function canTransition(fromStatus, toStatus) {
  const validNext = TransferValidTransitions[fromStatus];
  return validNext && validNext.includes(toStatus);
}

function getTransferStatusDisplayName(status) {
  const names = {
    [TransferStatus.DRAFT]: '草稿',
    [TransferStatus.PENDING_APPROVAL]: '待审批',
    [TransferStatus.APPROVED]: '已批准',
    [TransferStatus.REJECTED]: '已拒绝',
    [TransferStatus.COMPLETED]: '已完成',
    [TransferStatus.CANCELLED]: '已取消'
  };
  return names[status] || status;
}

function validateTransition(fromStatus, toStatus) {
  if (!canTransition(fromStatus, toStatus)) {
    throw createError(EC.TRANSFER_INVALID_TRANSITION, {
      fromStatus,
      toStatus,
      fromStatusName: getTransferStatusDisplayName(fromStatus),
      toStatusName: getTransferStatusDisplayName(toStatus),
      validNextStatuses: TransferValidTransitions[fromStatus] || [],
      reason: `调拨单当前状态为「${getTransferStatusDisplayName(fromStatus)}」，不能变更为「${getTransferStatusDisplayName(toStatus)}」`
    }, `调拨单状态「${getTransferStatusDisplayName(fromStatus)}」不允许流转到「${getTransferStatusDisplayName(toStatus)}」`);
  }
}

function recordApproval(transferId, operator, action, remark = null) {
  const record = {
    id: generateId(),
    transferId,
    operator,
    action,
    remark,
    createdAt: new Date().toISOString()
  };
  storage.approvalRecords.push(record);
  return record;
}

function createTransfer(data) {
  const asset = assetService.checkAssetAvailableForTransfer(data.assetId);
  
  const existingActive = getActiveTransferByAsset(data.assetId);
  if (existingActive) {
    throw createError(EC.TRANSFER_ALREADY_EXISTS, {
      assetId: data.assetId,
      assetNo: asset.assetNo,
      existingTransferId: existingActive.id,
      existingTransferStatus: existingActive.status,
      reason: `资产「${asset.assetNo}」已有状态为「${getTransferStatusDisplayName(existingActive.status)}」的调拨单，请先完成或取消该调拨单`
    }, `资产「${asset.assetNo}」已有正在进行的调拨单`);
  }
  
  const now = new Date().toISOString();
  const transfer = {
    id: generateId(),
    assetId: data.assetId,
    assetNo: asset.assetNo,
    assetType: asset.assetType,
    outgoingResponsiblePerson: asset.responsiblePerson,
    outgoingResponsiblePersonId: asset.responsiblePersonId,
    outgoingDepartment: asset.department,
    outgoingDepreciationDepartment: asset.depreciationDepartment,
    incomingResponsiblePerson: data.incomingResponsiblePerson,
    incomingResponsiblePersonId: data.incomingResponsiblePersonId,
    incomingDepartment: data.incomingDepartment,
    incomingDepreciationDepartment: data.incomingDepreciationDepartment || data.incomingDepartment,
    transferReason: data.transferReason,
    status: TransferStatus.DRAFT,
    createdBy: data.createdBy || 'system',
    approvedBy: null,
    approvedAt: null,
    approvalRemark: null,
    completedBy: null,
    completedAt: null,
    version: 1,
    createdAt: now,
    updatedAt: now
  };
  
  storage.transferOrders.push(transfer);
  recordApproval(transfer.id, transfer.createdBy, 'CREATE_DRAFT', '创建调拨草稿');
  
  return transfer;
}

function submitForApproval(transferId, operator) {
  const transfer = getTransferById(transferId);
  if (!transfer) {
    throw createError(EC.TRANSFER_NOT_FOUND, { transferId });
  }
  
  validateTransition(transfer.status, TransferStatus.PENDING_APPROVAL);
  
  assetService.checkAssetAvailableForTransfer(transfer.assetId);
  
  const existingActive = getActiveTransferByAsset(transfer.assetId);
  if (existingActive && existingActive.id !== transferId) {
    throw createError(EC.TRANSFER_ALREADY_EXISTS, {
      assetId: transfer.assetId,
      assetNo: transfer.assetNo,
      existingTransferId: existingActive.id,
      reason: `提交时发现资产「${transfer.assetNo}」已有其他正在进行的调拨单`
    });
  }
  
  transfer.status = TransferStatus.PENDING_APPROVAL;
  transfer.version++;
  transfer.updatedAt = new Date().toISOString();
  
  recordApproval(transferId, operator, 'SUBMIT', '提交审批');
  
  return transfer;
}

function approve(transferId, operator, remark = null) {
  const transfer = getTransferById(transferId);
  if (!transfer) {
    throw createError(EC.TRANSFER_NOT_FOUND, { transferId });
  }
  
  validateTransition(transfer.status, TransferStatus.APPROVED);
  
  if (operator === transfer.outgoingResponsiblePersonId) {
    throw createError(EC.APPROVAL_NOT_ALLOWED, {
      transferId,
      operator,
      reason: '调出责任人不能审批自己发起的调拨单'
    }, '调出责任人不能审批自己发起的调拨单');
  }
  
  transfer.status = TransferStatus.APPROVED;
  transfer.approvedBy = operator;
  transfer.approvedAt = new Date().toISOString();
  transfer.approvalRemark = remark;
  transfer.version++;
  transfer.updatedAt = transfer.approvedAt;
  
  const asset = assetService.getAssetById(transfer.assetId);
  if (asset) {
    assetService.updateAsset(transfer.assetId, {
      status: AssetStatus.TRANSFERRING
    });
  }
  
  recordApproval(transferId, operator, 'APPROVE', remark || '审批通过');
  
  return transfer;
}

function reject(transferId, operator, remark = null) {
  const transfer = getTransferById(transferId);
  if (!transfer) {
    throw createError(EC.TRANSFER_NOT_FOUND, { transferId });
  }
  
  validateTransition(transfer.status, TransferStatus.REJECTED);
  
  transfer.status = TransferStatus.REJECTED;
  transfer.approvedBy = operator;
  transfer.approvedAt = new Date().toISOString();
  transfer.approvalRemark = remark || '审批拒绝';
  transfer.version++;
  transfer.updatedAt = transfer.approvedAt;
  
  recordApproval(transferId, operator, 'REJECT', remark || '审批拒绝');
  
  return transfer;
}

function cancel(transferId, operator, remark = null) {
  const transfer = getTransferById(transferId);
  if (!transfer) {
    throw createError(EC.TRANSFER_NOT_FOUND, { transferId });
  }
  
  validateTransition(transfer.status, TransferStatus.CANCELLED);
  
  transfer.status = TransferStatus.CANCELLED;
  transfer.version++;
  transfer.updatedAt = new Date().toISOString();
  
  recordApproval(transferId, operator, 'CANCEL', remark || '取消调拨');
  
  return transfer;
}

function complete(transferId, operator, remark = null) {
  const transfer = getTransferById(transferId);
  if (!transfer) {
    throw createError(EC.TRANSFER_NOT_FOUND, { transferId });
  }
  
  validateTransition(transfer.status, TransferStatus.COMPLETED);
  
  assetService.updateAssetAfterTransfer(transfer.assetId, transfer);
  
  transfer.status = TransferStatus.COMPLETED;
  transfer.completedBy = operator;
  transfer.completedAt = new Date().toISOString();
  transfer.version++;
  transfer.updatedAt = transfer.completedAt;
  
  recordApproval(transferId, operator, 'COMPLETE', remark || '调拨完成，责任人和折旧部门已更新');
  
  return transfer;
}

function getApprovalHistory(transferId) {
  return storage.approvalRecords
    .filter(r => r.transferId === transferId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

module.exports = {
  getTransferById,
  getActiveTransferByAsset,
  listTransfers,
  canTransition,
  createTransfer,
  submitForApproval,
  approve,
  reject,
  cancel,
  complete,
  getApprovalHistory,
  getTransferStatusDisplayName
};
