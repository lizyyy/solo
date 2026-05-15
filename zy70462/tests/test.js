const { execSync } = require('child_process');
const chalk = require('chalk');

console.log(chalk.bold('=== 日志脱敏验证工具 - 功能测试 ===\n'));

function runCommand(cmd, description) {
  console.log(chalk.blue(`\n--- ${description} ---`));
  console.log(chalk.gray(`命令: ${cmd}`));
  try {
    const result = execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
    console.log(result);
    return true;
  } catch (error) {
    console.log(chalk.red('错误:'), error.stderr?.toString() || error.message);
    return false;
  }
}

console.log(chalk.yellow('注意: 交互式命令需要手动运行，此脚本只运行非交互测试\n'));

runCommand(
  'node src/cli.js --help',
  '查看帮助信息'
);

runCommand(
  'node src/cli.js history',
  '查询历史记录（空数据库）'
);

console.log('\n' + chalk.bold.green('=== 基础测试完成 ==='));
console.log('\n' + chalk.bold('下一步手动运行完整流程测试:'));
console.log(chalk.cyan('  node src/cli.js submit'));
console.log(chalk.cyan('  node src/cli.js history'));
console.log(chalk.cyan('  node src/cli.js query <batchId>'));
console.log(chalk.cyan('  node src/cli.js candidate <batchId> cleanup'));
console.log(chalk.cyan('  node src/cli.js search --summary "财务"'));
console.log(chalk.cyan('  node src/cli.js search --pending'));
console.log('\n' + chalk.bold('或使用示例数据文件:'));
console.log(chalk.cyan('  node src/cli.js submit -f tests/sample-materials.json'));
