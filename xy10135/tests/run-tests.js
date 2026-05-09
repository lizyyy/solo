console.log('================================');
console.log('   消防值班派遣游戏 - 测试套件');
console.log('================================\n');

const tests = [
  './gameEngine.test.js'
];

let totalPassed = 0;
let totalFailed = 0;

for (const testFile of tests) {
  try {
    const testModule = require(testFile);
    if (testModule.runner) {
      const result = testModule.runner.run();
      totalPassed += testModule.runner.passed;
      totalFailed += testModule.runner.failed;
    }
  } catch (err) {
    console.log(`\n❌ 测试文件执行失败: ${testFile}`);
    console.log(`   错误: ${err.message}\n`);
    totalFailed++;
  }
}

console.log('\n================================');
console.log('   总体测试结果');
console.log('================================');
console.log(`通过: ${totalPassed}`);
console.log(`失败: ${totalFailed}`);
console.log(`总计: ${totalPassed + totalFailed}\n`);

process.exit(totalFailed === 0 ? 0 : 1);
