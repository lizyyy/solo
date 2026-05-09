const storage = require('../storage');

function createDeductionRule(params) {
  const rule = {
    name: params.name,
    type: params.type,
    category: params.category || 'general',
    deductionType: params.deductionType,
    amount: params.amount || 0,
    percentage: params.percentage || 0,
    maxAmount: params.maxAmount || null,
    applicableFeeTypes: params.applicableFeeTypes || [],
    priority: params.priority || 50,
    description: params.description || '',
    status: params.status || 'active'
  };
  return storage.insert('deductionRules', rule);
}

function getDeductionRules(studentId, feeType) {
  const rules = storage.findMany('deductionRules', r => r.status === 'active');
  if (feeType) {
    return rules.filter(r => 
      r.applicableFeeTypes.length === 0 || 
      r.applicableFeeTypes.includes(feeType)
    );
  }
  return rules;
}

function calculateDeduction(feeAmount, rule) {
  if (rule.deductionType === 'fixed') {
    return Math.min(rule.amount, feeAmount);
  } else if (rule.deductionType === 'percentage') {
    let deduction = feeAmount * (rule.percentage / 100);
    if (rule.maxAmount) {
      deduction = Math.min(deduction, rule.maxAmount);
    }
    return Math.min(deduction, feeAmount);
  }
  return 0;
}

function applyDeductions(studentId, feeTypeId, originalAmount, deductions) {
  const applied = [];
  let remaining = originalAmount;
  let totalDeduction = 0;
  
  const sortedDeductions = [...deductions].sort((a, b) => {
    const ruleA = storage.findById('deductionRules', a.ruleId);
    const ruleB = storage.findById('deductionRules', b.ruleId);
    return (ruleA?.priority || 50) - (ruleB?.priority || 50);
  });

  for (const item of sortedDeductions) {
    if (remaining <= 0) break;
    
    const rule = storage.findById('deductionRules', item.ruleId);
    if (!rule || rule.status !== 'active') continue;

    const amount = calculateDeduction(remaining, rule);
    if (amount > 0) {
      applied.push({
        ruleId: rule.id,
        ruleName: rule.name,
        amount,
        type: rule.deductionType
      });
      totalDeduction += amount;
      remaining -= amount;
    }
  }

  return {
    originalAmount,
    totalDeduction,
    payableAmount: remaining,
    appliedDeductions: applied
  };
}

function recordStudentDeduction(params) {
  const deduction = {
    studentId: params.studentId,
    ruleId: params.ruleId,
    feeTypeId: params.feeTypeId,
    amount: params.amount,
    source: params.source || 'manual',
    status: params.status || 'pending'
  };
  return storage.insert('studentDeductions', deduction);
}

module.exports = {
  createDeductionRule,
  getDeductionRules,
  calculateDeduction,
  applyDeductions,
  recordStudentDeduction
};
