#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const chalk = require('chalk');

const projectRoot = path.resolve(__dirname, '..');
process.chdir(projectRoot);

function run(cmd, description) {
  console.log('');
  console.log(chalk.blue('='.repeat(70)));
  console.log(chalk.blue(`▶ ${description}`));
  console.log(chalk.gray(`  $ ${cmd}`));
  console.log(chalk.blue('='.repeat(70)));
  console.log('');
  
  try {
    const output = execSync(`node src/cli.js ${cmd}`, { 
      encoding: 'utf8',
      stdio: 'pipe'
    });
    console.log(output);
    return true;
  } catch (e) {
    console.log(e.stdout);
    console.error(chalk.red(e.stderr));
    return false;
  }
}

console.log(chalk.bgGreen.black(' '.repeat(70)));
console.log(chalk.bgGreen.black('  民宿保洁排班多源导入巡检 CLI - 完整演示流程'));
console.log(chalk.bgGreen.black(' '.repeat(70)));

console.log('');
console.log(chalk.yellow('演示流程:'));
console.log('  1. 初始化工作目录');
console.log('  2. 导入订单日历数据');
console.log('  3. 导入保洁群消息');
console.log('  4. 导入维修备注');
console.log('  5. 导入扫码明细');
console.log('  6. 执行冲突检测');
console.log('  7. 生成报表');
console.log('  8. 自动修复冲突');
console.log('  9. 重新检测并生成报表');
console.log('  10. 查看操作历史');
console.log('  11. 冻结并导出数据');
console.log('');

run('init --force', '1. 初始化工作目录 (强制重置)');

run('import samples/订单日历_20260523.csv --operator 店长', '2. 导入订单日历数据');

run('import samples/保洁群消息_20260523.txt --operator 保洁组长', '3. 导入保洁群消息');

run('import samples/维修备注_20260523.txt --operator 维修主管', '4. 导入维修备注');

run('import samples/扫码明细_20260523.csv --operator 系统', '5. 导入扫码明细');

run('check --date 2026-05-23', '6. 执行冲突检测');

run('report --date 2026-05-23', '7. 生成检测后报表');

run('fix --auto --operator 店长', '8. 自动修复冲突');

run('check --date 2026-05-23', '9. 重新检测冲突');

run('report --date 2026-05-23', '10. 生成修复后报表');

run('history --limit 15', '11. 查看操作历史');

run('export --date 2026-05-23 --freeze --operator 店长', '12. 冻结并导出数据');

console.log('');
console.log(chalk.green('='.repeat(70)));
console.log(chalk.green('✓ 演示完成！'));
console.log(chalk.green('='.repeat(70)));
console.log('');
console.log(chalk.gray('常用命令:'));
console.log('  node src/cli.js report --format csv   # 导出CSV格式报表');
console.log('  node src/cli.js report --format json  # 导出JSON格式报告');
console.log('  node src/cli.js history --snapshots   # 查看所有快照');
console.log('  node src/cli.js freeze --unfreeze     # 解冻数据');
console.log('');
