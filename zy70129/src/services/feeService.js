const { getDatabase } = require('../database/init');
const { generateId } = require('../utils/idGenerator');
const { ORDER_STATUS, MODULES, ADJUSTMENT_TYPE } = require('../utils/constants');
const { logAudit } = require('../utils/auditLogger');
const { getOrderById, updateOrderStatus } = require('./orderService');
const { getDamageTotal } = require('./damageService');
const { getUtilityTotal } = require('./utilityService');

function validateFeeCalculation(data) {
  const errors = [];
  if (!data.order_id) errors.push('order_id不能为空');
  return errors;
}

function calculateFeeSummary(orderId, operator, otherDeductions = 0) {
  const db = getDatabase();
  const order = getOrderById(orderId);

  if (!order) {
    throw new Error('订单不存在');
  }

  if (![ORDER_STATUS.CHECKING, ORDER_STATUS.FEE_CALCULATED].includes(order.status)) {
    throw new Error('只有验收中或费用已计算状态的订单才能计算费用');
  }

  const depositAmount = order.deposit_amount;
  const damageTotal = getDamageTotal(orderId);
  const utilityTotal = getUtilityTotal(orderId);
  const totalDeductions = parseFloat((damageTotal + utilityTotal + otherDeductions).toFixed(2));
  const refundAmount = parseFloat(Math.max(0, depositAmount - totalDeductions).toFixed(2));

  const summary = {
    order_id: orderId,
    deposit_amount: depositAmount,
    damage_total: damageTotal,
    utility_total: utilityTotal,
    other_deductions: otherDeductions,
    total_deductions: totalDeductions,
    refund_amount: refundAmount,
    calculated_by: operator,
    calculated_at: new Date().toISOString()
  };

  const existingSummary = db.prepare(`
    SELECT * FROM order_fee_summaries WHERE order_id = ?
  `).get(orderId);

  const now = new Date().toISOString();

  if (existingSummary) {
    db.prepare(`
      UPDATE order_fee_summaries 
      SET deposit_amount = ?, damage_total = ?, utility_total = ?,
          other_deductions = ?, total_deductions = ?, refund_amount = ?,
          calculated_by = ?, calculated_at = ?, updated_at = ?,
          is_manually_adjusted = 0, adjustment_reason = NULL
      WHERE order_id = ?
    `).run(
      summary.deposit_amount,
      summary.damage_total,
      summary.utility_total,
      summary.other_deductions,
      summary.total_deductions,
      summary.refund_amount,
      summary.calculated_by,
      summary.calculated_at,
      now,
      orderId
    );
  } else {
    db.prepare(`
      INSERT INTO order_fee_summaries (
        id, order_id, deposit_amount, damage_total, utility_total,
        other_deductions, total_deductions, refund_amount,
        calculated_by, calculated_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      generateId(),
      summary.order_id,
      summary.deposit_amount,
      summary.damage_total,
      summary.utility_total,
      summary.other_deductions,
      summary.total_deductions,
      summary.refund_amount,
      summary.calculated_by,
      summary.calculated_at,
      now,
      now
    );
  }

  logAudit('CALCULATE', MODULES.FEE, operator, {
    targetId: orderId,
    targetType: 'fee_summary',
    newValues: summary
  });

  if (order.status === ORDER_STATUS.CHECKING) {
    updateOrderStatus(orderId, ORDER_STATUS.FEE_CALCULATED, operator, '费用计算完成');
  }

  return getFeeSummaryByOrderId(orderId);
}

function getFeeSummaryByOrderId(orderId) {
  const db = getDatabase();
  const summary = db.prepare(`
    SELECT * FROM order_fee_summaries WHERE order_id = ?
  `).get(orderId);

  if (!summary) return null;

  const breakdown = getFeeBreakdown(orderId);
  return {
    ...summary,
    breakdown
  };
}

function getFeeBreakdown(orderId) {
  const db = getDatabase();

  const damageCharges = db.prepare(`
    SELECT id, item_name, damage_degree, charge_amount, charge_reason, created_at, is_manual_adjustment
    FROM damage_charges 
    WHERE order_id = ?
    ORDER BY created_at ASC
  `).all(orderId);

  const utilityRecords = db.prepare(`
    SELECT 
      ur.id, ur.utility_type, ur.initial_reading, ur.final_reading,
      ur.usage_amount, ur.unit_price, ur.calculated_amount, ur.record_at
    FROM utility_records ur
    WHERE ur.order_id = ? AND ur.calculated_amount IS NOT NULL
    ORDER BY ur.created_at ASC
  `).all(orderId);

  const utilityAllocations = db.prepare(`
    SELECT 
      ua.id, ua.utility_record_id, ua.allocation_ratio,
      ua.allocated_amount, ua.allocation_rule, ua.created_at,
      ur.utility_type
    FROM utility_allocations ua
    JOIN utility_records ur ON ua.utility_record_id = ur.id
    WHERE ua.order_id = ?
    ORDER BY ua.created_at ASC
  `).all(orderId);

  const manualAdjustments = db.prepare(`
    SELECT id, adjustment_type, old_value, new_value, adjustment_amount, reason, adjusted_by, adjusted_at
    FROM manual_adjustments 
    WHERE order_id = ?
    ORDER BY adjusted_at ASC
  `).all(orderId);

  return {
    damageCharges,
    utilityRecords,
    utilityAllocations,
    manualAdjustments
  };
}

function manuallyAdjustRefund(orderId, newRefundAmount, reason, operator) {
  if (!reason) {
    throw new Error('人工调整必须提供原因');
  }

  const db = getDatabase();
  const summary = getFeeSummaryByOrderId(orderId);

  if (!summary) {
    throw new Error('费用汇总不存在，请先计算费用');
  }

  const order = getOrderById(orderId);
  if (order && order.status === ORDER_STATUS.COMPLETED) {
    throw new Error('订单已完成，不允许调整退款金额');
  }

  const oldRefundAmount = summary.refund_amount;
  const adjustmentAmount = newRefundAmount - oldRefundAmount;
  const newTotalDeductions = parseFloat((summary.deposit_amount - newRefundAmount).toFixed(2));
  const newOtherDeductions = parseFloat((
    newTotalDeductions - summary.damage_total - summary.utility_total
  ).toFixed(2));

  const transaction = db.transaction(() => {
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE order_fee_summaries 
      SET other_deductions = ?, total_deductions = ?, refund_amount = ?,
          is_manually_adjusted = 1, adjustment_reason = ?, updated_at = ?
      WHERE order_id = ?
    `).run(
      newOtherDeductions,
      newTotalDeductions,
      newRefundAmount,
      reason,
      now,
      orderId
    );

    const adjustmentId = generateId();
    db.prepare(`
      INSERT INTO manual_adjustments (
        id, order_id, adjustment_type, old_value, new_value,
        adjustment_amount, reason, adjusted_by, adjusted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      adjustmentId,
      orderId,
      ADJUSTMENT_TYPE.REFUND,
      oldRefundAmount,
      newRefundAmount,
      adjustmentAmount,
      reason,
      operator,
      now
    );
  });

  transaction();

  logAudit('MANUAL_ADJUST', MODULES.FEE, operator, {
    targetId: orderId,
    targetType: 'fee_summary',
    oldValues: { refund_amount: oldRefundAmount },
    newValues: { refund_amount: newRefundAmount },
    remark: reason
  });

  return getFeeSummaryByOrderId(orderId);
}

function addOtherDeduction(orderId, amount, reason, operator) {
  if (!reason) {
    throw new Error('其他扣款必须提供原因');
  }
  if (amount <= 0) {
    throw new Error('扣款金额必须大于0');
  }

  const summary = getFeeSummaryByOrderId(orderId);
  if (!summary) {
    throw new Error('费用汇总不存在，请先计算费用');
  }

  const newOtherDeductions = parseFloat((summary.other_deductions + amount).toFixed(2));
  
  return calculateFeeSummary(orderId, operator, newOtherDeductions);
}

module.exports = {
  validateFeeCalculation,
  calculateFeeSummary,
  getFeeSummaryByOrderId,
  getFeeBreakdown,
  manuallyAdjustRefund,
  addOtherDeduction
};
