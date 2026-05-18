const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');

const baseDir = path.resolve(__dirname, '..');
const binPath = path.join(baseDir, 'src/index.js');
const rulesPath = path.join(baseDir, 'config/rules.json');

function runTest(name, command, expectedExitCode = 0) {
  console.log(chalk.cyan('='.repeat(60)));
  console.log(chalk.cyan.bold(`测试: ${name}`));
  console.log(chalk.cyan('='.repeat(60)));
  console.log(chalk.gray(`命令: ${command}`));
  console.log('');

  try {
    const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
    console.log(output);
    
    if (expectedExitCode !== 0) {
      console.log(chalk.red(`✗ 预期失败但成功执行`));
      return false;
    }
    console.log(chalk.green(`✓ 测试通过`));
    return true;
  } catch (error) {
    if (error.status === expectedExitCode) {
      console.log(error.stdout);
      if (error.stderr) console.log(chalk.yellow(error.stderr));
      console.log(chalk.green(`✓ 测试通过 (预期退出码: ${expectedExitCode})`));
      return true;
    }
    console.log(error.stdout);
    console.log(chalk.red(error.stderr));
    console.log(chalk.red(`✗ 测试失败 (退出码: ${error.status}, 预期: ${expectedExitCode})`));
    return false;
  }
}

async function main() {
  console.log('');
  console.log(chalk.magenta.bold('='.repeat(70)));
  console.log(chalk.magenta.bold('  试用租户清单延期审批巡检 CLI - 验收测试'));
  console.log(chalk.magenta.bold('='.repeat(70)));
  console.log('');

  const results = [];

  console.log(chalk.blue.bold('【安装依赖】'));
  try {
    execSync('npm install', { cwd: baseDir, stdio: 'inherit' });
    console.log(chalk.green('✓ 依赖安装完成'));
  } catch (e) {
    console.log(chalk.red('✗ 依赖安装失败'));
    return;
  }
  console.log('');

  console.log(chalk.blue.bold('【正常路径测试】'));
  results.push(runTest(
    '正常路径 - 完整数据分析',
    `node ${binPath} -i ${path.join(baseDir, 'samples/normal')} -r ${rulesPath} -o ${path.join(baseDir, 'output/normal')} -f`,
    0
  ));
  console.log('');

  results.push(runTest(
    '试运行模式 - dry-run',
    `node ${binPath} -i ${path.join(baseDir, 'samples/normal')} -r ${rulesPath} -o ${path.join(baseDir, 'output/dryrun')} -d`,
    0
  ));
  console.log('');

  console.log(chalk.blue.bold('【异常路径测试】'));
  results.push(runTest(
    '空目录处理',
    `node ${binPath} -i ${path.join(baseDir, 'samples/empty')} -r ${rulesPath} -o ${path.join(baseDir, 'output/empty')} -f`,
    0
  ));
  console.log('');

  results.push(runTest(
    '缺少必需列的文件',
    `node ${binPath} -i ${path.join(baseDir, 'samples/missing_columns')} -r ${rulesPath} -o ${path.join(baseDir, 'output/missing')} -f`,
    0
  ));
  console.log('');

  results.push(runTest(
    '损坏的CSV文件',
    `node ${binPath} -i ${path.join(baseDir, 'samples/corrupted')} -r ${rulesPath} -o ${path.join(baseDir, 'output/corrupted')} -f`,
    0
  ));
  console.log('');

  results.push(runTest(
    '输入目录不存在',
    `node ${binPath} -i ${path.join(baseDir, 'nonexistent')} -r ${rulesPath} -o ${path.join(baseDir, 'output/test')}`,
    1
  ));
  console.log('');

  results.push(runTest(
    '规则文件不存在',
    `node ${binPath} -i ${path.join(baseDir, 'samples/normal')} -r ${path.join(baseDir, 'nonexistent.json')} -o ${path.join(baseDir, 'output/test')}`,
    1
  ));
  console.log('');

  results.push(runTest(
    '输出目录已存在且不使用覆盖',
    `node ${binPath} -i ${path.join(baseDir, 'samples/normal')} -r ${rulesPath} -o ${path.join(baseDir, 'output/normal')}`,
    1
  ));
  console.log('');

  const passed = results.filter(r => r).length;
  const total = results.length;

  console.log(chalk.magenta.bold('='.repeat(70)));
  console.log(chalk.magenta.bold('  测试总结'));
  console.log(chalk.magenta.bold('='.repeat(70)));
  console.log('');
  console.log(chalk.white.bold(`通过: ${passed}/${total}`));
  console.log('');

  if (passed === total) {
    console.log(chalk.green.bold('✓ 所有测试通过!'));
  } else {
    console.log(chalk.red.bold('✗ 部分测试失败'));
  }
  console.log('');
}

main().catch(console.error);
