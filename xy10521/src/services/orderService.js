const { storage, generateId, save, ORDER_STATUS, TRANSACTION_TYPE, FEE_TYPE, EQUIPMENT_STATUS } = require('../utils/storage');
const equipmentService = require('./equipmentService');
const depositService = require('./depositService');
const auditService = require('./auditService');
const idempotencyService = require('./idempotencyService');

async function createRentalOrder(data, operator = 'system') {
  const equipment = storage.equipment[data.equipmentId];
  if (!equipment) {
    throw new Error(`设备不存在: ${data.equipmentId}`);
  }
  
  if (equipment.status !== EQUIPMENT_STATUS.AVAILABLE) {
    throw new Error(`设备当前不可租赁，状态: ${equipment.status}`);
  }
  
  const orderId = generateId('ORD');
  const startTime = new Date(data.startTime || Date.now());
  const rentalDays = data.rentalDays || 1;
  const dueTime = new Date(startTime.getTime() + rentalDays * 24 * 60 * 60 * 1000);
  
  const order = {
    orderId,
    userId: data.userId,
    userName: data.userName,
    equipmentId: data.equipmentId,
    equipmentName: equipment.name,
    equipmentModel: equipment.model,
    
    depositAmount: equipment.depositAmount,
    dailyRentalFee: equipment.dailyRentalFee,
    overdueDailyRate: equipment.overdueDailyRate,
    
    startTime: startTime.toISOString(),
    rentalDays,
    dueTime: dueTime.toISOString(),
    originalDueTime: dueTime.toISOString(),
    renewCount: 0,
    totalRentalDays: rentalDays,
    
    status: ORDER_STATUS.CREATED,
    statusHistory: [],
    
    returnTime: null,
    damageAssessment: null,
    
    createdAt: new Date().toISOString(),
    createdBy: operator,
    lastModifiedAt: new Date().toISOString(),
    lastModifiedBy: operator
  };
  
  storage.rentalOrders[orderId] = order;
  
  await addStatusHistory(orderId, ORDER_STATUS.CREATED, null, operator, '订单创建');
  await auditService.log({
    entityType: 'ORDER',
    entityId: orderId,
    action: 'CREATE',
    before: null,
    after: order,
    operator,
    description: `创建租赁订单: ${order.equipmentName} 租赁 ${rentalDays} 天`
  });
  
  await save();
  return order;
}

async function addStatusHistory(orderId, status, reason = null, operator = 'system', description = '') {
  const order = storage.rentalOrders[orderId];
  if (!order) return;
  
  const history = {
    orderId,
    fromStatus: order.status,
    toStatus: status,
    operator,
    reason,
    description,
    timestamp: new Date().toISOString()
  };
  
  order.statusHistory.push(history);
  order.status = status;
  order.lastModifiedAt = new Date().toISOString();
  order.lastModifiedBy = operator;
}

async function freezeDeposit(orderId, idempotencyKey, operator = 'system') {
  const order = storage.rentalOrders[orderId];
  if (!order) {
    throw new Error(`订单不存在: ${orderId}`);
  }
  
  if (idempotencyKey) {
    const existing = await idempotencyService.checkAndRecord(idempotencyKey, { orderId, action: 'FREEZE_DEPOSIT' });
    if (existing.exists) {
      return existing.result;
    }
  }
  
  if (order.status === ORDER_STATUS.DEPOSIT_FROZEN || order.status === ORDER_STATUS.RENTING) {
    return { success: true, message: '押金已冻结', orderStatus: order.status, isIdempotent: true };
  }
  
  if (order.status !== ORDER_STATUS.CREATED) {
    throw new Error(`当前状态不允许冻结押金: ${order.status}`);
  }
  
  await depositService.addDepositTransaction(orderId, {
    type: TRANSACTION_TYPE.FROZEN,
    amount: order.depositAmount,
    description: `押金冻结: ${order.equipmentName}`,
    operator,
    referenceId: orderId
  });
  
  await addStatusHistory(orderId, ORDER_STATUS.DEPOSIT_FROZEN, null, operator, '押金已冻结');
  await addStatusHistory(orderId, ORDER_STATUS.RENTING, null, operator, '开始租赁');
  
  await equipmentService.updateEquipmentStatus(order.equipmentId, EQUIPMENT_STATUS.RENTED, operator, `订单 ${orderId} 租赁中`);
  
  const result = { success: true, orderStatus: order.status, depositFrozen: order.depositAmount };
  
  if (idempotencyKey) {
    await idempotencyService.recordResult(idempotencyKey, result);
  }
  
  await save();
  return result;
}

async function renewOrder(orderId, data, operator = 'system') {
  const order = storage.rentalOrders[orderId];
  if (!order) {
    throw new Error(`订单不存在: ${orderId}`);
  }
  
  if (data.idempotencyKey) {
    const existing = await idempotencyService.checkAndRecord(data.idempotencyKey, { orderId, action: 'RENEW' });
    if (existing.exists) {
      return existing.result;
    }
  }
  
  const allowedStatuses = [ORDER_STATUS.RENTING, ORDER_STATUS.RENEWED];
  if (!allowedStatuses.includes(order.status)) {
    throw new Error(`当前状态不允许续租: ${order.status}`);
  }
  
  const renewDays = data.renewDays || 1;
  const currentDueTime = new Date(order.dueTime);
  const newDueTime = new Date(currentDueTime.getTime() + renewDays * 24 * 60 * 60 * 1000);
  
  const beforeState = JSON.parse(JSON.stringify(order));
  
  order.renewCount += 1;
  order.totalRentalDays += renewDays;
  order.dueTime = newDueTime.toISOString();
  
  await addStatusHistory(orderId, ORDER_STATUS.RENEWED, {
    renewDays,
    previousDueTime: order.originalDueTime,
    newDueTime: newDueTime.toISOString()
  }, operator, `续租 ${renewDays} 天`);
  
  await auditService.log({
    entityType: 'ORDER',
    entityId: orderId,
    action: 'RENEW',
    before: beforeState,
    after: order,
    operator,
    description: `续租 ${renewDays} 天，到期日从 ${beforeState.dueTime} 延长至 ${newDueTime.toISOString()}`
  });
  
  const result = {
    success: true,
    orderStatus: order.status,
    renewCount: order.renewCount,
    totalRentalDays: order.totalRentalDays,
    previousDueTime: beforeState.dueTime,
    newDueTime: order.dueTime
  };
  
  if (data.idempotencyKey) {
    await idempotencyService.recordResult(data.idempotencyKey, result);
  }
  
  await save();
  return result;
}

async function returnEquipment(orderId, data, operator = 'system') {
  const order = storage.rentalOrders[orderId];
  if (!order) {
    throw new Error(`订单不存在: ${orderId}`);
  }
  
  if (data.idempotencyKey) {
    const existing = await idempotencyService.checkAndRecord(data.idempotencyKey, { orderId, action: 'RETURN' });
    if (existing.exists) {
      return { ...existing.result, isIdempotent: true };
    }
  }
  
  if (order.status === ORDER_STATUS.RETURNED || 
      order.status === ORDER_STATUS.IN_DAMAGE_ASSESSMENT ||
      order.status === ORDER_STATUS.FEES_SETTLED ||
      order.status === ORDER_STATUS.REFUND_SUCCESS) {
    return {
      success: false,
      error: 'DUPLICATE_RETURN',
      message: '设备已归还，重复操作已忽略',
      orderStatus: order.status,
      isIdempotent: true
    };
  }
  
  const allowedStatuses = [ORDER_STATUS.RENTING, ORDER_STATUS.RENEWED];
  if (!allowedStatuses.includes(order.status)) {
    throw new Error(`当前状态不允许归还: ${order.status}`);
  }
  
  const returnTime = new Date(data.returnTime || Date.now());
  order.returnTime = returnTime.toISOString();
  
  const overdueResult = depositService.calculateOverdueFee(order, returnTime.toISOString());
  
  await equipmentService.updateEquipmentStatus(
    order.equipmentId, 
    EQUIPMENT_STATUS.IN_CHECK, 
    operator, 
    `订单 ${orderId} 归还检查中`
  );
  
  const hasOverdue = overdueResult.overdueFee > 0;
  
  if (hasOverdue) {
    await depositService.addFee(orderId, {
      type: FEE_TYPE.OVERDUE,
      amount: overdueResult.overdueFee,
      description: '逾期费用',
      calculation: overdueResult.calculation,
      operator
    });
    
    await addStatusHistory(orderId, ORDER_STATUS.IN_DAMAGE_ASSESSMENT, {
      returnTime: order.returnTime,
      overdueDays: overdueResult.overdueDays,
      overdueFee: overdueResult.overdueFee,
      hasOverdue: true
    }, operator, '设备归还，存在逾期，进入定损阶段');
  } else {
    await addStatusHistory(orderId, ORDER_STATUS.RETURNED, {
      returnTime: order.returnTime,
      overdueDays: 0,
      overdueFee: 0,
      hasOverdue: false
    }, operator, '设备按时归还');
  }
  
  const result = {
    success: true,
    orderStatus: order.status,
    returnTime: order.returnTime,
    hasOverdue,
    overdueResult
  };
  
  if (data.idempotencyKey) {
    await idempotencyService.recordResult(data.idempotencyKey, result);
  }
  
  await save();
  return result;
}

async function assessDamage(orderId, data, operator = 'system') {
  const order = storage.rentalOrders[orderId];
  if (!order) {
    throw new Error(`订单不存在: ${orderId}`);
  }
  
  if (data.idempotencyKey) {
    const existing = await idempotencyService.checkAndRecord(data.idempotencyKey, { orderId, action: 'ASSESS_DAMAGE' });
    if (existing.exists) {
      return existing.result;
    }
  }
  
  const allowedStatuses = [ORDER_STATUS.RETURNED, ORDER_STATUS.IN_DAMAGE_ASSESSMENT];
  if (!allowedStatuses.includes(order.status)) {
    throw new Error(`当前状态不允许定损: ${order.status}`);
  }
  
  const damageItems = data.damageItems || [];
  const totalDamageFee = damageItems.reduce((sum, item) => sum + (item.amount || 0), 0);
  
  order.damageAssessment = {
    assessor: data.assessor || operator,
    assessmentTime: new Date().toISOString(),
    overallStatus: data.overallStatus || (totalDamageFee > 0 ? 'DAMAGED' : 'GOOD'),
    damageItems,
    totalDamageFee,
    notes: data.notes || ''
  };
  
  if (totalDamageFee > 0) {
    await depositService.addFee(orderId, {
      type: FEE_TYPE.DAMAGE,
      amount: totalDamageFee,
      description: `损坏赔偿费用 (${damageItems.length} 项)`,
      calculation: damageItems.map(item => `${item.description}: ${item.amount}元`).join(' + '),
      operator
    });
  }
  
  await addStatusHistory(orderId, ORDER_STATUS.FEES_SETTLED, {
    damageAssessment: order.damageAssessment
  }, operator, `定损完成，损坏费用: ${totalDamageFee} 元`);
  
  const refundCalculation = depositService.calculateRefundAmount(orderId);
  
  const result = {
    success: true,
    orderStatus: order.status,
    damageAssessment: order.damageAssessment,
    refundCalculation
  };
  
  if (data.idempotencyKey) {
    await idempotencyService.recordResult(data.idempotencyKey, result);
  }
  
  await save();
  return result;
}

async function processRefund(orderId, data, operator = 'system') {
  const order = storage.rentalOrders[orderId];
  if (!order) {
    throw new Error(`订单不存在: ${orderId}`);
  }
  
  const refundIdempotencyKey = data.refundId || data.idempotencyKey;
  if (refundIdempotencyKey) {
    const existing = await idempotencyService.checkAndRecord(refundIdempotencyKey, { orderId, action: 'REFUND' });
    if (existing.exists) {
      return { ...existing.result, isIdempotent: true };
    }
  }
  
  if (order.status === ORDER_STATUS.REFUND_SUCCESS) {
    return {
      success: true,
      message: '退款已成功处理',
      orderStatus: order.status,
      isIdempotent: true
    };
  }
  
  if (order.status === ORDER_STATUS.REFUND_PROCESSING) {
    return {
      success: true,
      message: '退款处理中',
      orderStatus: order.status,
      isIdempotent: true
    };
  }
  
  if (order.status !== ORDER_STATUS.FEES_SETTLED) {
    throw new Error(`当前状态不允许退款: ${order.status}`);
  }
  
  const refundCalculation = depositService.calculateRefundAmount(orderId);
  
  await addStatusHistory(orderId, ORDER_STATUS.REFUND_PROCESSING, {
    refundCalculation
  }, operator, '开始处理退款');
  
  const refundResult = await simulateRefund(orderId, refundCalculation.refundAmount);
  
  if (refundResult.success) {
    await depositService.addDepositTransaction(orderId, {
      type: TRANSACTION_TYPE.REFUND,
      amount: refundCalculation.refundAmount,
      description: `押金退还: 退款金额 ${refundCalculation.refundAmount} 元`,
      operator,
      referenceId: refundResult.refundReference
    });
    
    await addStatusHistory(orderId, ORDER_STATUS.REFUND_SUCCESS, {
      refundAmount: refundCalculation.refundAmount,
      refundReference: refundResult.refundReference,
      refundTime: new Date().toISOString()
    }, operator, `退款成功: ${refundCalculation.refundAmount} 元`);
    
    await equipmentService.updateEquipmentStatus(
      order.equipmentId,
      order.damageAssessment?.overallStatus === 'DAMAGED' ? EQUIPMENT_STATUS.DAMAGED : EQUIPMENT_STATUS.AVAILABLE,
      operator,
      `订单 ${orderId} 租赁结束`
    );
  } else {
    await addStatusHistory(orderId, ORDER_STATUS.REFUND_FAILED, {
      failureReason: refundResult.reason
    }, operator, `退款失败: ${refundResult.reason}`);
  }
  
  const result = {
    success: refundResult.success,
    orderStatus: order.status,
    refundCalculation,
    refundReference: refundResult.refundReference,
    failureReason: refundResult.reason
  };
  
  if (refundIdempotencyKey) {
    await idempotencyService.recordResult(refundIdempotencyKey, result);
  }
  
  await save();
  return result;
}

async function simulateRefund(orderId, amount) {
  await new Promise(resolve => setTimeout(resolve, 100));
  return {
    success: true,
    refundReference: `REF_${orderId}_${Date.now()}`,
    processedAt: new Date().toISOString()
  };
}

async function handleRefundCallback(callbackData) {
  const { refundId, orderId, status, reference } = callbackData;
  
  if (storage.refundCallbacks[refundId]) {
    return {
      success: true,
      message: '回调已处理，重复回调已忽略',
      isIdempotent: true
    };
  }
  
  const order = storage.rentalOrders[orderId];
  if (!order) {
    throw new Error(`订单不存在: ${orderId}`);
  }
  
  storage.refundCallbacks[refundId] = {
    callbackId: refundId,
    orderId,
    status,
    reference,
    receivedAt: new Date().toISOString(),
    processed: true
  };
  
  await auditService.log({
    entityType: 'ORDER',
    entityId: orderId,
    action: 'REFUND_CALLBACK',
    before: null,
    after: callbackData,
    operator: 'payment_gateway',
    description: `收到退款回调: ${status}`
  });
  
  await save();
  return { success: true, message: '回调处理成功' };
}

async function manualAdjust(orderId, data, operator) {
  if (!operator) {
    throw new Error('人工调整必须指定操作者');
  }
  
  const order = storage.rentalOrders[orderId];
  if (!order) {
    throw new Error(`订单不存在: ${orderId}`);
  }
  
  const before = JSON.parse(JSON.stringify({
    order,
    ledger: depositService.getLedger(orderId),
    fees: depositService.getFeeDetails(orderId)
  }));
  
  if (data.adjustDeposit) {
    await depositService.addDepositTransaction(orderId, {
      type: TRANSACTION_TYPE.MANUAL_ADJUST,
      amount: data.adjustDeposit,
      description: `人工调整押金: ${data.reason}`,
      operator,
      referenceId: `MANUAL_${Date.now()}`
    });
  }
  
  if (data.adjustFees && data.adjustFees.length > 0) {
    for (const fee of data.adjustFees) {
      await depositService.addFee(orderId, {
        type: fee.type,
        amount: fee.amount,
        description: `人工调整费用: ${fee.description || data.reason}`,
        calculation: `人工调整`,
        operator
      });
    }
  }
  
  if (data.newStatus) {
    await addStatusHistory(orderId, data.newStatus, data.reason, operator, `人工调整状态: ${data.reason}`);
  }
  
  const after = JSON.parse(JSON.stringify({
    order,
    ledger: depositService.getLedger(orderId),
    fees: depositService.getFeeDetails(orderId)
  }));
  
  await auditService.logManualAdjustment({
    entityType: 'ORDER',
    entityId: orderId,
    before,
    after,
    operator,
    reason: data.reason
  });
  
  await save();
  
  return {
    success: true,
    orderStatus: order.status,
    message: '人工调整已完成',
    changes: auditService.calculateDiff(before, after)
  };
}

async function getOrder(orderId) {
  return storage.rentalOrders[orderId] || null;
}

async function listOrders(filters = {}) {
  let list = Object.values(storage.rentalOrders);
  
  if (filters.status) {
    list = list.filter(o => o.status === filters.status);
  }
  if (filters.userId) {
    list = list.filter(o => o.userId === filters.userId);
  }
  if (filters.equipmentId) {
    list = list.filter(o => o.equipmentId === filters.equipmentId);
  }
  
  return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function getOrderDetail(orderId) {
  const order = await getOrder(orderId);
  if (!order) return null;
  
  const equipment = await equipmentService.getEquipment(order.equipmentId);
  const ledger = await depositService.getDepositLedger(orderId);
  const fees = await depositService.getFeeDetailsByOrder(orderId);
  const auditTimeline = await auditService.getEntityTimeline('ORDER', orderId);
  const equipmentStatusHistory = await equipmentService.getEquipmentStatusHistory(order.equipmentId);
  
  return {
    order,
    equipment,
    ledger,
    fees,
    auditTimeline,
    equipmentStatusHistory
  };
}

module.exports = {
  createRentalOrder,
  freezeDeposit,
  renewOrder,
  returnEquipment,
  assessDamage,
  processRefund,
  handleRefundCallback,
  manualAdjust,
  getOrder,
  listOrders,
  getOrderDetail,
  addStatusHistory
};