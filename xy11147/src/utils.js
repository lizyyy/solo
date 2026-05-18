const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

function ensureOutputDir(outputDir) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
}

function printSummary(result) {
  const { stats, categories } = result;

  console.log(chalk.cyan('┌─────────────────────────────────────────────────────┐'));
  console.log(chalk.cyan('│                  处理结果统计汇总                   │'));
  console.log(chalk.cyan('├─────────────────────────────────────────────────────┤'));
  console.log(chalk.cyan(`│ 总记录数: ${String(stats.total).padEnd(41)}│`));
  console.log(chalk.cyan(`│ 正常记录: ${chalk.green(String(stats.normal).padEnd(39))}│`));
  console.log(chalk.cyan(`│ 异常记录: ${chalk.red(String(stats.abnormal).padEnd(39))}│`));
  console.log(chalk.cyan('├─────────────────────────────────────────────────────┤'));
  console.log(chalk.yellow('│              异常类型细分统计                        │'));
  console.log(chalk.cyan('├─────────────────────────────────────────────────────┤'));
  console.log(chalk.cyan(`│ 换表记录: ${chalk.magenta(String(categories.meterChange).padEnd(39))}│`));
  console.log(chalk.cyan(`│ 续住记录: ${chalk.blue(String(categories.extendStay).padEnd(39))}│`));
  console.log(chalk.cyan(`│ 读数倒挂: ${chalk.red(String(categories.readingInversion).padEnd(39))}│`));
  console.log(chalk.cyan(`│ 可复跑记录: ${chalk.yellow(String(categories.rerunnable).padEnd(38))}│`));
  console.log(chalk.cyan(`│ 格式错误: ${chalk.gray(String(categories.formatError).padEnd(39))}│`));
  console.log(chalk.cyan('└─────────────────────────────────────────────────────┘'));
}

function validateRow(row, rowNum) {
  const errors = [];
  const requiredFields = [
    '公寓编号', '房间号', '租客姓名', '入住日期', '退房日期',
    '水表起数', '水表止数', '电表起数', '电表止数'
  ];

  for (const field of requiredFields) {
    if (!row[field] || String(row[field]).trim() === '') {
      errors.push(`缺少必填字段: ${field}`);
    }
  }

  const dateFields = ['入住日期', '退房日期'];
  for (const field of dateFields) {
    if (row[field]) {
      const date = new Date(row[field]);
      if (isNaN(date.getTime())) {
        errors.push(`${field} 日期格式不正确: ${row[field]}`);
      }
    }
  }

  const numberFields = ['水表起数', '水表止数', '电表起数', '电表止数'];
  for (const field of numberFields) {
    if (row[field] && isNaN(parseFloat(row[field]))) {
      errors.push(`${field} 数值格式不正确: ${row[field]}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    rowNum
  };
}

function detectSpecialCases(row) {
  const cases = [];
  
  const waterStart = parseFloat(row['水表起数']);
  const waterEnd = parseFloat(row['水表止数']);
  const electricStart = parseFloat(row['电表起数']);
  const electricEnd = parseFloat(row['电表止数']);

  if (waterEnd < waterStart || electricEnd < electricStart) {
    cases.push('读数倒挂');
  }

  if (row['备注'] && row['备注'].includes('换表')) {
    cases.push('换表');
  }

  if (row['备注'] && row['备注'].includes('续住')) {
    cases.push('续住');
  }

  if (row['是否可复跑'] === '是' || (row['备注'] && row['备注'].includes('可复跑'))) {
    cases.push('可复跑');
  }

  return cases;
}

function calculateUsage(row) {
  const waterStart = parseFloat(row['水表起数']) || 0;
  const waterEnd = parseFloat(row['水表止数']) || 0;
  const electricStart = parseFloat(row['电表起数']) || 0;
  const electricEnd = parseFloat(row['电表止数']) || 0;

  return {
    水用量: Math.max(0, waterEnd - waterStart),
    电用量: Math.max(0, electricEnd - electricStart),
    水费: Math.max(0, waterEnd - waterStart) * 5.5,
    电费: Math.max(0, electricEnd - electricStart) * 1.2
  };
}

module.exports = {
  ensureOutputDir,
  printSummary,
  validateRow,
  detectSpecialCases,
  calculateUsage
};
