const { spawnSync } = require('child_process');
const path = require('path');

const testScripts = [
  { name: '正常流程测试', script: 'test-normal.js' },
  { name: '异常流程测试', script: 'test-abnormal.js' },
  { name: '重复运行测试', script: 'test-duplicate.js' }
];

function runTest(script, name) {
  console.log('\n' + '='.repeat(70));
  console.log(`运行: ${name}`);
  console.log('='.repeat(70));
  console.log('');

  const result = spawnSync('node', [path.join(__dirname, script)], {
    stdio: 'inherit',
    encoding: 'utf8'
  });

  return result.status === 0;
}

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║           数据血缘服务字段下线订阅通知 - 集成测试             ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log('');
console.log('⚠️  请确保服务已启动: npm start');
console.log('');

const results = [];
for (const test of testScripts) {
  const success = runTest(test.script, test.name);
  results.push({ name: test.name, success });
}

console.log('');
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║                         测试结果汇总                          ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log('');

let passed = 0;
let failed = 0;

for (const result of results) {
  const status = result.success ? '✅ 通过' : '❌ 失败';
  console.log(`  ${status} - ${result.name}`);
  if (result.success) passed++;
  else failed++;
}

console.log('');
console.log(`  总计: ${results.length} 个测试`);
console.log(`  通过: ${passed} 个`);
console.log(`  失败: ${failed} 个`);
console.log('');

console.log('═══════════════════════════════════════════════════════════════');
console.log('人工复核步骤:');
console.log('');
console.log('1. 查看每个测试的详细输出，确认各API调用返回正确');
console.log('2. 调用 GET /api/deprecation/statistics 查看统计数据是否合理');
console.log('3. 调用 GET /api/deprecation/export 导出CSV，检查数据完整性');
console.log('4. 验证未确认字段发布时是否被正确阻止，错误信息清晰');
console.log('5. 确认撤回的记录无法再次被确认');
console.log('6. 检查重复导入时是否正确检测并返回 DUPLICATE_RECORD');
console.log('═══════════════════════════════════════════════════════════════');

process.exit(failed > 0 ? 1 : 0);