const chalk = require('chalk');
const Table = require('cli-table3');

function displayResults(result) {
  console.log('\n' + chalk.yellow('╔═══════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.yellow('║                        去重处理结果汇总                            ║'));
  console.log(chalk.yellow('╚═══════════════════════════════════════════════════════════════════╝\n'));

  const summaryTable = new Table({
    head: [
      chalk.cyan('指标'),
      chalk.cyan('数量'),
      chalk.cyan('说明')
    ],
    colWidths: [25, 15, 30]
  });

  summaryTable.push(
    [chalk.white('原始线索总数'), chalk.white.bold(result.originalCount), '导入的所有线索'],
    [chalk.green('成功合并线索'), chalk.green.bold(result.mergedLeads.length), '无冲突，自动分配'],
    [chalk.red('冲突线索'), chalk.red.bold(result.conflictLeads.length), '需要人工确认归属'],
    [chalk.gray('黑名单线索'), chalk.gray.bold(result.blacklistLeads.length), '已过滤的黑名单客户'],
    [chalk.yellow('重复导入'), chalk.yellow.bold(result.duplicateImportLeads.length), '同一来源多次导入'],
    [chalk.magenta('手机号缺失'), chalk.magenta.bold(result.missingPhoneLeads.length), '需要补充信息']
  );

  console.log(summaryTable.toString());
  console.log('\n');

  if (Object.keys(result.salesBySalesperson).length > 0) {
    console.log(chalk.blue('📋 销售分配统计:'));
    console.log(chalk.blue('─'.repeat(60)));
    
    const salesTable = new Table({
      head: [
        chalk.cyan('销售姓名'),
        chalk.cyan('分配线索数'),
        chalk.cyan('冲突数'),
        chalk.cyan('主要来源')
      ],
      colWidths: [20, 15, 12, 25]
    });

    Object.entries(result.salesBySalesperson).forEach(([sales, leads]) => {
      const conflictCount = leads.filter(l => l.conflicts && l.conflicts.some(c => c.type === 'sales_conflict')).length;
      const sources = [...new Set(leads.flatMap(l => l.sourceNames || []))].join(', ');
      
      salesTable.push([
        sales,
        leads.length,
        conflictCount > 0 ? chalk.red(conflictCount) : chalk.green('0'),
        sources || '-'
      ]);
    });

    console.log(salesTable.toString());
    console.log('\n');
  }

  if (result.needsReview.length > 0) {
    console.log(chalk.red('⚠️  需要人工复核的线索:'));
    console.log(chalk.red('─'.repeat(60)));
    
    const reviewTable = new Table({
      head: [
        chalk.cyan('#'),
        chalk.cyan('线索信息'),
        chalk.cyan('涉及销售'),
        chalk.cyan('复核原因'),
        chalk.cyan('原始来源')
      ],
      colWidths: [5, 25, 18, 20, 22]
    });

    result.needsReview.forEach((lead, index) => {
      const leadInfo = lead.nickname || lead.phone || lead.wechat || '未知';
      const sales = lead.originalRecords
        ? [...new Set(lead.originalRecords.map(r => r.sales).filter(s => s))].join(', ')
        : lead.sales || '-';
      const reviewReason = lead.reviewReason || (lead.conflicts ? lead.conflicts.map(c => c.reason).join('; ') : '未知');
      const sources = (lead.sourceNames || []).join(', ');

      reviewTable.push([
        index + 1,
        leadInfo,
        sales,
        chalk.yellow(reviewReason),
        sources
      ]);
    });

    console.log(reviewTable.toString());
    console.log('\n');

    console.log(chalk.yellow('📌 冲突线索保留的原始来源记录:'));
    result.needsReview.forEach((lead, index) => {
      console.log(chalk.white(`\n  ${index + 1}. 线索: ${lead.nickname || lead.phone || lead.wechat || '未知'}`));
      if (lead.originalRecords) {
        lead.originalRecords.forEach((record, ridx) => {
          console.log(chalk.gray(`     ${ridx + 1}) [${record.sourceName}] ${record.sales || '未分配'} - 来自: ${record.fileSource}`));
        });
      }
    });
  }

  console.log('\n' + chalk.green('✓ 处理完成!'));
}

module.exports = {
  displayResults
};
