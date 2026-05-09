const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');

const projectDir = __dirname;

function runCommand(command) {
  console.log(chalk.blue(`\n$ ${command}`));
  try {
    const output = execSync(command, {
      cwd: projectDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    console.log(output);
    return output;
  } catch (error) {
    console.log(error.stdout ? error.stdout : error.message);
    return error.stdout || error.message;
  }
}

console.log(chalk.bold(chalk.cyan('═══════════════════════════════════════')));
console.log(chalk.bold(chalk.cyan('  校园社团经费票据 CLI 工具 - 验收测试')));
console.log(chalk.bold(chalk.cyan('═══════════════════════════════════════')));

const workDir = path.join(projectDir, '.club-reimbursement');
if (fs.existsSync(workDir)) {
  console.log(chalk.yellow('\n清理旧的工作目录...'));
  fs.rmSync(workDir, { recursive: true, force: true });
}

console.log(chalk.bold('\n═══════════════════════════════════════'));
console.log(chalk.bold('  场景 1: 初始化 (init)'));
console.log(chalk.bold('═══════════════════════════════════════'));
runCommand('node index.js init');

console.log(chalk.bold('\n═══════════════════════════════════════'));
console.log(chalk.bold('  场景 2: 首次校验 (初始数据存在问题'));
console.log(chalk.bold('═══════════════════════════════════════'));
console.log(chalk.gray('预期结果：'));
console.log(chalk.gray('  ACT-2026-003 (志愿者招募活动) - PASS'));
console.log(chalk.gray('  ACT-2026-001 (春季校园文化节) - WARN/FAIL'));
console.log(chalk.gray('  ACT-2026-002 (编程大赛) - FAIL (预算未审批，无审批记录)'));
console.log(chalk.gray('  ACT-2026-004 (演讲比赛) - FAIL (审批不完整)'));
runCommand('node index.js check');

console.log(chalk.bold('\n═══════════════════════════════════════'));
console.log(chalk.bold('  场景 3: 查看历史 (history)'));
console.log(chalk.bold('═══════════════════════════════════════'));
runCommand('node index.js history');

console.log(chalk.bold('\n═══════════════════════════════════════'));
console.log(chalk.bold('  场景 4: 导入修复数据 (import)'));
console.log(chalk.bold('═══════════════════════════════════════'));
console.log(chalk.gray('修复内容：'));
console.log(chalk.gray('  - ACT-2026-002 预算状态改为 approved'));
console.log(chalk.gray('  - 添加 ACT-2026-002 和 ACT-2026-004 的审批记录'));
runCommand('node index.js import examples/budgets-fixed.json -t budget');
runCommand('node index.js import examples/approvals-fixed.json -t approval');

console.log(chalk.bold('\n═══════════════════════════════════════'));
console.log(chalk.bold('  场景 5: 重新校验 (修复后重跑'));
console.log(chalk.bold('═══════════════════════════════════════'));
console.log(chalk.gray('预期结果：'));
console.log(chalk.gray('  ACT-2026-003 - PASS'));
console.log(chalk.gray('  ACT-2026-001 - PASS/WARN'));
console.log(chalk.gray('  ACT-2026-002 - PASS (预算和审批都已通过)'));
console.log(chalk.gray('  ACT-2026-004 - PASS (审批完整)'));
runCommand('node index.js check');

console.log(chalk.bold('\n═══════════════════════════════════════'));
console.log(chalk.bold('  场景 6: 导出结果 (export)'));
console.log(chalk.bold('═══════════════════════════════════════'));
runCommand('node index.js export test-result.json -f json');
runCommand('node index.js export test-result.csv -f csv');

console.log(chalk.bold('\n═══════════════════════════════════════'));
console.log(chalk.bold('  验收完成！'));
console.log(chalk.bold('═══════════════════════════════════════'));
console.log('\n');

if (fs.existsSync(path.join(projectDir, 'test-result.json'))) {
  console.log(chalk.green('✓ JSON 导出文件已创建: test-result.json'));
}
if (fs.existsSync(path.join(projectDir, 'test-result.csv'))) {
  console.log(chalk.green('✓ CSV 导出文件已创建: test-result.csv'));
}

console.log('\n');
console.log(chalk.cyan('三种验收结果说明：'));
console.log(chalk.green('  1. 正常处理 (PASS)'));
console.log(chalk.green('     - 活动 ACT-2026-003 志愿者招募活动'));
console.log(chalk.green('     - 预算、票据、审批完整匹配'));
console.log('');
console.log(chalk.red('  2. 失败原因 (FAIL)'));
console.log(chalk.red('     - 活动 ACT-2026-002 编程大赛 (首次校验)'));
console.log(chalk.red('     - 问题：预算未审批 (WARN) + 无审批记录 (FAIL)'));
console.log('');
console.log(chalk.yellow('  3. 修正后重跑'));
console.log(chalk.yellow('     - 修复：预算状态改为 approved'));
console.log(chalk.yellow('     - 导入：添加审批记录'));
console.log(chalk.yellow('     - 重新校验后状态改善'));
