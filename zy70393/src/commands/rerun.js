import chalk from 'chalk';
import { table } from 'table';
import { runTests } from '../test-engine.js';
import { loadConfig, addRun, loadResults, isMarkedFixed } from '../storage.js';
import { startMockServer } from '../mock-server.js';

function printComparison(oldRun, newRun) {
  const oldIssueIds = new Set(oldRun.issues.map(i => i.id));
  const newIssueIds = new Set(newRun.issues.map(i => i.id));
  
  const fixed = [...oldIssueIds].filter(id => !newIssueIds.has(id));
  const newIssues = [...newIssueIds].filter(id => !oldIssueIds.has(id));
  const remaining = [...oldIssueIds].filter(id => newIssueIds.has(id));
  
  console.log(chalk.bold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.bold('  重跑对比结果'));
  console.log(chalk.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  
  const comparisonTable = [
    [chalk.bold('指标'), chalk.bold('之前'), chalk.bold('现在'), chalk.bold('变化')],
    [
      '总测试数',
      oldRun.summary.totalTests,
      newRun.summary.totalTests,
      newRun.summary.totalTests - oldRun.summary.totalTests,
    ],
    [
      chalk.green('安全通过'),
      oldRun.summary.safeTests,
      newRun.summary.safeTests,
      newRun.summary.safeTests - oldRun.summary.safeTests,
    ],
    [
      chalk.red('越权风险'),
      oldRun.summary.vulnerableTests,
      newRun.summary.vulnerableTests,
      newRun.summary.vulnerableTests - oldRun.summary.vulnerableTests,
    ],
    [
      chalk.cyan('唯一风险'),
      oldRun.summary.uniqueIssues,
      newRun.summary.uniqueIssues,
      newRun.summary.uniqueIssues - oldRun.summary.uniqueIssues,
    ],
  ];
  
  console.log(table(comparisonTable, {
    columns: [
      { width: 15 },
      { width: 10, alignment: 'right' },
      { width: 10, alignment: 'right' },
      { width: 10, alignment: 'right' },
    ],
  }));
  
  if (fixed.length > 0) {
    console.log(chalk.green.bold(`\n✓ 已修复的风险 (${fixed.length} 个):`));
    for (const id of fixed) {
      const oldIssue = oldRun.issues.find(i => i.id === id);
      console.log(`  ${chalk.cyan(id)}: ${oldIssue.method} ${oldIssue.path} - ${oldIssue.description}`);
    }
  }
  
  if (newIssues.length > 0) {
    console.log(chalk.red.bold(`\n⚠️  新发现的风险 (${newIssues.length} 个):`));
    for (const id of newIssues) {
      const newIssue = newRun.issues.find(i => i.id === id);
      console.log(`  ${chalk.cyan(id)}: ${newIssue.method} ${newIssue.path} - ${newIssue.description}`);
    }
  }
  
  if (remaining.length > 0) {
    console.log(chalk.yellow.bold(`\n⚠️  仍存在的风险 (${remaining.length} 个):`));
    for (const id of remaining) {
      const issue = newRun.issues.find(i => i.id === id);
      const wasFixed = isMarkedFixed(id);
      const status = wasFixed ? chalk.green('[已标记]') : chalk.red('[待修复]');
      console.log(`  ${status} ${chalk.cyan(id)}: ${issue.method} ${issue.path}`);
    }
  }
  
  if (fixed.length === 0 && newIssues.length === 0 && remaining.length === 0) {
    console.log(chalk.green('\n✓ 无风险变化'));
  }
}

export async function handleRerun(options) {
  const configPath = options.config || 'tit-config.json';
  
  const results = loadResults();
  
  if (results.runs.length === 0) {
    console.log(chalk.yellow('暂无之前的测试记录，执行首次运行...'));
    const { handleRun } = await import('./run.js');
    return handleRun(options);
  }
  
  const oldRunIndex = options.previous !== undefined 
    ? parseInt(options.previous) 
    : results.runs.length - 1;
  
  const oldRun = results.runs[oldRunIndex];
  if (!oldRun) {
    console.error(chalk.red(`未找到运行 #${oldRunIndex}`));
    process.exit(1);
  }
  
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
    console.log(chalk.bold(`\n开始重跑租户隔离测试 (对比运行 #${oldRunIndex})...`));
    console.log(chalk.gray(`目标服务: ${config.baseUrl}`));
    console.log();
    
    const newRunData = await runTests(config, mockServer);
    const newRunIndex = addRun(newRunData);
    
    console.log(chalk.gray(`新测试运行已保存，索引: ${newRunIndex}`));
    
    printComparison(oldRun, newRunData);
    
    if (newRunData.summary.vulnerableTests > 0) {
      process.exitCode = 1;
    }
  } finally {
    if (mockServer) {
      mockServer.close();
    }
  }
}
