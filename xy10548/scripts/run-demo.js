#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const WORK_DIR = path.join(__dirname, '..', 'demo-data');

function run(cmd, label) {
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
  } catch (error) {
    console.log('\n⚠️  命令执行返回非零退出码\n');
  }
}

function cleanup() {
  if (fs.existsSync(WORK_DIR)) {
    fs.rmSync(WORK_DIR, { recursive: true, force: true });
  }
}

console.log('\n' + '╔══════════════════════════════════════════════════════════════════════╗');
console.log('║           仓库盘点差异 CLI - 完整演示流程                    ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝');

cleanup();

const CLI = 'node bin/cli.js --work-dir "' + WORK_DIR + '"';

console.log('\n📋 演示场景: 复盘修正案例 (Case 5)');
console.log('   - 账面: SKU009=150, SKU010=100');
console.log('   - 扫码: SKU009=140, SKU010=95');
console.log('   - 手工补录: SKU009=-5 (残次品)');
console.log('   - 复盘: SKU009=135, SKU010=100');
console.log('');

run(CLI + ' init --name "2026年5月月度盘点-复盘演示"', '步骤 1: 初始化盘点任务');

run(CLI + ' import book samples/case5-recheck/book.json', '步骤 2: 导入账面库存');

run(CLI + ' import freeze samples/case5-recheck/freeze.json', '步骤 3: 导入冻结库位');

run(CLI + ' import scan samples/case5-recheck/scan.json', '步骤 4: 导入扫码结果');

run(CLI + ' import manual samples/case5-recheck/manual.json', '步骤 5: 导入手工补录');

run(CLI + ' status', '步骤 6: 查看当前状态');

run(CLI + ' check', '步骤 7: 检查数据一致性（复盘前）');

run(CLI + ' detail --sku SKU009', '步骤 8: 查看 SKU009 差异详情');

run(CLI + ' report', '步骤 9: 生成复盘前报告');

run(CLI + ' import recheck samples/case5-recheck/recheck.json', '步骤 10: 导入复盘记录');

run(CLI + ' check', '步骤 11: 检查数据一致性（复盘后）');

run(CLI + ' detail --sku SKU010', '步骤 12: 查看 SKU010 差异详情（复盘后）');

run(CLI + ' report', '步骤 13: 生成最终报告');

run(CLI + ' log', '步骤 14: 查看操作历史记录');

console.log('\n' + '╔══════════════════════════════════════════════════════════════════════╗');
console.log('║                        演示完成！                                ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝');
console.log('\n📊 总结:');
console.log('   - SKU009: 账面150 → 扫码140 + 补录-5 = 实际135 → 差异-15');
console.log('     复盘确认135，确认差异为前期出库未入账');
console.log('');
console.log('   - SKU010: 账面100 → 扫码95 → 差异-5');
console.log('     复盘确认100，首次扫码遗漏5个，实际与账面一致');
console.log('');
console.log('   ✅ 业务已闭环！所有差异已通过复盘确认处理');
