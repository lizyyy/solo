const { execSync } = require('child_process');
const chalk = require('chalk');
const fs = require('fs');

console.log(chalk.bold('=== 日志脱敏验证工具 - 功能测试 ===\n'));

let batchId = null;

function runStep(cmd, description) {
  console.log(chalk.blue(`\n--- ${description} ---`));
  console.log(chalk.gray(`命令: ${cmd}`));
  try {
    const result = execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
    console.log(result);
    return result;
  } catch (error) {
    console.log(chalk.red('错误:'), error.stderr?.toString() || error.message);
    return null;
  }
}

console.log(chalk.yellow('注意: 此脚本测试非交互式命令\n'));

runStep('node src/cli.js --help', '查看帮助');

runStep('node src/cli.js history', '查询历史记录（空）');

console.log('\n' + chalk.bold.green('=== 基础功能测试完成 ==='));
console.log('\n' + chalk.bold('接下来请手动运行以下完整流程测试:'));
console.log(chalk.cyan('  1. 提交批次验证:'));
console.log(chalk.cyan('     node src/cli.js submit -f tests/sample-materials.json'));
console.log(chalk.cyan('  2. 查询历史:'));
console.log(chalk.cyan('     node src/cli.js history'));
console.log(chalk.cyan('  3. 查询批次详情:'));
console.log(chalk.cyan('     node src/cli.js query <batchId>'));
console.log(chalk.cyan('  4. 生成候选清单:'));
console.log(chalk.cyan('     node src/cli.js candidate <batchId> cleanup'));
console.log(chalk.cyan('  5. 按摘要搜索:'));
console.log(chalk.cyan('     node src/cli.js search --summary "财务"'));
console.log(chalk.cyan('  6. 查看待人工确认项:'));
console.log(chalk.cyan('     node src/cli.js search --pending'));
