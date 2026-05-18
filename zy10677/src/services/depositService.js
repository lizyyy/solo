const {
  LEASE_STATUS,
  REFUND_STATUS,
  database,
  addHistory,
  createLease,
  createDeposit,
  createInspectionItem,
  createRefundBatch
} = require('../models/store');

const getLeaseById = (id) => {
  return database.leases.get(id);
};

const getAllLeases = () => {
  return Array.from(database.leases.values());
};

const getDepositsByLeaseId = (leaseId) => {
  return Array.from(database.deposits.values()).filter(d => d.leaseId === leaseId);
};

const getInspectionItemsByLeaseId = (leaseId) => {
  return Array.from(database.inspectionItems.values()).filter(i => i.leaseId === leaseId);
};

const getRefundBatchesByLeaseId = (leaseId) => {
  return Array.from(database.refundBatches.values()).filter(b => b.leaseId === leaseId);
};

const getHistoryByEntityId = (entityId) => {
  return database.history.get(entityId) || [];
};

const updateLeaseStatus = (leaseId, status, operator = 'system') => {
  const lease = database.leases.get(leaseId);
  if (!lease) return null;
  
  const oldStatus = lease.status;
  lease.status = status;
  lease.updatedAt = new Date().toISOString();
  database.leases.set(leaseId, lease);
  
  addHistory('lease', leaseId, 'STATUS_CHANGE', { oldStatus, newStatus: status }, operator);
  return lease;
};

const startInspection = (leaseId, operator = 'system') => {
  const lease = database.leases.get(leaseId);
  if (!lease) return { success: false, error: '租赁单不存在' };
  
  if (lease.status !== LEASE_STATUS.RENTING) {
    return { success: false, error: '只有租赁中状态才能开始验收' };
  }
  
  updateLeaseStatus(leaseId, LEASE_STATUS.INSPECTING, operator);
  
  const defaultItems = [
    { leaseId, itemName: '外观完好', itemType: '外观' },
    { leaseId, itemName: '功能正常', itemType: '功能' },
    { leaseId, itemName: '配件齐全', itemType: '配件' }
  ];
  
  defaultItems.forEach(item => createInspectionItem(item));
  
  return { success: true, data: getLeaseById(leaseId) };
};

const processRefund = (leaseId, amount, reason, operator = 'system', attachments = []) => {
  const lease = database.leases.get(leaseId);
  if (!lease) return { success: false, error: '租赁单不存在' };
  
  const deposits = getDepositsByLeaseId(leaseId);
  const totalDeposit = deposits.reduce((sum, d) => sum + d.remainingAmount, 0);
  const totalRefunded = lease.refundedAmount || 0;
  
  const refundAmount = Number(amount);
  
  if (lease.status === LEASE_STATUS.RENTING) {
    return {
      success: false,
      error: '请先完成设备验收',
      nextStep: '开始设备验收，确认设备状态'
    };
  }
  
  if (lease.status === LEASE_STATUS.SETTLED) {
    return {
      success: false,
      error: '该租赁单已结清',
      nextStep: '无需操作，押金已全额退还'
    };
  }
  
  const isFullRefund = refundAmount === lease.depositAmount;
  const isPartialRefund = refundAmount < lease.depositAmount;
  
  if (isFullRefund && totalRefunded > 0) {
    const remainingAmount = lease.depositAmount - totalRefunded;
    return {
      success: false,
      error: '部分退款后不能按全额押金发起退款',
      nextStep: `请按剩余押金金额 ${remainingAmount} 元发起退款，需补充：部分退款确认单、最终验收报告、客户签字确认函`,
      conflict: true,
      remainingAmount
    };
  }
  
  if (refundAmount > totalDeposit) {
    return {
      success: false,
      error: '退款金额不能超过剩余押金',
      nextStep: `请调整退款金额不超过 ${totalDeposit} 元`
    };
  }
  
  const batch = createRefundBatch({
    leaseId,
    amount: refundAmount,
    reason,
    operator,
    attachments
  });
  
  deposits.forEach(deposit => {
    if (deposit.remainingAmount >= refundAmount) {
      deposit.remainingAmount -= refundAmount;
      deposit.refundedAmount += refundAmount;
      database.deposits.set(deposit.id, deposit);
      addHistory('deposit', deposit.id, 'REFUND', { amount: refundAmount });
    }
  });
  
  lease.refundedAmount = (lease.refundedAmount || 0) + refundAmount;
  
  if (lease.refundedAmount >= lease.depositAmount) {
    lease.status = LEASE_STATUS.SETTLED;
    batch.status = REFUND_STATUS.COMPLETED;
  } else {
    lease.status = LEASE_STATUS.PARTIAL_REFUND;
    batch.status = REFUND_STATUS.SUCCESS;
  }
  
  lease.updatedAt = new Date().toISOString();
  batch.updatedAt = new Date().toISOString();
  
  database.leases.set(leaseId, lease);
  database.refundBatches.set(batch.id, batch);
  
  addHistory('lease', leaseId, 'REFUND', { 
    amount: refundAmount,
    refundedSoFar: lease.refundedAmount,
    remaining: lease.depositAmount - lease.refundedAmount
  }, operator);
  
  addHistory('refund', batch.id, 'PROCESS', { 
    status: batch.status,
    amount: refundAmount
  }, operator);
  
  return {
    success: true,
    data: {
      lease: getLeaseById(leaseId),
      batch
    }
  };
};

const rejectRefund = (batchId, reason, operator = 'system') => {
  const batch = database.refundBatches.get(batchId);
  if (!batch) return { success: false, error: '退款批次不存在' };
  
  batch.status = REFUND_STATUS.REJECTED;
  batch.rejectedReason = reason;
  batch.updatedAt = new Date().toISOString();
  database.refundBatches.set(batchId, batch);
  
  addHistory('refund', batchId, 'REJECT', { reason }, operator);
  
  const lease = database.leases.get(batch.leaseId);
  if (lease) {
    lease.refundedAmount -= batch.amount;
    lease.updatedAt = new Date().toISOString();
    database.leases.set(batch.leaseId, lease);
  }
  
  return { success: true, data: batch };
};

const getLeaseDetail = (leaseId) => {
  const lease = getLeaseById(leaseId);
  if (!lease) return null;
  
  return {
    lease,
    deposits: getDepositsByLeaseId(leaseId),
    inspectionItems: getInspectionItemsByLeaseId(leaseId),
    refundBatches: getRefundBatchesByLeaseId(leaseId),
    history: getHistoryByEntityId(leaseId)
  };
};

const exportLeases = () => {
  const leases = getAllLeases();
  return leases.map(lease => ({
    租赁单ID: lease.id,
    设备名称: lease.equipmentName,
    设备编号: lease.equipmentCode,
    客户名称: lease.customerName,
    联系电话: lease.customerPhone,
    租赁开始日期: lease.startDate,
    租赁结束日期: lease.endDate,
    押金金额: lease.depositAmount,
    已退还金额: lease.refundedAmount,
    剩余金额: lease.depositAmount - lease.refundedAmount,
    状态: lease.status,
    创建时间: lease.createdAt,
    更新时间: lease.updatedAt
  }));
};

const importLeases = (dataList, operator = 'system') => {
  const results = {
    success: [],
    failed: [],
    badRows: []
  };
  
  dataList.forEach((data, index) => {
    try {
      if (!data.equipmentName || !data.depositAmount) {
        results.badRows.push({
          row: index + 1,
          data,
          error: '缺少必填字段: 设备名称或押金金额'
        });
        return;
      }
      
      const lease = createLease(data);
      createDeposit(lease.id, data.depositAmount);
      
      results.success.push({
        row: index + 1,
        leaseId: lease.id
      });
    } catch (error) {
      results.failed.push({
        row: index + 1,
        data,
        error: error.message
      });
    }
  });
  
  return results;
};

module.exports = {
  getLeaseById,
  getAllLeases,
  getDepositsByLeaseId,
  getInspectionItemsByLeaseId,
  getRefundBatchesByLeaseId,
  getHistoryByEntityId,
  createLease,
  createDeposit,
  createInspectionItem,
  startInspection,
  processRefund,
  rejectRefund,
  getLeaseDetail,
  exportLeases,
  importLeases
};
