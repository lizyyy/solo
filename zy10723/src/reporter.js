import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

export function generateConsoleReport(summary, parseResult, validationResult) {
  console.log('\n');
  console.log(chalk.bgMagenta.white.bold('════════════════════════════════════════════════════════════'));
  console.log(chalk.bgMagenta.white.bold('               退款风控记录异常退款复核报告                    '));
  console.log(chalk.bgMagenta.white.bold('════════════════════════════════════════════════════════════'));
  console.log('\n');

  console.log(chalk.bold.blue('【文件信息】'));
  console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(`  文件名: ${chalk.cyan(summary.fileInfo.fileName)}`);
  console.log(`  处理时间: ${chalk.cyan(formatDateTime(summary.fileInfo.processTime))}`);
  console.log(`  总行数: ${chalk.white(summary.fileInfo.totalRows)}`);
  console.log(`  有效行数: ${chalk.green(summary.fileInfo.validRows)}`);
  console.log(`  无效行数: ${summary.fileInfo.invalidRows > 0 ? chalk.red(summary.fileInfo.invalidRows) : chalk.gray('0')}`);
  console.log('\n');

  console.log(chalk.bold.blue('【处理结果概览】'));
  console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  const passRate = parseFloat(summary.validation.passRate);
  console.log(`  退款记录总数: ${chalk.white(summary.validation.totalRecords)} 笔`);
  console.log(`  通过自动审核: ${chalk.green(summary.validation.totalRecords - summary.validation.needsReviewCount)} 笔`);
  console.log(`  需要人工复核: ${chalk.red.bold(summary.validation.needsReviewCount)} 笔`);
  console.log(`  自动通过率: ${passRate >= 80 ? chalk.green(summary.validation.passRate) : passRate >= 50 ? chalk.yellow(summary.validation.passRate) : chalk.red(summary.validation.passRate)}`);
  console.log('\n');

  console.log(chalk.bold.blue('【金额统计】'));
  console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(`  退款总金额: ${chalk.cyan('¥' + summary.amountSummary.totalAmount)}`);
  console.log(`  待复核金额: ${chalk.yellow('¥' + summary.amountSummary.reviewAmount)} (${summary.amountSummary.reviewPercentage})`);
  console.log('\n');

  if (summary.topIssues.length > 0) {
    console.log(chalk.bold.blue('【主要异常类型统计】'));
    console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    for (const issue of summary.topIssues) {
      console.log(`  ${chalk.yellow('▲')} ${issue.description}: ${chalk.red.bold(issue.count)} 笔`);
    }
    console.log('\n');
  }

  console.log(chalk.bold.blue('【需要人工复核的退款明细】'));
  console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  
  printReviewCategory('拆单退款', summary.reviewBreakdown.splitRefund, chalk.yellow);
  printReviewCategory('标签过期', summary.reviewBreakdown.tagExpired, chalk.orange || chalk.yellow);
  printReviewCategory('黑名单解除', summary.reviewBreakdown.blacklistRemoved, chalk.magenta);
  printReviewCategory('重复运行', summary.reviewBreakdown.duplicateRun, chalk.red);
  printReviewCategory('高额退款(≥5000)', summary.reviewBreakdown.highAmount, chalk.cyan);
  printReviewCategory('高风险原因', summary.reviewBreakdown.highRiskReason, chalk.red);
  printReviewCategory('高风险标签', summary.reviewBreakdown.highRiskTag, chalk.red);

  if (summary.parseErrors.length > 0) {
    console.log('\n');
    console.log(chalk.bold.red('【数据解析错误】'));
    console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    for (const error of summary.parseErrors) {
      console.log(`  ${chalk.red('✗')} 第${error.rowNumber}行: ${error.message}`);
    }
  }

  console.log('\n');
  console.log(chalk.bgGreen.black.bold('════════════════════════════════════════════════════════════'));
  console.log(chalk.bgGreen.black.bold(`  报告生成完成！共 ${summary.validation.needsReviewCount} 笔退款需要人工复核  `));
  console.log(chalk.bgGreen.black.bold('════════════════════════════════════════════════════════════'));
  console.log('\n');
}

function printReviewCategory(title, category, color) {
  if (category.count === 0) return;
  
  console.log(`\n  ${color.bold('◆ ' + title + ' (' + category.count + '笔)')}`);
  console.log(chalk.gray('  ──────────────────────────────────────────────────────'));
  
  for (const record of category.records.slice(0, 5)) {
    console.log(`    ${chalk.gray('退款单号:')} ${chalk.white(record.refundNo)}`);
    console.log(`    ${chalk.gray('用户:')} ${record.userName || record.userId}  ${chalk.gray('金额:')} ${chalk.yellow('¥' + record.refundAmount.toFixed(2))}`);
    console.log(`    ${chalk.gray('原因:')} ${chalk.italic(record.refundReason || '未填写')}`);
    console.log();
  }
  
  if (category.count > 5) {
    console.log(chalk.gray(`    ... 还有 ${category.count - 5} 笔记录，请查看完整报告文件`));
  }
}

export async function generateMarkdownReport(summary, outputDir) {
  const content = generateMarkdownContent(summary);
  const fileName = `退款复核报告_${formatDateForFile(summary.fileInfo.processTime)}.md`;
  const filePath = path.join(outputDir, fileName);
  
  await fs.promises.mkdir(outputDir, { recursive: true });
  await fs.promises.writeFile(filePath, content, 'utf8');
  
  return filePath;
}

function generateMarkdownContent(summary) {
  return `# 退款风控记录异常退款复核报告

**生成时间**: ${formatDateTime(summary.fileInfo.processTime)}  
**处理文件**: ${summary.fileInfo.fileName}

---

## 一、文件信息

| 指标 | 数值 |
|------|------|
| 总行数 | ${summary.fileInfo.totalRows} 行 |
| 有效行数 | ${summary.fileInfo.validRows} 行 |
| 无效行数 | ${summary.fileInfo.invalidRows} 行 |

---

## 二、处理结果概览

| 指标 | 数值 |
|------|------|
| 退款记录总数 | ${summary.validation.totalRecords} 笔 |
| 通过自动审核 | ${summary.validation.totalRecords - summary.validation.needsReviewCount} 笔 |
| 需要人工复核 | **${summary.validation.needsReviewCount} 笔** |
| 自动通过率 | ${summary.validation.passRate} |

---

## 三、金额统计

| 指标 | 数值 |
|------|------|
| 退款总金额 | ¥${summary.amountSummary.totalAmount} |
| 待复核金额 | ¥${summary.amountSummary.reviewAmount} (${summary.amountSummary.reviewPercentage}) |

---

## 四、人工复核明细

${generateReviewDetails(summary.reviewBreakdown)}

---

## 五、异常汇总

${summary.topIssues.length > 0 
  ? summary.topIssues.map(issue => `- ${issue.description}: **${issue.count} 笔**`).join('\n')
  : '无异常'
}

---

## 六、数据解析错误

${summary.parseErrors.length > 0
  ? summary.parseErrors.map(error => `- 第${error.rowNumber}行: ${error.message}`).join('\n')
  : '无解析错误'
}

---

*报告由退款风控记录异常退款复核包自动生成*
`;
}

function generateReviewDetails(breakdown) {
  const sections = [];
  
  if (breakdown.splitRefund.count > 0) {
    sections.push(generateReviewSection('拆单退款', breakdown.splitRefund.records));
  }
  if (breakdown.tagExpired.count > 0) {
    sections.push(generateReviewSection('风控标签过期', breakdown.tagExpired.records));
  }
  if (breakdown.blacklistRemoved.count > 0) {
    sections.push(generateReviewSection('黑名单已解除', breakdown.blacklistRemoved.records));
  }
  if (breakdown.duplicateRun.count > 0) {
    sections.push(generateReviewSection('重复运行记录', breakdown.duplicateRun.records));
  }
  if (breakdown.highAmount.count > 0) {
    sections.push(generateReviewSection('高额退款(≥5000)', breakdown.highAmount.records));
  }
  if (breakdown.highRiskReason.count > 0) {
    sections.push(generateReviewSection('高风险退款原因', breakdown.highRiskReason.records));
  }
  if (breakdown.highRiskTag.count > 0) {
    sections.push(generateReviewSection('高风险标签', breakdown.highRiskTag.records));
  }
  
  return sections.join('\n\n');
}

function generateReviewSection(title, records) {
  return `### ${title} (${records.length}笔)

| 退款单号 | 用户 | 金额 | 退款原因 |
|----------|------|------|----------|
${records.map(r => `| ${r.refundNo} | ${r.userName || r.userId} | ¥${r.refundAmount.toFixed(2)} | ${r.refundReason || '-'} |`).join('\n')}
`;
}

function formatDateTime(date) {
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function formatDateForFile(date) {
  return date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}
