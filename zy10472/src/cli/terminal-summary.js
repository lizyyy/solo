const chalk = require('chalk');
const Table = require('cli-table3');

function printSummary({ results, riskSummary, scanStats, parseErrors, invalidRecords, outputDir }) {
  console.log(chalk.bold('\n' + '='.repeat(60)));
  console.log(chalk.bold('📊 Feature Flag 清理报告'));
  console.log(chalk.bold('='.repeat(60)));

  console.log(chalk.bold('\n📈 扫描统计:'));
  const scanTable = new Table({
    head: ['指标', '数值'],
    colWidths: [40, 15]
  });
  scanTable.push(['扫描文件数', scanStats.filesScanned]);
  scanTable.push(['扫描行数', scanStats.linesScanned.toLocaleString()]);
  scanTable.push(['发现引用数', scanStats.matchesFound]);
  console.log(scanTable.toString());

  console.log(chalk.bold('\n🎯 风险汇总:'));
  const riskTable = new Table({
    head: ['风险等级', '数量', '说明'],
    colWidths: [15, 10, 30]
  });
  riskTable.push([chalk.green('✅ 安全'), riskSummary.safe, '可以直接删除']);
  riskTable.push([chalk.yellow('⚠️ 注意'), riskSummary.caution, '建议人工复核']);
  riskTable.push([chalk.red('❌ 高风险'), riskSummary.high, '需要详细评估']);
  riskTable.push([chalk.gray('❓ 未知'), riskSummary.unknown, '信息不足']);
  console.log(riskTable.toString());

  if (parseErrors && parseErrors.length > 0) {
    console.log(chalk.yellow.bold(`\n⚠️ 解析警告 (${parseErrors.length} 项):`));
    parseErrors.slice(0, 5).forEach(err => {
      console.log(chalk.yellow(`  - ${err.source}:${err.line || 0}: ${err.error}`));
    });
    if (parseErrors.length > 5) {
      console.log(chalk.yellow(`  ... 还有 ${parseErrors.length - 5} 个警告`));
    }
  }

  if (invalidRecords && invalidRecords.length > 0) {
    console.log(chalk.red.bold(`\n❌ 无法处理的记录 (${invalidRecords.length} 项):`));
    invalidRecords.slice(0, 3).forEach(rec => {
      console.log(chalk.red(`  - ${rec.source}:${rec.lineNumber}: ${rec.error}`));
    });
    if (invalidRecords.length > 3) {
      console.log(chalk.red(`  ... 还有 ${invalidRecords.length - 3} 条记录，详情见 invalid-records.json`));
    }
  }

  console.log(chalk.bold('\n📋 开关详情:'));

  const safeFlags = results.filter(r => r.riskLevel === 'safe');
  if (safeFlags.length > 0) {
    console.log(chalk.green.bold('\n✅ 可以安全删除的开关:'));
    const safeTable = new Table({
      head: ['开关名称', '引用数', '文件数', '建议'],
      colWidths: [30, 10, 10, 30]
    });
    safeFlags.slice(0, 10).forEach(flag => {
      safeTable.push([
        flag.name,
        flag.referenceCount,
        flag.fileCount,
        flag.recommendation
      ]);
    });
    console.log(safeTable.toString());
    if (safeFlags.length > 10) {
      console.log(chalk.green(`  ... 还有 ${safeFlags.length - 10} 个安全开关`));
    }
  }

  const highRiskFlags = results.filter(r => r.riskLevel === 'high');
  if (highRiskFlags.length > 0) {
    console.log(chalk.red.bold('\n❌ 高风险开关（需要重点关注）:'));
    const highTable = new Table({
      head: ['开关名称', '引用数', '风险分', '关键风险因素'],
      colWidths: [25, 10, 10, 35]
    });
    highRiskFlags.slice(0, 5).forEach(flag => {
      highTable.push([
        flag.name,
        flag.referenceCount,
        flag.riskScore,
        flag.riskFactors[0] || 'N/A'
      ]);
    });
    console.log(highTable.toString());
    if (highRiskFlags.length > 5) {
      console.log(chalk.red(`  ... 还有 ${highRiskFlags.length - 5} 个高风险开关`));
    }
  }

  console.log(chalk.bold('\n📁 输出文件:'));
  console.log(chalk.cyan(`  📄 完整报告 (HTML): ${outputDir}/report.html`));
  console.log(chalk.cyan(`  📄 机器可读结果 (JSON): ${outputDir}/results.json`));
  if (invalidRecords && invalidRecords.length > 0) {
    console.log(chalk.cyan(`  📄 无效记录: ${outputDir}/invalid-records.json`));
  }

  console.log(chalk.bold.green('\n✨ 分析完成!'));
  console.log(chalk.gray('\n提示: 打开 report.html 查看详细的交互式报告\n'));
}

module.exports = { printSummary };
