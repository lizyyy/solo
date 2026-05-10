const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const chalk = require('chalk');

const TEST_DIR = path.join(process.cwd(), 'test');
const DATA_DIR = path.join(process.cwd(), 'data');
const CLI = path.join(process.cwd(), 'src', 'index.js');

let passedTests = 0;
let failedTests = 0;

function runCli(args) {
  const result = spawnSync('node', [CLI, ...args], {
    encoding: 'utf8',
    cwd: process.cwd(),
    env: {
      ...process.env,
      VENDING_DATA_DIR: DATA_DIR
    }
  });
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    status: result.status,
    output: result.stdout + result.stderr
  };
}

function cleanup() {
  if (fs.existsSync(DATA_DIR)) {
    fs.readdirSync(DATA_DIR).forEach(file => {
      fs.unlinkSync(path.join(DATA_DIR, file));
    });
    fs.rmdirSync(DATA_DIR);
  }
}

function runTest(name, testFn) {
  console.log(chalk.cyan(`\n▶ ${name}`));
  try {
    testFn();
    console.log(chalk.green(`  ✓ 通过`));
    passedTests++;
  } catch (err) {
    console.log(chalk.red(`  ✗ 失败: ${err.message}`));
    failedTests++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertContains(output, text, message = `期望输出包含: ${text}`) {
  if (!output.includes(text)) {
    throw new Error(`${message}\n实际输出:\n${output}`);
  }
}

function assertNotContains(output, text, message = `期望输出不包含: ${text}`) {
  if (output.includes(text)) {
    throw new Error(message);
  }
}

function assertExitCode(result, expectedCode, message = `期望退出码为 ${expectedCode}`) {
  if (result.status !== expectedCode) {
    throw new Error(`${message}, 实际: ${result.status}\n输出:\n${result.output}`);
  }
}

console.log(chalk.cyan('═══════════════════════════════════════════════════════════'));
console.log(chalk.cyan('              售货机临期品调拨 CLI 验收测试'));
console.log(chalk.cyan('═══════════════════════════════════════════════════════════'));

cleanup();

runTest('场景1: 初始化样例数据 - 正常处理', () => {
  const result = runCli(['init']);
  assertExitCode(result, 0);
  assertContains(result.stdout, '初始化完成');
  assertContains(result.stdout, '插入了 4 个点位');
  assertContains(result.stdout, '插入了 5 个商品');
  assertContains(result.stdout, '插入了 10 条库存记录');
});

runTest('场景2: 执行检查 - 检测临期商品和调拨建议', () => {
  const result = runCli(['check']);
  assertContains(result.stdout, '检查结果汇总');
  assertContains(result.stdout, '临期商品数量');
  assertContains(result.stdout, '调拨建议数量');
  assertContains(result.stdout, '降价建议数量');
});

runTest('场景3: 导入有效数据 - 正常处理', () => {
  const goodCsv = path.join(TEST_DIR, 'sample_inventory_good.csv');
  const result = runCli(['import', goodCsv, '-t', 'inventory', '-d']);
  assertExitCode(result, 0);
  assertContains(result.stdout, '试运行完成');
  assertContains(result.stdout, '10 条记录验证通过');
});

runTest('场景4: 导入无效数据 - 显示失败原因', () => {
  const badCsv = path.join(TEST_DIR, 'sample_inventory_bad.csv');
  const result = runCli(['import', badCsv, '-t', 'inventory']);
  
  assertContains(result.output, '发现');
  assertContains(result.output, '个验证错误');
  
  const hasErrors = 
    result.output.includes('quantity') ||
    result.output.includes('expiry_date') ||
    result.output.includes('location_id') ||
    result.output.includes('product_id');
  
  assert(hasErrors, '应该显示具体的验证错误信息');
});

runTest('场景5: 导入修正后的数据 - 修正后重跑成功', () => {
  const fixedCsv = path.join(TEST_DIR, 'sample_inventory_fixed.csv');
  const result = runCli(['import', fixedCsv, '-t', 'inventory', '-d']);
  assertExitCode(result, 0);
  assertContains(result.stdout, '试运行完成');
  assertContains(result.stdout, '10 条记录验证通过');
  assertNotContains(result.output, '验证错误');
});

runTest('场景6: 查看历史记录 - 显示检查记录', () => {
  const result = runCli(['history']);
  assertExitCode(result, 0);
  assertContains(result.stdout, '历史检查记录');
  assertContains(result.stdout, 'ID');
  assertContains(result.stdout, '检查日期');
});

runTest('场景7: 导出检查结果 - 导出问题清单', () => {
  const result = runCli(['export', '-t', 'issues', '-f', 'json']);
  assertExitCode(result, 0);
  assertContains(result.stdout, '导出成功');
  assertContains(result.stdout, 'exports');
});

runTest('场景8: 执行详细检查 - 显示详细信息', () => {
  const result = runCli(['check', '-v']);
  assertExitCode(result, 1);
  assertContains(result.stdout, '严重问题');
  assertContains(result.stdout, '警告');
  assertContains(result.stdout, '信息提示');
});

runTest('场景9: 检查指定点位 - 限定范围', () => {
  const result = runCli(['check', '-l', 'LOC001']);
  assertContains(result.stdout, '限定点位: LOC001');
});

runTest('场景10: 帮助信息 - 显示使用说明', () => {
  const result = runCli(['--help']);
  assertExitCode(result, 0);
  assertContains(result.stdout, 'init');
  assertContains(result.stdout, 'import');
  assertContains(result.stdout, 'check');
  assertContains(result.stdout, 'history');
  assertContains(result.stdout, 'export');
  assertContains(result.stdout, '示例');
});

console.log(chalk.cyan('\n═══════════════════════════════════════════════════════════'));
console.log(chalk.cyan('                      测试结果汇总'));
console.log(chalk.cyan('═══════════════════════════════════════════════════════════'));
console.log(`  总测试数: ${passedTests + failedTests}`);
console.log(chalk.green(`  通过: ${passedTests}`));
console.log(chalk.red(`  失败: ${failedTests}`));

if (failedTests > 0) {
  console.log(chalk.red('\n✗ 部分测试失败，请检查输出。'));
  process.exit(1);
} else {
  console.log(chalk.green('\n✓ 所有测试通过！'));
  process.exit(0);
}
