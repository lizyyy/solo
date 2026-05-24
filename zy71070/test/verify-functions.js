#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

function runTest(name, command, expectedExitCode = 0) {
  console.log(`\n🧪 测试: ${name}`);
  console.log(`   命令: ${command}`);
  try {
    execSync(command, { stdio: 'pipe', encoding: 'utf-8' });
    console.log(`   ✅ 通过 (退出码: 0)`);
    return true;
  } catch (error) {
    if (error.status === expectedExitCode) {
      console.log(`   ✅ 通过 (预期退出码: ${expectedExitCode})`);
      return true;
    } else {
      console.log(`   ❌ 失败 (退出码: ${error.status}, 预期: ${expectedExitCode})`);
      console.log(`   输出: ${error.stdout} ${error.stderr}`);
      return false;
    }
  }
}

const baseCmd = 'node bin/config-trace.js';
const defaultArgs = '-d examples/default.json -e examples/env.json -t examples/tenant.json';

console.log('═══════════════════════════════════════════════════════════════');
console.log('           JSON 配置合并轨迹 CLI - 功能验证测试');
console.log('═══════════════════════════════════════════════════════════════');

const results = [];

results.push(runTest('帮助命令', `${baseCmd} --help`));
results.push(runTest('版本命令', `${baseCmd} --version`));

results.push(runTest('基本合并 (彩色)', `${baseCmd} ${defaultArgs} -o output --format terminal`));

results.push(runTest('无颜色模式 (--no-color)', `${baseCmd} ${defaultArgs} -o output --no-color --format terminal`));

results.push(runTest('静默模式 (--silent)', `${baseCmd} ${defaultArgs} -o output --silent`));

results.push(runTest('键路径追踪 (-k)', `${baseCmd} ${defaultArgs} -o output -k database.host`));

results.push(runTest('数组合并 - replace模式', `${baseCmd} ${defaultArgs} -o output --array-merge replace`));
results.push(runTest('数组合并 - concat模式', `${baseCmd} ${defaultArgs} -o output --array-merge concat`));
results.push(runTest('数组合并 - unique模式', `${baseCmd} ${defaultArgs} -o output --array-merge unique`));

results.push(runTest('大小写敏感模式', `${baseCmd} ${defaultArgs} -o output --case-sensitive`));

results.push(runTest('只输出 JSON', `${baseCmd} ${defaultArgs} -o output --format json`));
results.push(runTest('只输出 Markdown', `${baseCmd} ${defaultArgs} -o output --format markdown`));
results.push(runTest('只输出终端', `${baseCmd} ${defaultArgs} -o output --format terminal`));

results.push(runTest('.env 文件嵌套配置解析', `${baseCmd} -d examples/default.json -e examples/.env -t examples/tenant.json -k database.password --format terminal`));
results.push(runTest('缺少参数', `${baseCmd}`, 1));
results.push(runTest('文件不存在', `${baseCmd} -d nonexistent.json -e examples/env.json -t examples/tenant.json`, 2));
results.push(runTest('无效 JSON', `${baseCmd} -d examples/bad-invalid.json -e examples/env.json -t examples/tenant.json`, 3));
results.push(runTest('输出路径为已存在文件', `${baseCmd} ${defaultArgs} -o package.json --format json`, 5));
results.push(runTest('键路径不存在', `${baseCmd} ${defaultArgs} -k non.existent.path`, 6));

console.log('\n═══════════════════════════════════════════════════════════════');
const passed = results.filter(r => r).length;
const total = results.length;
console.log(`测试结果: ${passed}/${total} 通过`);
if (passed === total) {
  console.log('🎉 所有测试通过！');
  process.exit(0);
} else {
  console.log(`⚠️  有 ${total - passed} 个测试失败`);
  process.exit(1);
}
