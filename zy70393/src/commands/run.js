import chalk from 'chalk';
import { table } from 'table';
import { runTests } from '../test-engine.js';
import { loadConfig, addRun, isMarkedFixed } from '../storage.js';
import { startMockServer } from '../mock-server.js';

function printSummary(runData) {
  const { summary, config, runAt, duration } = runData;
  
  console.log('\n' + chalk.bold('━'.repeat(60)));
  console.log(chalk.bold('测试执行摘要'));
  console.log(chalk.bold('━'.repeat(60)));
  console.log(`执行时间: ${runAt}`);
  console.log(`耗时: ${duration}ms`);
  console.log(`目标服务: ${config.baseUrl}`);
  console.log(`租户数量: ${config.tenantCount}`);
  console.log(`测试用例: ${config.testCaseCount}`);
  console.log();
  
  const summaryTable = [
    [chalk.bold('指标'), chalk.bold('数量')],
    ['总测试数', summary.totalTests],
    [chalk.green('安全通过'), summary.safeTests],
    [chalk.red('越权风险'), summary.vulnerableTests],
    [chalk.yellow('跳过'), summary.skippedTests],
    [chalk.gray('错误'), summary.errors],
  ];
  
  console.log(table(summaryTable, {
    columns: [{ width: 20 }, { width: 30, alignment: 'right' }],
  }));
  
  if (summary.uniqueIssues > 0) {
    console.log(chalk.red.bold(`\n⚠️  发现 ${summary.uniqueIssues} 个唯一越权风险:`));
    console.log(`  - 读操作漏洞: ${summary.readIssues}`);
    console.log(`  - 写操作漏洞: ${summary.writeIssues}`);
  } else {
    console.log(chalk.green.bold('\n✓  未发现越权风险'));
  }
}

function printIssues(issues, runIndex) {
  if (issues.length === 0) return;
  
  console.log('\n' + chalk.bold('═'.repeat(60)));
  console.log(chalk.bold('越权风险详情'));
  console.log(chalk.bold('═'.repeat(60)));
  
  for (let i = 0; i < issues.length; i++) {
    const issue = issues[i];
    const isFixed = isMarkedFixed(issue.id);
    
    console.log(`\n${chalk.bold(`[${i + 1}] 风险 ID: ${chalk.cyan(issue.id)}`)}`);
    if (isFixed) {
      console.log(chalk.gray('  状态: ') + chalk.green('已标记修复'));
    } else {
      console.log(chalk.gray('  状态: ') + chalk.red('待修复'));
    }
    console.log(chalk.gray('  类型: ') + (issue.isReadOperation ? chalk.blue('读操作') : chalk.magenta('写操作')));
    console.log(chalk.gray('  操作: ') + issue.accessTypeLabel);
    console.log(chalk.gray('  接口: ') + chalk.bold(issue.method) + ' ' + issue.path);
    console.log(chalk.gray('  描述: ') + issue.description);
    if (issue.requiresAdmin) {
      console.log(chalk.gray('  权限: ') + '需要管理员');
    }
    
    console.log(chalk.gray(`  出现次数: ${issue.occurrences.length} 次`));
    
    console.log(chalk.gray('\n  复现请求（任选一个：'));
    const firstOccur = issue.occurrences[0];
    console.log(`    攻击者租户: ${firstOccur.attackerTenant}`);
    console.log(`    目标租户: ${firstOccur.targetTenant}`);
    console.log(`    目标资源: ${firstOccur.targetResourceId}`);
    console.log(`    返回状态: ${chalk.red(firstOccur.responseStatus)} (应为 403/401/404)`);
    
    const req = firstOccur.request;
    console.log(`    请求: ${chalk.bold(req.method)} ${req.path}`);
    if (req.queryParams && Object.keys(req.queryParams).length > 0) {
      console.log(`    查询参数: ${JSON.stringify(req.queryParams)}`);
    }
    if (req.body) {
      console.log(`    请求体: ${JSON.stringify(req.body)}`);
    }
  }
  
  console.log(`\n${chalk.gray('使用以下命令标记修复:')}`);
  console.log(chalk.gray('  tit mark-fixed <issue-id>'));
  console.log(chalk.gray('  tit rerun --config <config-file>'));
}

export async function handleRun(options) {
  const configPath = options.config || 'tit-config.json';
  
  console.log(chalk.bold('加载配置...'));
  
  let config;
  try {
    config = loadConfig(configPath);
  } catch (error) {
    console.error(chalk.red(`错误: ${error.message}`));
    process.exit(1);
  }
  
  let mockServer = null;
  
  if (options.mock || config.useMock) {
    console.log(chalk.blue('启动内置模拟服务...'));
    const port = options.mockPort || 3000;
    mockServer = await startMockServer(port);
    config.baseUrl = `http://localhost:${port}`;
  }
  
  try {
    console.log(chalk.bold(`\n开始执行租户隔离测试...`));
    console.log(chalk.gray(`目标服务: ${config.baseUrl}`));
    console.log(chalk.gray(`测试用例: ${config.testCases.length}`));
    console.log(chalk.gray(`租户: ${config.tenants.map(t => t.id).join(', ')}`));
    console.log();
    
    const runData = await runTests(config, mockServer);
    const runIndex = addRun(runData);
    
    printSummary(runData);
    printIssues(runData.issues, runIndex);
    
    console.log(`\n${chalk.gray(`测试运行已保存，索引: ${runIndex}`)}`);
    
    if (runData.summary.vulnerableTests > 0) {
      process.exitCode = 1;
    }
  } finally {
    if (mockServer) {
      mockServer.close();
    }
  }
}
