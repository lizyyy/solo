const moment = require('moment');
const { db } = require('./database');

function evaluateCondition(condition, context) {
  if (!condition) return true;
  try {
    const fn = new Function('ctx', `with(ctx) { return ${condition}; }`);
    return fn(context) === true;
  } catch (e) {
    return false;
  }
}

function calculateOverdueRent(rentalOrder, rules) {
  const today = moment().format('YYYY-MM-DD');
  const endDate = rentalOrder.rental_end_date;
  if (!endDate || moment(endDate).isAfter(today)) {
    return { hasOverdue: false };
  }
  const overdueDays = moment(today).diff(moment(endDate), 'days');
  if (overdueDays <= 0) return { hasOverdue: false };

  const overdueRules = rules.filter(r => r.rule_type === 'overdue_rent' && r.is_active === 1);
  let totalDeduction = 0;
  let appliedRules = [];

  for (const rule of overdueRules.sort((a, b) => a.priority - b.priority)) {
    const ctx = { overdueDays, daily_rent: rentalOrder.daily_rent, deposit: rentalOrder.deposit_amount };
    if (evaluateCondition(rule.condition_expr, ctx)) {
      let amount = rule.deduction_amount || 0;
      if (rule.deduction_percent > 0) {
        amount = rentalOrder.deposit_amount * (rule.deduction_percent / 100);
      }
      totalDeduction += amount;
      appliedRules.push({
        rule_code: rule.rule_code,
        rule_name: rule.rule_name,
        amount
      });
    }
  }

  return {
    hasOverdue: true,
    overdueDays,
    totalDeduction,
    appliedRules
  };
}

function evaluateRepairLiability(repairRecord, rules) {
  const liabilityRules = rules.filter(r => r.rule_type === 'repair_liability' && r.is_active === 1);
  let shouldDeduct = false;
  let deductionAmount = 0;
  let appliedRule = null;

  for (const rule of liabilityRules.sort((a, b) => a.priority - b.priority)) {
    const ctx = {
      repair_type: repairRecord.repair_type,
      repair_cost: repairRecord.repair_cost,
      liability: repairRecord.liability
    };
    if (evaluateCondition(rule.condition_expr, ctx)) {
      shouldDeduct = true;
      deductionAmount = rule.deduction_amount || (repairRecord.repair_cost * (rule.deduction_percent / 100));
      appliedRule = rule;
      break;
    }
  }

  return { shouldDeduct, deductionAmount, appliedRule };
}

function checkDuplicateDeduction(rentalOrderNo, repairNo, deviceId) {
  const existing = db.prepare(`
    SELECT COUNT(*) as count FROM deposit_transactions
    WHERE (rental_order_no = ? OR repair_no = ? OR device_id = ?)
    AND transaction_type = 'deduction'
  `).get(rentalOrderNo || '', repairNo || '', deviceId || '');

  return existing.count > 0;
}

function getDepositBalance(rentalOrderNo) {
  const order = db.prepare('SELECT deposit_amount FROM rental_orders WHERE order_no = ?').get(rentalOrderNo);
  if (!order) return { totalDeposit: 0, usedAmount: 0, balance: 0 };

  const used = db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN transaction_type = 'deduction' THEN amount
                                    WHEN transaction_type = 'refund' THEN -amount
                                    ELSE 0 END) as used
    FROM deposit_transactions
    WHERE rental_order_no = ? AND status = 'confirmed'
  `).get(rentalOrderNo);

  const usedAmount = used?.used || 0;
  return {
    totalDeposit: order.deposit_amount,
    usedAmount,
    balance: order.deposit_amount - usedAmount
  };
}

function getActiveRules() {
  return db.prepare('SELECT * FROM deposit_rules WHERE is_active = 1 ORDER BY priority ASC').all();
}

module.exports = {
  evaluateCondition,
  calculateOverdueRent,
  evaluateRepairLiability,
  checkDuplicateDeduction,
  getDepositBalance,
  getActiveRules
};
