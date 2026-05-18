#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const chalk = require('chalk');

const scriptPath = path.resolve(__dirname, '../bin/counseling-desensitize.js');
const sampleDir = path.resolve(__dirname, '../samples');
const testDir = path.resolve(__dirname, '../test');
const outputDir = path.resolve(__dirname, '../test_output');

let passed = 0;
let failed = 0;

function runTest(name, command, expectedExitCode, checkFunction) {
  console.log(chalk.cyan(`\n─────────────────────────────────────────────────────`));
  console.log(chalk.cyan(`测试: ${name}`));
  console.log(chalk.gray(`命令: ${command}`));
  
  try {
    execSync(`${command}`, { stdio: 'pipe' });
    const exitCode = 0;
    
    if (exitCode === expectedExitCode || expectedExitCode === 'any') {
      if (checkFunction) {
        try {
          checkFunction();
        } catch (e) {
          console.log(chalk.red(`✗ 检查失败: ${e.message}`));
          failed++;
          return;
        }
      }
      console.log(chalk.green(`✓ 通过`));
      passed++;
    } else {
      console.log(chalk.red(`✗ 失败 - 期望退出码 ${expectedExitCode}, 实际 ${exitCode}`));
      failed++;
    }
  } catch (error) {
    const exitCode = error.status;
    if (exitCode === expectedExitCode || expectedExitCode === 'any') {
      if (checkFunction) {
        try {
          checkFunction();
        } catch (e) {
          console.log(chalk.red(`✗ 检查失败: ${e.message}`));
          failed++;
          return;
        }
      }
      console.log(chalk.green(`✓ 通过 (退出码: ${exitCode})`));
      passed++;
    } else {
      console.log(chalk.red(`✗ 失败 - 期望退出码 ${expectedExitCode}, 实际 ${exitCode}`));
      console.log(chalk.gray(error.stdout?.toString()));
      console.log(chalk.gray(error.stderr?.toString()));
      failed++;
    }
  }
}

console.log(chalk.cyan.bold('\n╔══════════════════════════════════════════════════╗'));
console.log(chalk.cyan.bold('║          心理咨询室咨询预约脱敏工具测试           ║'));
console.log(chalk.cyan.bold('╚══════════════════════════════════════════════════╝'));

if (fs.existsSync(outputDir)) {
  fs.rmSync(outputDir, { recursive: true, force: true });
}
fs.mkdirSync(outputDir);

runTest(
  '1. 基本功能测试 - 处理正常CSV文件',
  `node ${scriptPath} ${sampleDir}/appointment_sample.csv -o ${outputDir}/test1`,
  1,
  () => {
    const outputFile = `${outputDir}/test1/desensitized_appointment_sample.csv`;
    if (!fs.existsSync(outputFile)) throw new Error('输出文件未生成');
    const content = fs.readFileSync(outputFile, 'utf8');
    if (!content.includes('来访') && !content.includes('同学')) throw new Error('未检测到脱敏处理');
    if (content.includes('13800138001')) throw new Error('手机号未脱敏');
    if (content.includes('张三')) throw new Error('姓名未脱敏');
  }
);

runTest(
  '2. 重复行处理测试',
  `node ${scriptPath} ${sampleDir}/appointment_sample.csv -o ${outputDir}/test2`,
  1,
  () => {
    const outputFile = `${outputDir}/test2/desensitized_appointment_sample.csv`;
    const lines = fs.readFileSync(outputFile, 'utf8').trim().split('\n');
    if (lines.length > 7) throw new Error('重复行未被删除');
  }
);

runTest(
  '3. 空文件处理测试',
  `node ${scriptPath} ${testDir}/test_empty.csv -o ${outputDir}/test3`,
  2,
  () => {}
);

runTest(
  '4. 仅标题无数据测试',
  `node ${scriptPath} ${testDir}/test_only_headers.csv -o ${outputDir}/test4`,
  2,
  () => {}
);

runTest(
  '5. 字段检测功能',
  `node ${scriptPath} detect ${sampleDir}/appointment_sample.csv`,
  0,
  () => {}
);

runTest(
  '6. 多文件批量处理（包含成功和失败）',
  `node ${scriptPath} ${sampleDir}/appointment_sample.csv ${testDir}/test_empty.csv ${sampleDir}/another_sample.csv -o ${outputDir}/test6`,
  1,
  () => {
    const files = fs.readdirSync(`${outputDir}/test6`);
    if (files.length < 2) throw new Error('成功的文件未全部处理');
  }
);

runTest(
  '7. 另一种字段命名格式测试',
  `node ${scriptPath} ${sampleDir}/another_sample.csv -o ${outputDir}/test7`,
  1,
  () => {
    const outputFile = `${outputDir}/test7/desensitized_another_sample.csv`;
    if (!fs.existsSync(outputFile)) throw new Error('输出文件未生成');
    const content = fs.readFileSync(outputFile, 'utf8');
    const lines = content.split('\n');
    const secondLine = lines[1] || '';
    if (secondLine.includes('周小红')) throw new Error('学生姓名列未脱敏');
    if (content.includes('13812345678')) throw new Error('电话未脱敏');
  }
);

runTest(
  '8. 保留重复行选项测试',
  `node ${scriptPath} ${sampleDir}/appointment_sample.csv --keep-duplicates -o ${outputDir}/test8`,
  1,
  () => {
    const outputFile = `${outputDir}/test8/desensitized_appointment_sample.csv`;
    const lines = fs.readFileSync(outputFile, 'utf8').trim().split('\n');
    if (lines.length !== 7) throw new Error('重复行应该被保留');
  }
);

runTest(
  '9. 可复跑输出测试 - 两次运行结果相同',
  `node ${scriptPath} ${sampleDir}/appointment_sample.csv -o ${outputDir}/test9a`,
  1,
  () => {
    try {
      execSync(`node ${scriptPath} ${sampleDir}/appointment_sample.csv -o ${outputDir}/test9b`, { stdio: 'pipe' });
    } catch (e) {}
    const content1 = fs.readFileSync(`${outputDir}/test9a/desensitized_appointment_sample.csv`, 'utf8');
    const content2 = fs.readFileSync(`${outputDir}/test9b/desensitized_appointment_sample.csv`, 'utf8');
    if (content1 !== content2) throw new Error('两次运行结果不同，不可复跑');
  }
);

runTest(
  '10. 版本号显示',
  `node ${scriptPath} --version`,
  0,
  () => {}
);

console.log(chalk.cyan(`\n─────────────────────────────────────────────────────`));
console.log(chalk.cyan.bold(`\n📊 测试结果汇总:`));
console.log(chalk.green(`   通过: ${passed}`));
console.log(chalk.red(`   失败: ${failed}`));
console.log(chalk.cyan(`   总计: ${passed + failed}`));
console.log(chalk.cyan(`─────────────────────────────────────────────────────\n`));

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}