const db = require('../data/database');
const { FAULT_ORDER_STATUS, validateTransition, getStatusLabel } = require('../utils/stateMachine');

class MaintenanceService {
  checkDuplicateRequest(method, endpoint, body) {
    const key = db.generateRequestKey(method, endpoint, body);
    const cached = db.getCachedRequest(key);
    if (cached) {
      return { isDuplicate: true, cachedResponse: cached.response };
    }
    return { isDuplicate: false, requestKey: key };
  }

  createFaultOrder(data) {
    if (!data.elevatorId) {
      throw new Error('电梯ID不能为空');
    }
    if (!data.faultDescription) {
      throw new Error('故障描述不能为空');
    }
    if (!data.operator) {
      throw new Error('操作人不能为空');
    }

    return db.addFaultOrder(data);
  }

  requestParts(faultOrderId, partsRequest, operator) {
    const faultOrder = db.getFaultOrder(faultOrderId);
    if (!faultOrder) {
      throw new Error('故障单不存在');
    }

    validateTransition(faultOrder.status, FAULT_ORDER_STATUS.AWAITING_PARTS);

    if (!partsRequest || partsRequest.length === 0) {
      throw new Error('请至少选择一个备件');
    }

    const requisitions = [];
    const validParts = [];

    for (const part of partsRequest) {
      const batch = db.getSparePartBatchByNo(part.batchNo);
      if (!batch) {
        throw new Error(`备件批次不存在: ${part.batchNo}`);
      }
      if (!Number.isInteger(part.quantity) || part.quantity <= 0) {
        throw new Error(`请求数量不合法: ${part.batchNo}，数量必须为正整数`);
      }
      if (batch.availableQuantity < part.quantity) {
        throw new Error(`备件库存不足: ${batch.partName} (${batch.batchNo})，可用: ${batch.availableQuantity}，请求: ${part.quantity}`);
      }
      validParts.push({
        ...part,
        batchInfo: batch
      });
    }

    for (const part of validParts) {
      const requisition = db.addRequisitionRecord({
        faultOrderId,
        faultOrderNo: faultOrder.orderNo,
        sparePartBatchId: part.batchInfo.id,
        batchNo: part.batchNo,
        partCode: part.batchInfo.partCode,
        partName: part.batchInfo.partName,
        quantity: part.quantity,
        operator
      });
      requisitions.push(requisition);

      db.updateSparePartBatch(part.batchInfo.id, {
        availableQuantity: part.batchInfo.availableQuantity - part.quantity,
        allocatedQuantity: part.batchInfo.allocatedQuantity + part.quantity
      });
    }

    db.addStatusHistory(
      faultOrderId,
      FAULT_ORDER_STATUS.AWAITING_PARTS,
      operator,
      `已申请 ${requisitions.length} 个备件`
    );

    return {
      faultOrder: db.getFaultOrder(faultOrderId),
      requisitions
    };
  }

  signForParts(faultOrderId, signatures, operator) {
    const faultOrder = db.getFaultOrder(faultOrderId);
    if (!faultOrder) {
      throw new Error('故障单不存在');
    }

    if (faultOrder.status !== FAULT_ORDER_STATUS.AWAITING_PARTS) {
      throw new Error(`当前状态不允许签收: ${getStatusLabel(faultOrder.status)}`);
    }

    if (!signatures || signatures.length === 0) {
      throw new Error('请提供签收记录');
    }

    const requisitions = db.getRequisitionRecordsByFaultOrder(faultOrderId);
    if (requisitions.length === 0) {
      throw new Error('该故障单没有待签收的备件领用记录');
    }

    const receiptRecords = [];

    for (const signature of signatures) {
      const requisition = requisitions.find(r => r.id === signature.requisitionId);
      if (!requisition) {
        throw new Error(`领用记录不存在: ${signature.requisitionId}`);
      }
      if (requisition.status !== 'PENDING') {
        throw new Error(`领用记录已处理: ${requisition.requisitionNo}`);
      }
      if (signature.quantity !== requisition.quantity) {
        throw new Error(`签收数量与领用数量不一致: 领用${requisition.quantity}，签收${signature.quantity}`);
      }

      const receipt = db.addReceiptRecord({
        requisitionId: requisition.id,
        requisitionNo: requisition.requisitionNo,
        faultOrderId,
        faultOrderNo: faultOrder.orderNo,
        batchNo: requisition.batchNo,
        partCode: requisition.partCode,
        partName: requisition.partName,
        quantity: signature.quantity,
        receiver: signature.receiver,
        signature: signature.signature,
        operator
      });
      receiptRecords.push(receipt);

      db.updateRequisitionRecord(requisition.id, {
        status: 'SIGNED',
        signedBy: signature.receiver,
        signedAt: receipt.signedAt
      });
    }

    const updatedRequisitions = db.getRequisitionRecordsByFaultOrder(faultOrderId);
    const allSigned = updatedRequisitions.every(r => r.status === 'SIGNED');

    if (allSigned) {
      db.addStatusHistory(
        faultOrderId,
        FAULT_ORDER_STATUS.PARTS_RECEIVED,
        operator,
        `所有备件已签收，共 ${receiptRecords.length} 项`
      );
    }

    return {
      faultOrder: db.getFaultOrder(faultOrderId),
      receipts: receiptRecords
    };
  }

  confirmReplacement(faultOrderId, replacements, operator) {
    const faultOrder = db.getFaultOrder(faultOrderId);
    if (!faultOrder) {
      throw new Error('故障单不存在');
    }

    if (faultOrder.status !== FAULT_ORDER_STATUS.PARTS_RECEIVED) {
      throw new Error(`当前状态不允许确认更换: ${getStatusLabel(faultOrder.status)}`);
    }

    if (!replacements || replacements.length === 0) {
      throw new Error('请提供更换记录');
    }

    const replacementRecords = [];

    for (const replacement of replacements) {
      const requisitions = db.getRequisitionRecordsByFaultOrder(faultOrderId);
      const requisition = requisitions.find(r => r.batchNo === replacement.batchNo);
      
      if (!requisition) {
        throw new Error(`未找到对应领用记录: ${replacement.batchNo}`);
      }

      const receipts = db.getReceiptRecordsByRequisition(requisition.id);
      if (receipts.length === 0) {
        throw new Error(`该备件尚未签收: ${replacement.batchNo}`);
      }

      if (!Number.isInteger(replacement.quantity) || replacement.quantity <= 0) {
        throw new Error(`更换数量不合法: ${replacement.batchNo}，数量必须为正整数`);
      }

      if (replacement.quantity > requisition.quantity) {
        throw new Error(`更换数量超过领用数量: ${replacement.batchNo}`);
      }

      const batch = db.getSparePartBatchByNo(replacement.batchNo);
      if (batch) {
        db.updateSparePartBatch(batch.id, {
          usedQuantity: batch.usedQuantity + replacement.quantity,
          allocatedQuantity: batch.allocatedQuantity - replacement.quantity
        });
      }

      const record = db.addReplacementRecord({
        faultOrderId,
        faultOrderNo: faultOrder.orderNo,
        batchNo: replacement.batchNo,
        partCode: requisition.partCode,
        partName: requisition.partName,
        oldPartSerialNo: replacement.oldPartSerialNo,
        newPartSerialNo: replacement.newPartSerialNo,
        quantity: replacement.quantity,
        replacementDate: replacement.replacementDate,
        technician: replacement.technician,
        remark: replacement.remark,
        operator
      });
      replacementRecords.push(record);
    }

    db.addStatusHistory(
      faultOrderId,
      FAULT_ORDER_STATUS.REPLACED,
      operator,
      `已完成 ${replacementRecords.length} 项零件更换`
    );

    return {
      faultOrder: db.getFaultOrder(faultOrderId),
      replacements: replacementRecords
    };
  }

  completeFaultOrder(faultOrderId, operator, remark = '') {
    const faultOrder = db.getFaultOrder(faultOrderId);
    if (!faultOrder) {
      throw new Error('故障单不存在');
    }

    validateTransition(faultOrder.status, FAULT_ORDER_STATUS.COMPLETED);

    db.addStatusHistory(
      faultOrderId,
      FAULT_ORDER_STATUS.COMPLETED,
      operator,
      remark || '故障单已完成'
    );

    return db.getFaultOrder(faultOrderId);
  }

  revertFaultOrder(faultOrderId, operator, remark = '') {
    const faultOrder = db.getFaultOrder(faultOrderId);
    if (!faultOrder) {
      throw new Error('故障单不存在');
    }

    validateTransition(faultOrder.status, FAULT_ORDER_STATUS.REVERTED);

    if (faultOrder.status === FAULT_ORDER_STATUS.AWAITING_PARTS) {
      const requisitions = db.getRequisitionRecordsByFaultOrder(faultOrderId);
      for (const req of requisitions) {
        if (req.status === 'PENDING') {
          const batch = db.getSparePartBatch(req.sparePartBatchId);
          if (batch) {
            db.updateSparePartBatch(batch.id, {
              availableQuantity: batch.availableQuantity + req.quantity,
              allocatedQuantity: batch.allocatedQuantity - req.quantity
            });
          }
          db.updateRequisitionRecord(req.id, { status: 'CANCELLED' });
        }
      }
    }

    db.addStatusHistory(
      faultOrderId,
      FAULT_ORDER_STATUS.REVERTED,
      operator,
      remark || '故障单已撤回'
    );

    return db.getFaultOrder(faultOrderId);
  }

  restartFaultOrder(faultOrderId, operator, remark = '') {
    const faultOrder = db.getFaultOrder(faultOrderId);
    if (!faultOrder) {
      throw new Error('故障单不存在');
    }

    if (faultOrder.status !== FAULT_ORDER_STATUS.REVERTED) {
      throw new Error('只有已撤回的故障单可以重新启动');
    }

    db.addStatusHistory(
      faultOrderId,
      FAULT_ORDER_STATUS.CREATED,
      operator,
      remark || '故障单已重新启动'
    );

    return db.getFaultOrder(faultOrderId);
  }

  getFaultOrderDetail(faultOrderId) {
    const faultOrder = db.getFaultOrder(faultOrderId);
    if (!faultOrder) {
      return null;
    }

    const requisitions = db.getRequisitionRecordsByFaultOrder(faultOrderId);
    const replacements = db.getReplacementRecordsByFaultOrder(faultOrderId);

    const receipts = [];
    for (const req of requisitions) {
      const reqReceipts = db.getReceiptRecordsByRequisition(req.id);
      receipts.push(...reqReceipts);
    }

    return {
      faultOrder,
      requisitions,
      receipts,
      replacements,
      statusLabel: getStatusLabel(faultOrder.status)
    };
  }

  getFaultOrderList(filters = {}) {
    let orders = db.getAllFaultOrders();

    if (filters.status) {
      orders = orders.filter(o => o.status === filters.status);
    }
    if (filters.elevatorId) {
      orders = orders.filter(o => o.elevatorId === filters.elevatorId);
    }

    return orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  getSparePartList(filters = {}) {
    let batches = db.getAllSparePartBatches();

    if (filters.partName) {
      batches = batches.filter(b => 
        b.partName.toLowerCase().includes(filters.partName.toLowerCase())
      );
    }
    if (filters.availableOnly) {
      batches = batches.filter(b => b.availableQuantity > 0);
    }

    return batches;
  }

  getSummaryReport() {
    const orders = db.getAllFaultOrders();
    const batches = db.getAllSparePartBatches();
    const requisitions = Array.from(db.requisitionRecords.values());
    const receipts = Array.from(db.receiptRecords.values());
    const replacements = Array.from(db.replacementRecords.values());

    const statusCounts = {};
    for (const order of orders) {
      statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
    }

    const totalPartsValue = batches.reduce((sum, b) => sum + b.quantity, 0);
    const usedPartsValue = batches.reduce((sum, b) => sum + b.usedQuantity, 0);
    const availablePartsValue = batches.reduce((sum, b) => sum + b.availableQuantity, 0);

    const closedLoopOrders = orders.filter(o => 
      o.status === FAULT_ORDER_STATUS.REPLACED || 
      o.status === FAULT_ORDER_STATUS.COMPLETED
    ).length;

    const loopDetails = orders.map(order => {
      const reqs = db.getRequisitionRecordsByFaultOrder(order.id);
      const repls = db.getReplacementRecordsByFaultOrder(order.id);
      const allReqsSigned = reqs.length > 0 && reqs.every(r => r.status === 'SIGNED');
      
      return {
        orderNo: order.orderNo,
        elevatorId: order.elevatorId,
        status: order.status,
        statusLabel: getStatusLabel(order.status),
        partsRequested: reqs.length,
        partsSigned: reqs.filter(r => r.status === 'SIGNED').length,
        partsReplaced: repls.length,
        isClosedLoop: allReqsSigned && repls.length > 0
      };
    });

    return {
      statistics: {
        totalOrders: orders.length,
        byStatus: statusCounts,
        closedLoopOrders,
        totalParts: totalPartsValue,
        usedParts: usedPartsValue,
        availableParts: availablePartsValue
      },
      closedLoopDetails: loopDetails,
      recentActivities: [
        ...orders.slice(-5).map(o => ({
          type: 'FAULT_ORDER',
          no: o.orderNo,
          action: getStatusLabel(o.status),
          time: o.updatedAt
        })),
        ...replacements.slice(-5).map(r => ({
          type: 'REPLACEMENT',
          no: r.replacementNo,
          action: `更换 ${r.partName}`,
          time: r.confirmedAt
        }))
      ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 10)
    };
  }
}

module.exports = new MaintenanceService();
