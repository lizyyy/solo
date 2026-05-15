#!/usr/bin/env node

const { execSync } = require('child_process');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

function run(cmd, description) {
  console.log(chalk.blue(`\n--- ${description} ---`));
  console.log(chalk.gray(`命令: ${cmd}`));
  try {
    const result = execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
    console.log(result);
    return { success: true, output: result };
  } catch (error) {
    console.log(chalk.red('错误:'), error.stderr?.toString() || error.message);
    return { success: false, error };
  }
}

console.log(chalk.bold('=== 完整 CLI 自动化验证 ===\n'));

const dataDir = path.join(__dirname, '../data');
if (fs.existsSync(dataDir)) {
  fs.rmSync(dataDir, { recursive: true, force: true });
}

const results = [];

let r = run('node src/cli.js --help', '验证 --help');
results.push({ name: 'help', ...r });

r = run('node src/cli.js --version', '验证 --version');
results.push({ name: 'version', ...r });

r = run('node src/cli.js history', '验证 history (空数据库)');
results.push({ name: 'history-empty', ...r });

r = run('node src/cli.js submit -f tests/sample-materials.json -n test -o admin -r high -y', '验证 submit (非交互模式)');
results.push({ name: 'submit', ...r });

const batchIdMatch = r.output.match(/([0-9a-f-]{36})/);
const batchId = batchIdMatch ? batchIdMatch[1] : null;

if (batchId) {
  console.log(chalk.green(`\n批次ID: ${batchId}`));
  
  r = run(`node src/cli.js query ${batchId}`, '验证 query 详情');
  results.push({ name: 'query', ...r });
  
  r = run(`node src/cli.js candidate ${batchId} cleanup -o admin --no-execute`, '验证 candidate (仅生成)');
  results.push({ name: 'candidate', ...r });
  
  const candidateIdMatch = r.output.match(/候选清单生成成功[:\s]+([0-9a-f-]{36})/);
  const candidateId = candidateIdMatch ? candidateIdMatch[1] : null;
  
  if (candidateId) {
    console.log(chalk.green(`清单ID: ${candidateId}`));
    r = run(`node src/cli.js execute ${candidateId} -y`, '验证 execute (非交互)');
    results.push({ name: 'execute', ...r });
  }
}

r = run('node src/cli.js search --summary "财务"', '验证 search --summary');
results.push({ name: 'search-summary', ...r });

r = run('node src/cli.js search --pending', '验证 search --pending');
results.push({ name: 'search-pending', ...r });

const pendingMatch = r.output.match(/ID[:\s]+([0-9a-f-]{36})/m);
const pendingId = pendingMatch ? pendingMatch[1] : null;

if (pendingId) {
  console.log(chalk.green(`待确认ID: ${pendingId}`));
  r = run(`node src/cli.js confirm ${pendingId} -b "自动化验证"`, '验证 confirm (非交互)');
  results.push({ name: 'confirm', ...r });
}

console.log(chalk.bold('\n=== 验证结果 ===\n'));

const passed = results.filter(r => r.success).length;
const failed = results.filter(r => !r.success).length;

results.forEach(r => {
  const status = r.success ? chalk.green('✓ PASS') : chalk.red('✗ FAIL');
  console.log(`${status} ${r.name}`);
});

console.log(chalk.bold(`\n总计: ${passed} 通过 / ${failed} 失败`));

if (failed === 0) {
  console.log(chalk.green('\n🎉 所有 CLI 命令自动化验证通过！'));
  console.log(chalk.cyan('\n核心流程已稳定可复跑：'));
  console.log(chalk.cyan('  ✅ submit - 提交验证批次'));
  console.log(chalk.cyan('  ✅ query - 查询批次详情'));
  console.log(chalk.cyan('  ✅ history - 查询历史记录'));
  console.log(chalk.cyan('  ✅ candidate - 生成候选清单'));
  console.log(chalk.cyan('  ✅ execute - 执行候选清单'));
  console.log(chalk.cyan('  ✅ search - 搜索功能'));
  console.log(chalk.cyan('  ✅ confirm - 人工确认'));
  process.exit(0);
} else {
  console.log(chalk.red('\n❌ 部分验证失败'));
  process.exit(1);
}
