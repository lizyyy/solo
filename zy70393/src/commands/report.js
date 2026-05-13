import chalk from 'chalk';
import { table } from 'table';
import { loadResults, isMarkedFixed } from '../storage.js';

function printFullReport(runData, runIndex) {
  const { summary, config, runAt, testResults, issues } = runData;
  
  console.log('\n' + chalk.bold('═'.repeat(80)));
  console.log(chalk.bold(`租户隔离测试报告 - 运行 #${runIndex}`));
  console.log(chalk.bold('═'.repeat(80)));
  
  console.log(`\n执行时间: ${runAt}`);
  console.log(`耗时: ${runData.duration}ms`);
  console.log(`目标服务: ${config.baseUrl}`);
  console.log();
  
  const summaryTable = [
    [chalk.bold('指标'), chalk.bold('数值'), chalk.bold('说明')],
    ['总测试数', summary.totalTests, '所有租户组合测试'],
    [chalk.green('安全通过'), summary.safeTests, '正确拒绝越权访问'],
    [chalk.red('越权风险'), summary.vulnerableTests, '跨租户访问被允许'],
    [chalk.yellow('跳过'), summary.skippedTests, '标记跳过的用例'],
    [chalk.gray('错误'), summary.errors, '执行出错'],
    [chalk.cyan('唯一风险'), summary.uniqueIssues, '归并后的问题'],
  ];
  
  console.log(table(summaryTable, {
    columns: [{ width: 15 }, { width: 10, alignment: 'right' }, { width: 45 }],
  }));
  
  const issueMap = new Map();
  for (const issue of issues) {
    issueMap.set(issue.id, issue);
  }
  
  if (testResults.length > 0) {
    console.log(chalk.bold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.bold('  测试详情 (正常访问 vs 越权访问 成对展示)'));
    console.log(chalk.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  }
  
  for (let i = 0; i < testResults.length; i++) {
    const result = testResults[i];
    if (result.skipped || result.error) continue;
    
    const normal = result.normalAccess;
    const cross = result.crossTenantAccess;
    
    console.log(`\n${chalk.gray(`[${i + 1}]`)} ${chalk.bold(result.method)} ${result.path}`);
    console.log(`    ${chalk.gray('操作:')} ${result.accessTypeLabel}`);
    console.log(`    ${chalk.gray('目标租户:')} ${result.targetTenant} ${chalk.gray('|')} ${chalk.gray('攻击者租户:')} ${result.attackerTenant}`);
    console.log();
    
    console.log(`    ${chalk.green('● 正常访问')}:`);
    console.log(`      ${chalk.gray('请求:')} ${normal.request.method} ${normal.request.path}`);
    console.log(`      ${chalk.gray('响应:')} ${normal.response.status} ${normal.response.statusText || ''}`);
    console.log(`      ${chalk.gray('结果:')} ${normal.allowed ? chalk.green('✓ 可访问') : chalk.yellow('! 不可访问')}`);
    
    console.log();
    
    console.log(`    ${result.vulnerable ? chalk.red('✗ 越权访问 (漏洞!)') : chalk.blue('✓ 越权访问 (已拒绝)')}:`);
    console.log(`      ${chalk.gray('请求:')} ${cross.request.method} ${cross.request.path}`);
    console.log(`      ${chalk.gray('响应:')} ${cross.response.status} ${cross.response.statusText || ''}`);
    
    if (cross.response.data) {
      const dataStr = JSON.stringify(cross.response.data);
      console.log(`      ${chalk.gray('返回数据:')} ${dataStr.length > 100 ? dataStr.slice(0, 100) + '...' : dataStr}`);
    }
    
    console.log(`      ${chalk.gray('预期:')} 401/403/404 (拒绝)`);
    console.log(`      ${chalk.gray('实际:')} ${cross.wasAllowed ? chalk.red('2xx (允许 - 漏洞!)') : chalk.blue('拒绝 (正确)')}`);
    
    if (result.vulnerable) {
      console.log();
      console.log(`      ${chalk.red.bold('⚠️  越权漏洞检测!')}`);
      console.log(`      ${chalk.red('攻击者租户 ' + result.attackerTenant + ' 可访问租户 ' + result.targetTenant + ' 的资源')}`);
    }
  }
  
  if (issues.length > 0) {
    console.log(chalk.bold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.bold('  唯一风险归并'));
    console.log(chalk.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    
    const issueTable = [
      [
        chalk.bold('风险ID'),
        chalk.bold('类型'),
        chalk.bold('操作'),
        chalk.bold('接口'),
        chalk.bold('出现次数'),
        chalk.bold('状态'),
      ],
    ];
    
    for (const issue of issues) {
      const fixed = isMarkedFixed(issue.id);
      issueTable.push([
        chalk.cyan(issue.id),
        issue.isReadOperation ? chalk.blue('读') : chalk.magenta('写'),
        issue.accessTypeLabel,
        `${issue.method} ${issue.path}`,
        issue.occurrences.length.toString(),
        fixed ? chalk.green('已修复') : chalk.red('待修复'),
      ]);
    }
    
    console.log(table(issueTable, {
      columns: [
        { width: 14 },
        { width: 6 },
        { width: 6 },
        { width: 30 },
        { width: 8, alignment: 'center' },
        { width: 10 },
      ],
    }));
  }
}

function printComparisonReport() {
  const results = loadResults();
  const runs = results.runs;
  
  if (runs.length < 2) {
    console.log(chalk.yellow('需要至少 2 次测试运行才能对比'));
    return;
  }
  
  console.log(chalk.bold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.bold('  历史运行对比'));
  console.log(chalk.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  
  const historyTable = [
    [
      chalk.bold('运行'),
      chalk.bold('时间'),
      chalk.bold('总测试'),
      chalk.bold('安全'),
      chalk.bold('风险'),
      chalk.bold('唯一风险'),
    ],
  ];
  
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    historyTable.push([
      `#${i}`,
      new Date(run.runAt).toLocaleString(),
      run.summary.totalTests.toString(),
      chalk.green(run.summary.safeTests.toString()),
      chalk.red(run.summary.vulnerableTests.toString()),
      run.summary.uniqueIssues.toString(),
    ]);
  }
  
  console.log(table(historyTable, {
    columns: [
      { width: 8 },
      { width: 20 },
      { width: 10, alignment: 'right' },
      { width: 8, alignment: 'right' },
      { width: 8, alignment: 'right' },
      { width: 10, alignment: 'right' },
    ],
  }));
  
  const latest = runs[runs.length - 1];
  const previous = runs[runs.length - 2];
  
  const diff = {
    totalTests: latest.summary.totalTests - previous.summary.totalTests,
    safeTests: latest.summary.safeTests - previous.summary.safeTests,
    vulnerableTests: latest.summary.vulnerableTests - previous.summary.vulnerableTests,
    uniqueIssues: latest.summary.uniqueIssues - previous.summary.uniqueIssues,
  };
  
  console.log(chalk.bold(`\n最新对比 (#${runs.length - 2} → #${runs.length - 1}):`));
  if (diff.vulnerableTests !== 0) {
    console.log(`  越权风险变化: ${diff.vulnerableTests > 0 ? chalk.red('+' + diff.vulnerableTests) : chalk.green(diff.vulnerableTests)}`);
  }
  if (diff.uniqueIssues !== 0) {
    console.log(`  唯一风险变化: ${diff.uniqueIssues > 0 ? chalk.red('+' + diff.uniqueIssues) : chalk.green(diff.uniqueIssues)}`);
  }
  if (diff.vulnerableTests === 0 && diff.uniqueIssues === 0) {
    console.log(chalk.green('  无变化'));
  }
}

export async function handleReport(options) {
  const results = loadResults();
  
  if (results.runs.length === 0) {
    console.log(chalk.yellow('暂无测试记录，请先运行 tit run'));
    return;
  }
  
  if (options.history) {
    printComparisonReport();
    return;
  }
  
  const runIndex = options.run !== undefined ? parseInt(options.run) : results.runs.length - 1;
  const runData = results.runs[runIndex];
  
  if (!runData) {
    console.error(chalk.red(`未找到运行 #${runIndex}`));
    process.exit(1);
  }
  
  printFullReport(runData, runIndex);
}
