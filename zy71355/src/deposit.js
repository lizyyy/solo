const inquirer = require('inquirer');
const chalk = require('chalk');

const DEPOSIT_RULES = {
  missing: { rate: 1.0, label: '物品遗失' },
  severe: { rate: 0.8, label: '严重损坏' },
  medium: { rate: 0.4, label: '中度损坏' },
  minor: { rate: 0.1, label: '轻微损坏' }
};

function calculateDeposit(items, damages, depositAmount) {
  const deductions = [];
  let totalDeduction = 0;
  
  items.forEach(item => {
    if (item.status === 'missing') {
      const deduction = depositAmount * DEPOSIT_RULES.missing.rate;
      deductions.push({
        type: 'missing',
        item: item.name,
        serialNumber: item.serialNumber,
        reason: DEPOSIT_RULES.missing.label,
        amount: deduction,
        rate: DEPOSIT_RULES.missing.rate
      });
      totalDeduction += deduction;
    }
  });
  
  damages.forEach(damage => {
    const rule = DEPOSIT_RULES[damage.severity] || DEPOSIT_RULES.minor;
    const deduction = damage.estimatedCost > 0 
      ? damage.estimatedCost 
      : depositAmount * rule.rate;
    deductions.push({
      type: damage.severity,
      item: damage.itemName,
      serialNumber: damage.itemSerialNumber,
      reason: rule.label,
      description: damage.description,
      amount: deduction,
      rate: rule.rate,
      estimatedCost: damage.estimatedCost
    });
    totalDeduction += deduction;
  });
  
  return {
    depositAmount,
    totalDeduction,
    refundAmount: Math.max(0, depositAmount - totalDeduction),
    deductions,
    calculatedAt: new Date().toISOString()
  };
}

async function depositTrial(items, damages) {
  console.log(chalk.blue.bold('\n=== 押金试算 ===\n'));
  
  const { depositAmount } = await inquirer.prompt([{
    type: 'input',
    name: 'depositAmount',
    message: '押金金额 (元):',
    default: '5000',
    validate: v => !isNaN(parseFloat(v))
  }]);
  
  const result = calculateDeposit(items, damages, parseFloat(depositAmount));
  
  console.log(chalk.yellow('\n--- 试算结果 ---'));
  console.log(`押金总额: ${chalk.green(result.depositAmount.toFixed(2))} 元`);
  console.log(`应扣金额: ${chalk.red(result.totalDeduction.toFixed(2))} 元`);
  console.log(`退还金额: ${chalk.cyan(result.refundAmount.toFixed(2))} 元`);
  
  if (result.deductions.length > 0) {
    console.log(chalk.yellow('\n--- 扣款明细 ---'));
    result.deductions.forEach((d, i) => {
      console.log(`${i + 1}. [${d.reason}] ${d.item} (${d.serialNumber}): ${chalk.red(d.amount.toFixed(2))} 元`);
    });
  }
  
  const { confirmed } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirmed',
    message: '确认此押金计算方案？',
    default: false
  }]);
  
  return { ...result, confirmed };
}

async function adjustDeductions(depositResult) {
  console.log(chalk.blue('\n=== 扣款调整 ===\n'));
  
  const adjusted = { ...depositResult };
  const deductions = [...depositResult.deductions];
  
  for (let i = 0; i < deductions.length; i++) {
    const d = deductions[i];
    console.log(`\n${i + 1}. ${d.item} (${d.serialNumber})`);
    console.log(`   当前扣款: ${d.amount.toFixed(2)} 元 (${d.reason})`);
    
    const { adjust, newAmount } = await inquirer.prompt([
      { type: 'confirm', name: 'adjust', message: '   调整此扣款？', default: false },
      {
        type: 'input',
        name: 'newAmount',
        message: '   新金额:',
        when: (ans) => ans.adjust,
        validate: v => !isNaN(parseFloat(v))
      }
    ]);
    
    if (adjust) {
      deductions[i] = { ...d, amount: parseFloat(newAmount), adjusted: true };
    }
  }
  
  const totalDeduction = deductions.reduce((sum, d) => sum + d.amount, 0);
  
  return {
    ...adjusted,
    deductions,
    totalDeduction,
    refundAmount: Math.max(0, adjusted.depositAmount - totalDeduction),
    adjustedAt: new Date().toISOString()
  };
}

module.exports = {
  calculateDeposit,
  depositTrial,
  adjustDeductions,
  DEPOSIT_RULES
};
