const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

function generateReport(result, outputDir, verbose) {
  const { records, issues, statistics, config } = result;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  const summaryPath = path.join(outputDir, `summary-${timestamp}.json`);
  const issuesPath = path.join(outputDir, `issues-${timestamp}.csv`);
  const cleanedPath = path.join(outputDir, `cleaned-${timestamp}.csv`);
  const evidencePath = path.join(outputDir, `evidence-${timestamp}.txt`);

  fs.writeFileSync(summaryPath, JSON.stringify(statistics, null, 2));
  if (verbose) console.log(chalk.gray(`  已生成统计摘要: ${path.basename(summaryPath)}`));

  const issuesHeader = '行号,类型,严重程度,字段,值,消息,领用日期,耗材名称,领用人,数量\n';
  const issuesContent = issues.map(issue => 
    `${issue.lineNumber},${issue.type},${issue.severity},${issue.field},"${issue.value}","${issue.message}",${issue.record.领用日期},${issue.record.耗材名称},${issue.record.领用人},${issue.record.数量}`
  ).join('\n');
  fs.writeFileSync(issuesPath, issuesHeader + issuesContent);
  if (verbose) console.log(chalk.gray(`  已生成异常明细: ${path.basename(issuesPath)}`));

  if (records.length > 0) {
    const headers = Object.keys(records[0]).filter(k => k !== 'lineNumber' && k !== 'sourceFile');
    const cleanedHeader = headers.join(',') + '\n';
    const cleanedContent = records.map(r => headers.map(h => `"${r[h] || ''}"`).join(',')).join('\n');
    fs.writeFileSync(cleanedPath, cleanedHeader + cleanedContent);
    if (verbose) console.log(chalk.gray(`  已生成清洗数据: ${path.basename(cleanedPath)}`));
  }

  const evidenceContent = generateEvidenceLog(records, issues, statistics, config);
  fs.writeFileSync(evidencePath, evidenceContent);
  if (verbose) console.log(chalk.gray(`  已生成证据日志: ${path.basename(evidencePath)}`));

  printIssueSummary(issues);

  fs.writeFileSync(path.join(outputDir, 'latest-run.txt'), timestamp);
}

function generateEvidenceLog(records, issues, statistics, config) {
  const lines = [];
  lines.push('='.repeat(70));
  lines.push('口腔诊所耗材领用汇总 - 处理证据日志');
  lines.push('='.repeat(70));
  lines.push(`处理时间: ${statistics.processedAt}`);
  lines.push(`源文件: ${statistics.sourceFile}`);
  lines.push(`规则配置: ${config.name} v${config.version}`);
  lines.push('');
  
  lines.push('─'.repeat(70));
  lines.push('【统计摘要】');
  lines.push('─'.repeat(70));
  lines.push(`总记录数: ${statistics.totalRecords}`);
  lines.push(`正常记录: ${statistics.validRecords}`);
  lines.push(`异常记录: ${statistics.recordsWithIssues}`);
  lines.push('');

  if (Object.keys(statistics.issueByType).length > 0) {
    lines.push('─'.repeat(70));
    lines.push('【异常类型分布】');
    lines.push('─'.repeat(70));
    Object.entries(statistics.issueByType).forEach(([type, count]) => {
      lines.push(`  ${type}: ${count} 条`);
    });
    lines.push('');
  }

  if (issues.length > 0) {
    lines.push('─'.repeat(70));
    lines.push('【异常明细 - 按类型分组】');
    lines.push('─'.repeat(70));
    
    const groupedIssues = {};
    issues.forEach(issue => {
      if (!groupedIssues[issue.type]) groupedIssues[issue.type] = [];
      groupedIssues[issue.type].push(issue);
    });

    Object.entries(groupedIssues).forEach(([type, typeIssues]) => {
      lines.push('');
      lines.push(`◆ ${type} (${typeIssues.length}条)`);
      lines.push('  行号 | 领用日期   | 耗材名称         | 领用人   | 详情');
      lines.push('  ' + '─'.repeat(65));
      typeIssues.forEach(issue => {
        const line = String(issue.lineNumber).padStart(4);
        const date = (issue.record.领用日期 || '').padEnd(10);
        const name = (issue.record.耗材名称 || '').padEnd(16);
        const person = (issue.record.领用人 || '').padEnd(8);
        lines.push(`  ${line} | ${date} | ${name} | ${person} | ${issue.message}`);
      });
    });
    lines.push('');
  }

  lines.push('─'.repeat(70));
  lines.push('【处理规则说明】');
  lines.push('─'.repeat(70));
  Object.entries(config.rules).forEach(([key, rule]) => {
    const status = rule.enabled ? '✓启用' : '✗禁用';
    lines.push(`  ${key}: ${status} [严重程度: ${rule.severity}]`);
    if (rule.description) lines.push(`    ${rule.description}`);
  });

  lines.push('');
  lines.push('='.repeat(70));
  lines.push('此文件作为处理证据留存，请勿修改');
  lines.push('='.repeat(70));

  return lines.join('\n');
}

function printIssueSummary(issues) {
  if (issues.length === 0) {
    console.log(chalk.green('\n✓ 未检测到异常'));
    return;
  }

  const grouped = {};
  issues.forEach(issue => {
    if (!grouped[issue.type]) grouped[issue.type] = [];
    grouped[issue.type].push(issue);
  });

  console.log(chalk.yellow('\n【异常汇总】'));
  Object.entries(grouped).forEach(([type, items]) => {
    const color = items.some(i => i.severity === 'high') ? chalk.red : chalk.yellow;
    console.log(color(`\n◆ ${type} (${items.length}条):`));
    items.slice(0, 5).forEach(issue => {
      console.log(color(`   行${issue.lineNumber}: ${issue.record.耗材名称} - ${issue.message}`));
    });
    if (items.length > 5) {
      console.log(color(`   ...还有 ${items.length - 5} 条，请查看完整报告`));
    }
  });
}

module.exports = {
  generateReport
};
