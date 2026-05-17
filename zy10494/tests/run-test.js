#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectRoot = path.resolve(__dirname, '..');
const cliPath = path.join(projectRoot, 'src/index.js');
const sampleCsv = path.join(projectRoot, 'examples/sample-images.csv');
const sampleYaml = path.join(projectRoot, 'examples/sample-images.yaml');
const outputDir = path.join(projectRoot, 'outputs', 'test');

function runTest(name, command, expectedExitCode = 0) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`测试: ${name}`);
  console.log(`命令: ${command}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  try {
    execSync(command, {
      cwd: projectRoot,
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'test' }
    });
    console.log(chalk.green(`\n✅ 测试通过 (退出码: 0)`));
    return true;
  } catch (error) {
    const exitCode = error.status;
    if (exitCode === expectedExitCode) {
      console.log(chalk.green(`\n✅ 测试通过 (预期退出码: ${expectedExitCode})`));
      return true;
    }
    console.log(chalk.red(`\n❌ 测试失败 (退出码: ${exitCode}, 预期: ${expectedExitCode})`));
    return false;
  }
}

const chalk = {
  green: (msg) => `\x1b[32m${msg}\x1b[0m`,
  red: (msg) => `\x1b[31m${msg}\x1b[0m`,
  yellow: (msg) => `\x1b[33m${msg}\x1b[0m`,
  cyan: (msg) => `\x1b[36m${msg}\x1b[0m`,
  bold: (msg) => `\x1b[1m${msg}\x1b[0m`
};

console.log(chalk.cyan(`
╔══════════════════════════════════════════════════════════════╗
║                    镜像晋级清单 CLI 测试套件                   ║
╚══════════════════════════════════════════════════════════════╝
`));

if (!fs.existsSync(path.join(projectRoot, 'node_modules'))) {
  console.log(chalk.yellow('⚠️  依赖未安装，正在安装...\n'));
  execSync('npm install', { cwd: projectRoot, stdio: 'inherit' });
}

fs.mkdirSync(outputDir, { recursive: true });

const results = [];

results.push(runTest(
  '帮助信息',
  `node ${cliPath} --help`,
  0
));

results.push(runTest(
  '版本信息',
  `node ${cliPath} --version`,
  0
));

results.push(runTest(
  'CSV 输入 - 默认配置',
  `node ${cliPath} -i ${sampleCsv} -o ${outputDir}/csv-default`,
  2
));

results.push(runTest(
  'YAML 输入 - 默认配置',
  `node ${cliPath} -i ${sampleYaml} -o ${outputDir}/yaml-default`,
  2
));

results.push(runTest(
  '更宽松的扫描门禁 (high)',
  `node ${cliPath} -i ${sampleCsv} -o ${outputDir}/scan-gate-high --scan-gate high`,
  2
));

results.push(runTest(
  '严格模式',
  `node ${cliPath} -i ${sampleCsv} -o ${outputDir}/strict-mode --strict`,
  2
));

results.push(runTest(
  '仅 JSON 输出',
  `node ${cliPath} -i ${sampleCsv} -o ${outputDir}/json-only --format json`,
  2
));

results.push(runTest(
  '仅 Markdown 输出',
  `node ${cliPath} -i ${sampleCsv} -o ${outputDir}/md-only --format markdown`,
  2
));

results.push(runTest(
  'Verbose 模式',
  `node ${cliPath} -i ${sampleCsv} -o ${outputDir}/verbose --verbose`,
  2
));

results.push(runTest(
  '无效文件路径 - 应该报错',
  `node ${cliPath} -i /nonexistent/file.csv -o ${outputDir}/error`,
  1
));

results.push(runTest(
  '无效格式参数 - 应该报错',
  `node ${cliPath} -i ${sampleCsv} -o ${outputDir}/error2 --format invalid`,
  1
));

console.log(`\n${chalk.cyan('══════════════════════════════════════════════════════════════')}`);
console.log(chalk.bold('                           测试总结'));
console.log(chalk.cyan('══════════════════════════════════════════════════════════════\n'));

const passed = results.filter(r => r).length;
const total = results.length;

console.log(`通过: ${chalk.green(passed.toString())} / ${total}`);
console.log(`失败: ${chalk.red((total - passed).toString())}`);

if (passed === total) {
  console.log(chalk.green('\n🎉 所有测试通过!'));
  process.exit(0);
} else {
  console.log(chalk.red('\n❌ 部分测试失败!'));
  process.exit(1);
}
