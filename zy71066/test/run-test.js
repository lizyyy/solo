#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const runClean = args.includes('--clean') || args.length === 0;
const runDirty = args.includes('--dirty') || args.length === 0;

console.log('========================================');
console.log('  变更日志工单链接 CLI - 测试脚本');
console.log('========================================\n');

function runTest(name, command, expectedExitCodes = [0]) {
  console.log(`\n▶️  测试: ${name}`);
  console.log(`   命令: ${command}`);
  console.log('   ──────────────────────────────────────');

  try {
    const output = execSync(command, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    console.log(output);
    console.log(`   ✅ 测试通过 (退出码: 0)`);
    return { success: true, exitCode: 0 };
  } catch (error) {
    const exitCode = error.status;
    if (expectedExitCodes.includes(exitCode)) {
      console.log(error.stdout);
      if (error.stderr) console.error(error.stderr);
      console.log(`   ✅ 测试通过 (预期退出码: ${exitCode})`);
      return { success: true, exitCode };
    } else {
      console.log(error.stdout);
      if (error.stderr) console.error(error.stderr);
      console.log(`   ❌ 测试失败 (退出码: ${exitCode}, 预期: ${expectedExitCodes.join(', ')})`);
      return { success: false, exitCode };
    }
  }
}

function verifyOutputs(subDir = '') {
  console.log('\n\n📋 验证输出文件一致性...');
  console.log('   ──────────────────────────────────────');

  const outputDir = path.resolve(__dirname, '../output', subDir);
  const jsonPath = path.join(outputDir, 'changelog-analysis.json');
  const mdPath = path.join(outputDir, 'changelog-report.md');

  let allConsistent = true;

  if (fs.existsSync(jsonPath)) {
    console.log('   ✅ JSON 文件存在');
    try {
      const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      console.log(`      - 记录数: ${jsonData.meta.totalEntries}`);
      console.log(`      - 工单数: ${jsonData.meta.totalTickets}`);

      if (fs.existsSync(mdPath)) {
        console.log('   ✅ Markdown 文件存在');
        const mdContent = fs.readFileSync(mdPath, 'utf-8');

        const jsonTickets = jsonData.meta.totalTickets;
        const mdTicketMatch = mdContent.match(/匹配工单总数\s*\|\s*(\d+)/);
        const mdTickets = mdTicketMatch ? parseInt(mdTicketMatch[1]) : -1;

        if (jsonTickets === mdTickets) {
          console.log('   ✅ 工单数量一致');
        } else {
          console.log(`   ❌ 工单数量不一致 (JSON: ${jsonTickets}, MD: ${mdTickets})`);
          allConsistent = false;
        }

        const jsonEntries = jsonData.meta.totalEntries;
        const mdEntryMatch = mdContent.match(/变更记录总数\s*\|\s*(\d+)/);
        const mdEntries = mdEntryMatch ? parseInt(mdEntryMatch[1]) : -1;

        if (jsonEntries === mdEntries) {
          console.log('   ✅ 记录数量一致');
        } else {
          console.log(`   ❌ 记录数量不一致 (JSON: ${jsonEntries}, MD: ${mdEntries})`);
          allConsistent = false;
        }
      }
    } catch (e) {
      console.log(`   ❌ JSON 解析失败: ${e.message}`);
      allConsistent = false;
    }
  } else {
    console.log('   ❌ JSON 文件不存在');
    allConsistent = false;
  }

  return allConsistent;
}

const results = [];

if (runClean) {
  console.log('\n🧹 测试 1: 干净输入');
  console.log('═══════════════════════════════════════');

  results.push(runTest(
    '干净输入 - 完整分析',
    `node bin/changelog-ticket.js -c examples/clean-changelog.md -o examples/owners.json -d output/clean --verbose`,
    [0, 10, 11]
  ));

  results.push({ consistent: verifyOutputs('clean') });
}

if (runDirty) {
  console.log('\n💩 测试 2: 脏输入');
  console.log('═══════════════════════════════════════');

  results.push(runTest(
    '脏输入 - 格式混乱处理',
    `node bin/changelog-ticket.js -c examples/dirty-changelog.md -o examples/owners.json -d output/dirty --verbose`,
    [0, 10, 11]
  ));

  results.push({ consistent: verifyOutputs('dirty') });
}

console.log('\n\n========================================');
console.log('  测试结果汇总');
console.log('========================================');

const passed = results.filter(r => r.success !== false).length;
const total = results.filter(r => r.success !== undefined).length;
console.log(`\n通过: ${passed}/${total}`);

if (results.every(r => r.success !== false && r.consistent !== false)) {
  console.log('\n🎉 所有测试通过!');
  process.exit(0);
} else {
  console.log('\n❌ 部分测试失败');
  process.exit(1);
}
