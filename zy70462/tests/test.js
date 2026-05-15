const { execSync } = require('child_process');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');

console.log(chalk.bold('=== 日志脱敏验证工具 - 功能测试 ===\n'));

console.log(chalk.yellow('准备测试环境 - 清理旧数据库...'));
if (fs.existsSync(dataDir)) {
  fs.rmSync(dataDir, { recursive: true, force: true });
  console.log(chalk.gray('  data/ 目录已删除'));
}

let failed = 0;
let passed = 0;

function runStep(cmd, description, shouldPass = true) {
  console.log(chalk.blue(`\n--- ${description} ---`));
  console.log(chalk.gray(`命令: ${cmd}`));
  try {
    const result = execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
    console.log(result);
    if (shouldPass) {
      passed++;
      console.log(chalk.green('✓ 测试通过'));
    } else {
      failed++;
      console.log(chalk.red('✗ 测试失败 - 预期失败但成功了'));
    }
    return true;
  } catch (error) {
    if (!shouldPass) {
      passed++;
      console.log(chalk.green('✓ 测试通过 - 如预期失败'));
      return true;
    }
    console.log(chalk.red('错误:'), error.stderr?.toString() || error.message);
    failed++;
    return false;
  }
}

console.log(chalk.yellow('阶段 1: 验证无需数据库的命令\n'));

runStep('node src/cli.js --help', '查看帮助');

runStep('node src/cli.js --version', '查看版本');

console.log(chalk.yellow('\n阶段 2: 验证不会在纯帮助命令时创建数据库\n'));

if (fs.existsSync('data/validator.db')) {
  console.log(chalk.red('✗ 发现数据库文件，但不应该被创建'));
  failed++;
} else {
  console.log(chalk.green('✓ 数据库文件未被创建 - 符合预期'));
  passed++;
}

console.log(chalk.yellow('\n阶段 3: 测试需要数据库的命令\n'));

runStep('node src/cli.js history', '查询历史记录（空数据库）');

console.log(chalk.yellow('\n阶段 4: 验证数据库已正确创建\n'));

if (fs.existsSync('data/validator.db')) {
  console.log(chalk.green('✓ 数据库文件已创建 - 符合预期'));
  passed++;
} else {
  console.log(chalk.red('✗ 数据库文件未被创建'));
  failed++;
}

console.log('\n' + chalk.bold('=== 测试总结 ==='));
console.log(chalk.green(`通过: ${passed}`));
console.log(chalk.red(`失败: ${failed}`));

if (failed > 0) {
  console.log(chalk.red('\n✗ 部分测试失败'));
  process.exit(1);
} else {
  console.log(chalk.green('\n✓ 所有测试通过!'));
}

console.log('\n' + chalk.bold('接下来请手动运行完整流程测试:'));
console.log(chalk.cyan('  1. 提交批次验证:'));
console.log(chalk.cyan('     node src/cli.js submit -f tests/sample-materials.json'));
console.log(chalk.cyan('  2. 查询历史:'));
console.log(chalk.cyan('     node src/cli.js history'));
console.log(chalk.cyan('  3. 查询批次详情:'));
console.log(chalk.cyan('     node src/cli.js query <batchId>'));
console.log(chalk.cyan('  4. 生成候选清单:'));
console.log(chalk.cyan('     node src/cli.js candidate <batchId> cleanup'));
console.log(chalk.cyan('  5. 按文件摘要搜索:'));
console.log(chalk.cyan('     node src/cli.js search --summary "财务"'));
console.log(chalk.cyan('  6. 查看待人工确认项:'));
console.log(chalk.cyan('     node src/cli.js search --pending'));
