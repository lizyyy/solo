const chalk = require('chalk');
const Table = require('cli-table3');

function generateConsoleSummary(result) {
  const { metadata, summary, domains, resourceTypes, statusCodes, topSlowest, errors } = result;

  console.log(chalk.bold.blue('='.repeat(60)));
  console.log(chalk.bold.blue('HAR 延迟分析报告'));
  console.log(chalk.bold.blue('='.repeat(60)));
  console.log('');

  console.log(chalk.bold('📊 基本信息'));
  console.log(`  HAR 文件: ${chalk.cyan(metadata.harFile)}`);
  console.log(`  分析时间: ${chalk.cyan(new Date(metadata.analyzedAt).toLocaleString())}`);
  console.log(`  总条目数: ${chalk.white(metadata.totalEntries)}`);
  console.log(`  有效请求: ${chalk.green(metadata.validEntries)}`);
  if (errors.length > 0) {
    console.log(`  异常条目: ${chalk.red(errors.length)}`);
  }
  console.log('');

  console.log(chalk.bold('⏱️ 整体延迟分布'));
  const bucketTable = new Table({
    head: ['分桶', '请求数', '占比'],
    colWidths: [20, 10, 10]
  });
  summary.bucketStats.forEach(stat => {
    const countColor = stat.bucket >= summary.bucketStats.length - 2 ? chalk.red : chalk.white;
    bucketTable.push([
      stat.label,
      countColor(stat.count),
      `${stat.percentage}%`
    ]);
  });
  console.log(bucketTable.toString());
  console.log(`  平均延迟: ${chalk.yellow(summary.avgLatency + 'ms')}`);
  console.log('');

  console.log(chalk.bold('🌐 域名统计 (按请求数排序)'));
  const domainTable = new Table({
    head: ['域名', '请求数', '平均延迟', '慢请求(>2s)'],
    colWidths: [30, 10, 12, 12]
  });
  domains.slice(0, 10).forEach(domain => {
    const slowCount = domain.buckets.slice(3).reduce((a, b) => a + b, 0);
    domainTable.push([
      chalk.cyan(domain.domain.substring(0, 28)),
      domain.count,
      chalk.yellow(domain.avgLatency + 'ms'),
      slowCount > 0 ? chalk.red(slowCount) : '0'
    ]);
  });
  console.log(domainTable.toString());
  console.log('');

  console.log(chalk.bold('📁 资源类型统计'));
  const typeTable = new Table({
    head: ['类型', '请求数', '平均延迟'],
    colWidths: [15, 10, 12]
  });
  resourceTypes.forEach(type => {
    typeTable.push([
      chalk.magenta(type.type),
      type.count,
      chalk.yellow(type.avgLatency + 'ms')
    ]);
  });
  console.log(typeTable.toString());
  console.log('');

  console.log(chalk.bold('📋 状态码统计'));
  const statusTable = new Table({
    head: ['状态码', '请求数', '平均延迟'],
    colWidths: [12, 10, 12]
  });
  statusCodes.forEach(status => {
    const statusColor = status.status.startsWith('4') || status.status.startsWith('5') 
      ? chalk.red 
      : chalk.white;
    statusTable.push([
      statusColor(status.status),
      status.count,
      chalk.yellow(status.avgLatency + 'ms')
    ]);
  });
  console.log(statusTable.toString());
  console.log('');

  console.log(chalk.bold('🐢 TOP 10 最慢请求'));
  const slowTable = new Table({
    head: ['#', '延迟', '域名', 'URL'],
    colWidths: [5, 10, 25, 40]
  });
  topSlowest.slice(0, 10).forEach((req, i) => {
    slowTable.push([
      i + 1,
      chalk.red(req.latency + 'ms'),
      chalk.cyan(req.domain.substring(0, 23)),
      req.url.substring(0, 38) + (req.url.length > 38 ? '...' : '')
    ]);
  });
  console.log(slowTable.toString());
  console.log('');

  if (errors.length > 0) {
    console.log(chalk.bold.red('⚠️ 异常条目'));
    errors.slice(0, 5).forEach((err, i) => {
      console.log(`  ${i + 1}. 位置: ${chalk.gray(err.source)}`);
      console.log(`     错误: ${chalk.red(err.errors.join(', '))}`);
    });
    if (errors.length > 5) {
      console.log(`     ... 还有 ${errors.length - 5} 条异常`);
    }
    console.log('');
  }
}

module.exports = { generateConsoleSummary };
