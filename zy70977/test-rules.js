const rules = require("./test-data/deposit_rules.json");
const { calculateOverdueRent, evaluateRepairLiability } = require("./src/rulesEngine");

console.log("=== 测试 5 天逾期测试（OVERDUE_001）：");
const order = {
  rental_end_date: "2026-05-22",
  daily_rent: 100,
  deposit_amount: 2000
};
const result = calculateOverdueRent(order, rules);
console.log("逾期天数:", result.overdueDays);
console.log("扣减金额:", result.totalDeduction);
console.log("应用规则:", result.appliedRules);

console.log("\n=== 公司责任维修测试（REPAIR_002）：");
const repair1 = {
  repair_type: "正常保养",
  repair_cost: 100,
  liability: "company"
};
const result1 = evaluateRepairLiability(repair1, rules);
console.log("shouldDeduct:", result1.shouldDeduct);
console.log("deductionAmount:", result1.deductionAmount);
console.log("应用规则:", result1.appliedRule?.rule_code);

console.log("\n=== 客户责任维修测试（REPAIR_001）：");
const repair2 = {
  repair_type: "屏幕损坏",
  repair_cost: 500,
  liability: "customer"
};
const result2 = evaluateRepairLiability(repair2, rules);
console.log("shouldDeduct:", result2.shouldDeduct);
console.log("deductionAmount:", result2.deductionAmount);
console.log("应用规则:", result2.appliedRule?.rule_code);
