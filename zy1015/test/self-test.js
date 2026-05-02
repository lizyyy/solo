const path = require('path');
const { execSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');

console.log('🧪 SQLite 迁移体检工具 - 自检');
console.log('='.repeat(50));
console.log();

function runTest(name, command, expectedExitCode = 0) {
  console.log(`📋 测试: ${name}`);
  console.log(`   命令: ${command}`);
  
  try {
    const output = execSync(command, {
      cwd: projectRoot,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    console.log(`   状态: ✅ 通过 (退出码: 0)`);
    console.log();
    return { success: true, output };
  } catch (error) {
    const exitCode = error.status;
    if (exitCode === expectedExitCode) {
      console.log(`   状态: ✅ 通过 (退出码: ${exitCode} - 符合预期)`);
      console.log();
      return { success: true, output: error.stdout, error: error.stderr };
    } else {
      console.log(`   状态: ❌ 失败 (退出码: ${exitCode}, 预期: ${expectedExitCode})`);
      console.log(`   错误: ${error.stderr}`);
      console.log();
      return { success: false, output: error.stdout, error: error.stderr };
    }
  }
}

console.log('📍 阶段 1: 安装依赖');
console.log();

try {
  execSync('npm install', {
    cwd: projectRoot,
    stdio: 'inherit'
  });
  console.log('✅ 依赖安装成功');
} catch (e) {
  console.log('❌ 依赖安装失败');
  process.exit(1);
}
console.log();

console.log('📍 阶段 2: 运行测试');
console.log();

const results = [];

results.push(runTest(
  '通过示例 - 应该通过所有检查',
  'node src/cli.js --schema examples/pass/schema.sql --migrations examples/pass/migrations --output reports/self-test-pass',
  0
));

results.push(runTest(
  '危险示例 - 应该检测到危险操作并失败',
  'node src/cli.js --schema examples/danger/schema.sql --migrations examples/danger/migrations --output reports/self-test-danger',
  1
));

results.push(runTest(
  '失败示例 - 应该检测到执行错误并失败',
  'node src/cli.js --schema examples/fail/schema.sql --migrations examples/fail/migrations --output reports/self-test-fail',
  1
));

console.log('📍 阶段 3: 验证报告生成');
console.log();

const fs = require('fs');

const reportPaths = [
  'reports/self-test-pass/report.json',
  'reports/self-test-pass/report.md',
  'reports/self-test-danger/report.json',
  'reports/self-test-danger/report.md',
  'reports/self-test-fail/report.json',
  'reports/self-test-fail/report.md'
];

for (const reportPath of reportPaths) {
  const fullPath = path.join(projectRoot, reportPath);
  if (fs.existsSync(fullPath)) {
    console.log(`✅ 报告已生成: ${reportPath}`);
  } else {
    console.log(`❌ 报告缺失: ${reportPath}`);
    results.push({ success: false });
  }
}

console.log();
console.log('='.repeat(50));
console.log('📊 自检结果');
console.log('='.repeat(50));

const passed = results.filter(r => r.success).length;
const total = results.length;

console.log();
console.log(`通过: ${passed}/${total}`);

if (passed === total) {
  console.log();
  console.log('🎉 所有自检通过！');
  console.log();
  console.log('📌 下一步:');
  console.log('   1. 查看 reports/ 目录下的生成报告');
  console.log('   2. 使用 npm run test:pass/test:danger/test:fail 运行各场景');
  console.log('   3. 查看 README.md 了解详细用法');
  process.exit(0);
} else {
  console.log();
  console.log('❌ 部分测试失败，请检查输出');
  process.exit(1);
}
