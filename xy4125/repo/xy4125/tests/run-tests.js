import { runGeometryCalculatorTests } from './test-geometry-calculator.js';
import { runModelParserTests } from './test-model-parser.js';

console.log('========================================');
console.log('  口扫咬合预检台 - 单元测试');
console.log('========================================\n');

const allResults = [];

console.log('\n--- 运行几何计算模块测试 ---\n');
try {
  const result = runGeometryCalculatorTests();
  allResults.push({ name: '几何计算模块', ...result });
} catch (e) {
  console.error('几何计算模块测试异常:', e);
  allResults.push({ name: '几何计算模块', passed: 0, failed: -1, total: 0 });
}

console.log('\n--- 运行模型解析模块测试 ---\n');
try {
  const result = runModelParserTests();
  allResults.push({ name: '模型解析模块', ...result });
} catch (e) {
  console.error('模型解析模块测试异常:', e);
  allResults.push({ name: '模型解析模块', passed: 0, failed: -1, total: 0 });
}

console.log('\n========================================');
console.log('  测试汇总');
console.log('========================================\n');

let totalPassed = 0;
let totalFailed = 0;
let totalTests = 0;

allResults.forEach(result => {
  if (result.failed >= 0) {
    const status = result.failed === 0 ? '✅ 通过' : '❌ 失败';
    console.log(`${result.name}: ${status} (${result.passed}/${result.total})`);
    totalPassed += result.passed;
    totalFailed += result.failed;
    totalTests += result.total;
  } else {
    console.log(`${result.name}: ⚠️ 异常`);
  }
});

console.log('\n----------------------------------------');
console.log(`总计: ${totalPassed} 个通过, ${totalFailed} 个失败, ${totalTests} 个测试`);

if (totalFailed === 0 && totalTests > 0) {
  console.log('\n🎉 所有测试通过!');
  process.exit(0);
} else if (totalTests === 0) {
  console.log('\n⚠️ 没有运行任何测试');
  process.exit(1);
} else {
  console.log(`\n❌ 有 ${totalFailed} 个测试失败`);
  process.exit(1);
}
