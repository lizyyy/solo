const getDB = require('../config/database');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');

const RISK_THRESHOLD_HIGH = 0.9;
const RISK_THRESHOLD_MEDIUM = 0.7;

function calculateRiskLevel(usedCredit, totalLimit) {
  if (totalLimit <= 0) return 'high';
  const ratio = usedCredit / totalLimit;
  if (ratio >= RISK_THRESHOLD_HIGH) return 'high';
  if (ratio >= RISK_THRESHOLD_MEDIUM) return 'medium';
  return 'low';
}

async function createRiskAlert(customerId, customerName, alertType, alertLevel, alertMessage) {
  const db = getDB();
  const alert = {
    id: uuidv4(),
    customer_id: customerId,
    customer_name: customerName,
    alert_type: alertType,
    alert_level: alertLevel,
    alert_message: alertMessage,
    is_read: 0,
    created_at: moment().format('YYYY-MM-DD HH:mm:ss')
  };
  
  const insertAlert = db.prepare(`
    INSERT INTO risk_alerts (id, customer_id, customer_name, alert_type, alert_level, alert_message, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  await insertAlert.run(
    alert.id, alert.customer_id, alert.customer_name, alert.alert_type,
    alert.alert_level, alert.alert_message, alert.is_read, alert.created_at
  );
  return alert;
}

async function recordCreditHistory(customerId, customerName, transactionType, transactionId, transactionNo, changeAmount, beforeAvailable, afterAvailable, beforeUsed, afterUsed, operator, remark) {
  const db = getDB();
  const history = {
    id: uuidv4(),
    customer_id: customerId,
    customer_name: customerName,
    transaction_type: transactionType,
    transaction_id: transactionId,
    transaction_no: transactionNo,
    change_amount: changeAmount,
    before_available: beforeAvailable,
    after_available: afterAvailable,
    before_used: beforeUsed,
    after_used: afterUsed,
    operator: operator,
    remark: remark,
    created_at: moment().format('YYYY-MM-DD HH:mm:ss')
  };
  
  const insertHistory = db.prepare(`
    INSERT INTO credit_history (id, customer_id, customer_name, transaction_type, transaction_id, transaction_no, change_amount, before_available, after_available, before_used, after_used, operator, remark, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  await insertHistory.run(
    history.id, history.customer_id, history.customer_name, history.transaction_type,
    history.transaction_id, history.transaction_no, history.change_amount,
    history.before_available, history.after_available, history.before_used,
    history.after_used, history.operator, history.remark, history.created_at
  );
  return history;
}

async function createOrder(customerId, orderNo, amount, remark = '', operator = 'system') {
  const db = getDB();
  const customer = await db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
  if (!customer) {
    return { success: false, message: '客户不存在' };
  }

  if (customer.available_credit < amount) {
    await createRiskAlert(
      customerId,
      customer.name,
      'credit_exceed',
      'high',
      `订单 ${orderNo} 金额 ${amount} 超出可用额度 ${customer.available_credit.toFixed(2)}`
    );
    return { success: false, message: `可用额度不足。当前可用: ${customer.available_credit.toFixed(2)}, 订单金额: ${amount}` };
  }

  try {
    const beforeAvailable = customer.available_credit;
    const beforeUsed = customer.used_credit;
    const afterAvailable = beforeAvailable - amount;
    const afterUsed = beforeUsed + amount;

    const order = {
      id: uuidv4(),
      order_no: orderNo,
      customer_id: customerId,
      customer_name: customer.name,
      amount: amount,
      credit_used: amount,
      order_status: 'completed',
      remark: remark,
      created_at: moment().format('YYYY-MM-DD HH:mm:ss')
    };

    const insertOrder = db.prepare(`
      INSERT INTO orders (id, order_no, customer_id, customer_name, amount, credit_used, order_status, remark, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    await insertOrder.run(
      order.id, order.order_no, order.customer_id, order.customer_name,
      order.amount, order.credit_used, order.order_status, order.remark, order.created_at
    );

    const riskLevel = calculateRiskLevel(afterUsed, customer.total_credit_limit);
    const creditStatus = afterAvailable < 0 ? 'overdrawn' : 'normal';

    const updateCustomer = db.prepare(`
      UPDATE customers 
      SET available_credit = ?, used_credit = ?, risk_level = ?, credit_status = ?, updated_at = ?
      WHERE id = ?
    `);
    await updateCustomer.run(
      afterAvailable,
      afterUsed,
      riskLevel,
      creditStatus,
      moment().format('YYYY-MM-DD HH:mm:ss'),
      customerId
    );

    await recordCreditHistory(
      customerId,
      customer.name,
      'order_occupy',
      order.id,
      orderNo,
      -amount,
      beforeAvailable,
      afterAvailable,
      beforeUsed,
      afterUsed,
      operator,
      `订单占用额度，订单号: ${orderNo}`
    );

    if (riskLevel === 'high') {
      await createRiskAlert(
        customerId,
        customer.name,
        'high_risk',
        'high',
        `客户额度使用率已达 ${((afterUsed / customer.total_credit_limit) * 100).toFixed(1)}%，请关注`
      );
    } else if (riskLevel === 'medium') {
      await createRiskAlert(
        customerId,
        customer.name,
        'medium_risk',
        'medium',
        `客户额度使用率已达 ${((afterUsed / customer.total_credit_limit) * 100).toFixed(1)}%，请注意`
      );
    }

    return {
      success: true,
      message: '订单创建成功，额度已占用',
      order: order,
      customer: {
        ...customer,
        available_credit: afterAvailable,
        used_credit: afterUsed,
        risk_level: riskLevel,
        credit_status: creditStatus
      }
    };
  } catch (error) {
    return { success: false, message: '创建订单失败: ' + error.message };
  }
}

async function processReturn(orderId, returnAmount, remark = '', operator = 'system') {
  const db = getDB();
  const order = await db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) {
    return { success: false, message: '订单不存在' };
  }

  const customer = await db.prepare('SELECT * FROM customers WHERE id = ?').get(order.customer_id);
  if (!customer) {
    return { success: false, message: '客户不存在' };
  }

  const existingReturns = await db.prepare('SELECT COALESCE(SUM(credit_released), 0) as total FROM returns WHERE order_id = ? AND return_status = "completed"').get(orderId);
  const alreadyReturned = existingReturns.total || 0;
  const maxReturnable = order.amount - alreadyReturned;

  if (returnAmount > maxReturnable) {
    return { success: false, message: `退货金额超出可退金额。可退金额: ${maxReturnable.toFixed(2)}, 申请退货: ${returnAmount}` };
  }

  try {
    const beforeAvailable = customer.available_credit;
    const beforeUsed = customer.used_credit;
    const afterAvailable = beforeAvailable + returnAmount;
    const afterUsed = beforeUsed - returnAmount;

    const returnNo = 'RT' + moment().format('YYYYMMDDHHmmss');
    const returnRecord = {
      id: uuidv4(),
      return_no: returnNo,
      order_id: orderId,
      order_no: order.order_no,
      customer_id: order.customer_id,
      customer_name: order.customer_name,
      return_amount: returnAmount,
      credit_released: returnAmount,
      return_status: 'completed',
      remark: remark,
      created_at: moment().format('YYYY-MM-DD HH:mm:ss')
    };

    const insertReturn = db.prepare(`
      INSERT INTO returns (id, return_no, order_id, order_no, customer_id, customer_name, return_amount, credit_released, return_status, remark, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    await insertReturn.run(
      returnRecord.id, returnRecord.return_no, returnRecord.order_id, returnRecord.order_no,
      returnRecord.customer_id, returnRecord.customer_name, returnRecord.return_amount,
      returnRecord.credit_released, returnRecord.return_status, returnRecord.remark, returnRecord.created_at
    );

    const riskLevel = calculateRiskLevel(afterUsed, customer.total_credit_limit);
    const creditStatus = afterAvailable < 0 ? 'overdrawn' : 'normal';

    const updateCustomer = db.prepare(`
      UPDATE customers 
      SET available_credit = ?, used_credit = ?, risk_level = ?, credit_status = ?, updated_at = ?
      WHERE id = ?
    `);
    await updateCustomer.run(
      afterAvailable,
      afterUsed,
      riskLevel,
      creditStatus,
      moment().format('YYYY-MM-DD HH:mm:ss'),
      customer.id
    );

    await recordCreditHistory(
      order.customer_id,
      order.customer_name,
      'return_release',
      returnRecord.id,
      returnNo,
      returnAmount,
      beforeAvailable,
      afterAvailable,
      beforeUsed,
      afterUsed,
      operator,
      `退货释放额度，退货单号: ${returnNo}，原订单号: ${order.order_no}`
    );

    await createRiskAlert(
      order.customer_id,
      order.customer_name,
      'return_release',
      'info',
      `订单 ${order.order_no} 退货 ${returnAmount.toFixed(2)}，额度已释放`
    );

    return {
      success: true,
      message: '退货处理成功，额度已释放',
      return: returnRecord,
      customer: {
        ...customer,
        available_credit: afterAvailable,
        used_credit: afterUsed,
        risk_level: riskLevel,
        credit_status: creditStatus
      }
    };
  } catch (error) {
    return { success: false, message: '处理退货失败: ' + error.message };
  }
}

async function submitCreditAdjustment(customerId, adjustmentType, amount, reason, requester) {
  const db = getDB();
  const customer = await db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
  if (!customer) {
    return { success: false, message: '客户不存在' };
  }

  const adjustmentNo = 'CA' + moment().format('YYYYMMDDHHmmss');
  const adjustment = {
    id: uuidv4(),
    adjustment_no: adjustmentNo,
    customer_id: customerId,
    customer_name: customer.name,
    adjustment_type: adjustmentType,
    amount: amount,
    reason: reason,
    approval_status: 'pending',
    requester: requester,
    approver: null,
    approval_time: null,
    approval_remark: null,
    created_at: moment().format('YYYY-MM-DD HH:mm:ss')
  };

  const insertAdjustment = db.prepare(`
    INSERT INTO credit_adjustments (id, adjustment_no, customer_id, customer_name, adjustment_type, amount, reason, approval_status, requester, approver, approval_time, approval_remark, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  await insertAdjustment.run(
    adjustment.id, adjustment.adjustment_no, adjustment.customer_id, adjustment.customer_name,
    adjustment.adjustment_type, adjustment.amount, adjustment.reason,
    adjustment.approval_status, adjustment.requester, adjustment.approver,
    adjustment.approval_time, adjustment.approval_remark, adjustment.created_at
  );

  await createRiskAlert(
    customerId,
    customer.name,
    'adjustment_pending',
    'info',
    `额度调额申请已提交，调额类型: ${adjustmentType === 'increase' ? '调增' : '调减'}，金额: ${amount}`
  );

  return {
    success: true,
    message: '调额申请已提交，等待审批',
    adjustment: adjustment
  };
}

async function approveCreditAdjustment(adjustmentId, approver, approvalRemark, approve = true) {
  const db = getDB();
  const adjustment = await db.prepare('SELECT * FROM credit_adjustments WHERE id = ?').get(adjustmentId);
  if (!adjustment) {
    return { success: false, message: '调额申请不存在' };
  }

  if (adjustment.approval_status !== 'pending') {
    return { success: false, message: '调额申请已处理，不能重复审批' };
  }

  const customer = await db.prepare('SELECT * FROM customers WHERE id = ?').get(adjustment.customer_id);
  if (!customer) {
    return { success: false, message: '客户不存在' };
  }

  if (!approve) {
    const updateAdjustment = db.prepare(`
      UPDATE credit_adjustments 
      SET approval_status = 'rejected', approver = ?, approval_time = ?, approval_remark = ?
      WHERE id = ?
    `);
    await updateAdjustment.run(
      approver,
      moment().format('YYYY-MM-DD HH:mm:ss'),
      approvalRemark,
      adjustmentId
    );

    await createRiskAlert(
      customer.id,
      customer.name,
      'adjustment_rejected',
      'warning',
      `额度调额申请被驳回，原因: ${approvalRemark || '未提供'}`
    );

    return {
      success: true,
      message: '调额申请已驳回',
      adjustment: { ...adjustment, approval_status: 'rejected' }
    };
  }

  try {
    const beforeAvailable = customer.available_credit;
    const beforeUsed = customer.used_credit;
    const changeAmount = adjustment.adjustment_type === 'increase' ? adjustment.amount : -adjustment.amount;
    const newTotalLimit = customer.total_credit_limit + changeAmount;
    const afterAvailable = beforeAvailable + changeAmount;

    if (newTotalLimit < customer.used_credit) {
      throw new Error('调减后总额度不能小于已用额度');
    }

    const updateAdjustment = db.prepare(`
      UPDATE credit_adjustments 
      SET approval_status = 'approved', approver = ?, approval_time = ?, approval_remark = ?
      WHERE id = ?
    `);
    await updateAdjustment.run(
      approver,
      moment().format('YYYY-MM-DD HH:mm:ss'),
      approvalRemark,
      adjustmentId
    );

    const riskLevel = calculateRiskLevel(customer.used_credit, newTotalLimit);
    const creditStatus = afterAvailable < 0 ? 'overdrawn' : 'normal';

    const updateCustomer = db.prepare(`
      UPDATE customers 
      SET total_credit_limit = ?, available_credit = ?, risk_level = ?, credit_status = ?, updated_at = ?
      WHERE id = ?
    `);
    await updateCustomer.run(
      newTotalLimit,
      afterAvailable,
      riskLevel,
      creditStatus,
      moment().format('YYYY-MM-DD HH:mm:ss'),
      customer.id
    );

    await recordCreditHistory(
      customer.id,
      customer.name,
      'credit_adjustment',
      adjustmentId,
      adjustment.adjustment_no,
      changeAmount,
      beforeAvailable,
      afterAvailable,
      beforeUsed,
      customer.used_credit,
      approver,
      `额度${adjustment.adjustment_type === 'increase' ? '调增' : '调减'}，金额: ${adjustment.amount}`
    );

    await createRiskAlert(
      customer.id,
      customer.name,
      'adjustment_approved',
      'info',
      `额度调额申请已通过，${adjustment.adjustment_type === 'increase' ? '调增' : '调减'} ${adjustment.amount}`
    );

    return {
      success: true,
      message: '调额申请已批准，客户额度已更新',
      adjustment: { ...adjustment, approval_status: 'approved' },
      customer: {
        ...customer,
        total_credit_limit: newTotalLimit,
        available_credit: afterAvailable,
        risk_level: riskLevel,
        credit_status: creditStatus
      }
    };
  } catch (error) {
    return { success: false, message: '审批失败: ' + error.message };
  }
}

async function getCustomerCreditInfo(customerId) {
  const db = getDB();
  const customer = await db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
  if (!customer) {
    return { success: false, message: '客户不存在' };
  }

  const usageRatio = customer.total_credit_limit > 0 ? (customer.used_credit / customer.total_credit_limit) * 100 : 0;

  return {
    success: true,
    data: {
      ...customer,
      usage_ratio: usageRatio
    }
  };
}

async function getCreditHistory(customerId, limit = 100) {
  const db = getDB();
  let query = 'SELECT * FROM credit_history';
  const params = [];
  
  if (customerId) {
    query += ' WHERE customer_id = ?';
    params.push(customerId);
  }
  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const history = await db.prepare(query).all(...params);
  return {
    success: true,
    data: history
  };
}

async function getRiskAlerts(limit = 50, unreadOnly = false) {
  const db = getDB();
  let query = 'SELECT * FROM risk_alerts';
  const params = [];
  
  if (unreadOnly) {
    query += ' WHERE is_read = 0';
  }
  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const alerts = await db.prepare(query).all(...params);
  return {
    success: true,
    data: alerts
  };
}

async function markAlertAsRead(alertId) {
  const db = getDB();
  const result = await db.prepare('UPDATE risk_alerts SET is_read = 1 WHERE id = ?').run(alertId);
  return {
    success: result.changes > 0,
    message: result.changes > 0 ? '已标记为已读' : '告警不存在'
  };
}

module.exports = {
  createOrder,
  processReturn,
  submitCreditAdjustment,
  approveCreditAdjustment,
  getCustomerCreditInfo,
  getCreditHistory,
  getRiskAlerts,
  markAlertAsRead,
  calculateRiskLevel
};
