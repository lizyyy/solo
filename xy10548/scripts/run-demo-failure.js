#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const WORK_DIR = path.join(__dirname, '..', 'demo-failure-data');

function run(cmd, label, allowFailure = false) {
  console.log('\n' + '='.repeat(70));
  console.log('▶ ' + label);
  console.log('='.repeat(70));
  console.log('$ ' + cmd);
  console.log('-'.repeat(70));
  try {
    execSync(cmd, { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    return true;
  } catch (error) {
    console.log('\n❌ 命令执行失败（预期）\n');
    return false;
  }
}

function cleanup() {
  if (fs.existsSync(WORK_DIR)) {
    fs.rmSync(WORK_DIR, { recursive: true, force: true });
  }
}

console.log('\n' + '╔══════════════════════════════════════════════════════════════════════╗');
console.log('║        仓库盘点差异 CLI - 失败路径演示                           ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝');

cleanup();

const CLI = 'node bin/cli.js --work-dir "' + WORK_DIR + '"';

console.log('\n📋 失败场景: 未冻结库位 + 补录无原因 (Case 4)');
console.log('   - SKU007: 库位D-01-01 未冻结');
console.log('   - SKU008: 手工补录缺少原因');
console.log('');

run(CLI + ' init --name "失败演示-问题数据"', '步骤 1: 初始化盘点任务');

run(CLI + ' import book samples/case4-unfrozen/book.json', '步骤 2: 导入账面库存');

run(CLI + ' import freeze samples/case4-unfrozen/freeze.json', '步骤 3: 导入冻结库位（仅D-01-02冻结）');

run(CLI + ' import scan samples/case4-unfrozen/scan.json', '步骤 4: 导入扫码结果');

console.log('\n💡 提示: 下面导入手工补录数据，其中 SKU008 的 reason 为空\n');

run(CLI + ' import manual samples/case4-unfrozen/manual.json', '步骤 5: 导入手工补录（包含无原因记录）');

run(CLI + ' check', '步骤 6: 检查数据一致性 - 会发现严重问题！');

run(CLI + ' report', '步骤 7: 生成报告 - 显示业务未闭环');

run(CLI + ' log', '步骤 8: 查看操作历史');

console.log('\n' + '╔══════════════════════════════════════════════════════════════════════╗');
console.log('║                      失败路径演示完成                          ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝');
console.log('\n❌ 发现的问题:');
console.log('   1. 库位未冻结: SKU007 @ D-01-01');
console.log('      - 扫码时库位未冻结，可能存在出入库操作');
console.log('');
console.log('   2. 补录无原因: SKU008 @ D-01-02');
console.log('      - 手工补录 -10 没有填写原因');
console.log('');
console.log('   业务未闭环原因:');
console.log('   - 存在严重问题，必须先修复数据问题');
console.log('   - 需要:');
console.log('     a. 冻结库位 D-01-01 或说明未冻结原因');
console.log('');
console.log('     b. 补充手工补录的原因说明');
console.log('');
