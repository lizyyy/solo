#!/usr/bin/env python3
import os

code = '''const moment = require("moment");
const { get, all } = require("./database");

function evaluateCondition(condition, context) {
  if (!condition) return true;
  try {
    var fn = new Function("ctx", "with(ctx) { return " + condition + "; }");
    return fn(context) === true;
  } catch (e) {
    return false;
  }
}

function calculateOverdueRent(rentalOrder, rules) {
  var today = moment().format("YYYY-MM-DD");
  var endDate = rentalOrder.rental_end_date;
  if (!endDate || moment(endDate).isAfter(today)) {
    return { hasOverdue: false };
  }
  var overdueDays = moment(today).diff(moment(endDate), "days");
  if (overdueDays <= 0) return { hasOverdue: false };
  var overdueRules = rules.filter(function(r) {
    return r.rule_type === "overdue_rent" && r.is_active === 1;
  });
  var totalDeduction = 0;
  var appliedRules = [];
  var sortedRules = overdueRules.sort(function(a, b) {
    return a.priority - b.priority;
  });
  for (var i = 0; i < sortedRules.length; i++) {
    var rule = sortedRules[i];
    var ctx = {
      overdueDays: overdueDays,
      daily_rent: rentalOrder.daily_rent,
      deposit: rentalOrder.deposit_amount
    };
    if (evaluateCondition(rule.condition_expr, ctx)) {
      var amount = rule.deduction_amount || 0;
      if (rule.deduction_percent > 0) {
        amount = rentalOrder.deposit_amount * (rule.deduction_percent / 100);
      }
      totalDeduction += amount;
      appliedRules.push({
        rule_code: rule.rule_code,
        rule_name: rule.rule_name,
        amount: amount
      });
    }
  }
  return {
    hasOverdue: true,
    overdueDays: overdueDays,
    totalDeduction: totalDeduction,
    appliedRules: appliedRules
  };
}

function evaluateRepairLiability(repairRecord, rules) {
  var liabilityRules = rules.filter(function(r) {
    return r.rule_type === "repair_liability" && r.is_active === 1;
  });
  var shouldDeduct = false;
  var deductionAmount = 0;
  var appliedRule = null;
  var sortedRules = liabilityRules.sort(function(a, b) {
    return a.priority - b.priority;
  });
  for (var i = 0; i < sortedRules.length; i++) {
    var rule = sortedRules[i];
    var ctx = {
      repair_type: repairRecord.repair_type,
      repair_cost: repairRecord.repair_cost,
      liability: repairRecord.liability
    };
    if (evaluateCondition(rule.condition_expr, ctx)) {
      shouldDeduct = true;
      if (rule.deduction_amount > 0) {
        deductionAmount = rule.deduction_amount;
      } else {
        deductionAmount = repairRecord.repair_cost * (rule.deduction_percent / 100);
      }
      appliedRule = rule;
      break;
    }
  }
  return {
    shouldDeduct: shouldDeduct,
    deductionAmount: deductionAmount,
    appliedRule: appliedRule
  };
}

async function checkDuplicateDeduction(rentalOrderNo, repairNo, deviceId) {
  var conditions = [];
  var params = [];
  if (rentalOrderNo) {
    conditions.push("rental_order_no = ?");
    params.push(rentalOrderNo);
  }
  if (repairNo) {
    conditions.push("repair_no = ?");
    params.push(repairNo);
  }
  if (deviceId) {
    conditions.push("device_id = ?");
    params.push(deviceId);
  }
  if (conditions.length === 0) {
    return false;
  }
  params.push("deduction");
  var sql = "SELECT COUNT(*) AS cnt FROM deposit_transactions WHERE (" + conditions.join(" OR ") + ") AND transaction_type = ?";
  var existing = await get(sql, params);
  return existing && existing.cnt > 0;
}

async function getDepositBalance(rentalOrderNo) {
  var order = await get("SELECT deposit_amount FROM rental_orders WHERE order_no = ?", [rentalOrderNo]);
  if (!order) return { totalDeposit: 0, usedAmount: 0, balance: 0 };
  var used = await get("SELECT COALESCE(SUM(CASE WHEN transaction_type = ? THEN amount WHEN transaction_type = ? THEN -amount ELSE 0 END), 0) AS used FROM deposit_transactions WHERE rental_order_no = ? AND status = ?", ["deduction", "refund", rentalOrderNo, "confirmed"]);
  var usedAmount = (used && used.used) || 0;
  return {
    totalDeposit: order.deposit_amount,
    usedAmount: usedAmount,
    balance: order.deposit_amount - usedAmount
  };
}

async function getActiveRules() {
  return await all("SELECT * FROM deposit_rules WHERE is_active = 1 ORDER BY priority ASC");
}

module.exports = {
  evaluateCondition: evaluateCondition,
  calculateOverdueRent: calculateOverdueRent,
  evaluateRepairLiability: evaluateRepairLiability,
  checkDuplicateDeduction: checkDuplicateDeduction,
  getDepositBalance: getDepositBalance,
  getActiveRules: getActiveRules
};
'''

file_path = "/Users/lzy/pro/solo/workspaces/zy70977/src/rulesEngine.js"
with open(file_path, "w") as f:
    f.write(code)

print(f"File written: {file_path}")
