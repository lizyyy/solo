const chalk = require('chalk');
const Table = require('cli-table3');

function printSummary(filterResult, parseResult, options) {
  console.log(chalk.bold.blue('\n📊 爬虫流量分析摘要'));
  console.log(chalk.gray('=' .repeat(60)));

  const total = filterResult.totalRecords;
  const botPercent = total > 0 ? ((filterResult.botCount / total) * 100).toFixed(1) : 0;
  const suspiciousPercent = total > 0 ? ((filterResult.suspiciousCount / total) * 100).toFixed(1) : 0;
  const cleanPercent = total > 0 ? ((filterResult.cleanCount / total) * 100).toFixed(1) : 0;

  const statsTable = new Table({
    head: ['分类', '数量', '占比'],
    colWidths: [20, 15, 15]
  });

  statsTable.push(
    [chalk.red('🤖 机器人流量'), filterResult.botCount.toLocaleString(), `${botPercent}%`],
    [chalk.yellow('⚠️  可疑流量'), filterResult.suspiciousCount.toLocaleString(), `${suspiciousPercent}%`],
    [chalk.green('✅ 正常流量'), filterResult.cleanCount.toLocaleString(), `${cleanPercent}%`],
    [chalk.bold('📈 总计'), total.toLocaleString(), '100%']
  );

  console.log(statsTable.toString());

  if (parseResult.badLineCount > 0) {
    console.log(chalk.yellow(`\n⚠️  解析失败行: ${parseResult.badLineCount} 行`));
    console.log(chalk.gray(`   详情请查看输出目录中的 bad-lines.json`));
  }

  console.log(chalk.bold.blue('\n🏆 热门机器人IP (Top 10)'));
  if (filterResult.topBotIPs.length > 0) {
    const ipTable = new Table({
      head: ['IP地址', '总请求', '机器人请求'],
      colWidths: [25, 15, 15]
    });

    filterResult.topBotIPs.slice(0, 10).forEach(item => {
      ipTable.push([
        item.ip,
        item.count.toLocaleString(),
        chalk.red(item.botCount.toLocaleString())
      ]);
    });

    console.log(ipTable.toString());
  } else {
    console.log(chalk.gray('   无数据'));
  }

  console.log(chalk.bold.blue('\n🎯 匹配规则统计'));
  const ruleEntries = Object.entries(filterResult.matchedRules)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  if (ruleEntries.length > 0) {
    const ruleTable = new Table({
      head: ['规则名称', '匹配次数'],
      colWidths: [35, 15]
    });

    ruleEntries.forEach(([rule, count]) => {
      ruleTable.push([rule, count.toLocaleString()]);
    });

    console.log(ruleTable.toString());
  } else {
    console.log(chalk.gray('   无匹配规则'));
  }

  console.log(chalk.bold.blue('\n📈 评分分布'));
  const scoringTable = new Table({
    head: ['评分区间', '数量', '占比'],
    colWidths: [15, 15, 15]
  });

  Object.entries(filterResult.scoring).forEach(([range, count]) => {
    const percent = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
    scoringTable.push([range, count.toLocaleString(), `${percent}%`]);
  });

  console.log(scoringTable.toString());

  if (filterResult.topBotUAs.length > 0) {
    console.log(chalk.bold.blue('\n🤖 可疑UA (Top 5)'));
    filterResult.topBotUAs.slice(0, 5).forEach((item, idx) => {
      const uaPreview = item.userAgent.length > 60 
        ? item.userAgent.substring(0, 60) + '...' 
        : item.userAgent;
      console.log(`   ${idx + 1}. ${chalk.cyan(uaPreview)}`);
      console.log(`      ${chalk.gray(`请求: ${item.count}, 机器人: ${item.botCount}`)}`);
    });
  }

  console.log(chalk.gray('\n' + '='.repeat(60)));
}

module.exports = {
  printSummary
};
