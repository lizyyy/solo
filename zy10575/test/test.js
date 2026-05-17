const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function runTest(name, cmd, expectedExitCode) {
  console.log(`\n测试: ${name}`);
  console.log(`命令: ${cmd}`);
  console.log('-'.repeat(50));
  
  try {
    execSync(cmd, { stdio: 'inherit' });
    if (expectedExitCode !== 0) {
      console.log(`✗ 失败: 期望退出码 ${expectedExitCode}，但实际为 0`);
      return false;
    }
    console.log(`✓ 通过 (退出码 0)`);
    return true;
  } catch (error) {
    if (error.status === expectedExitCode) {
      console.log(`✓ 通过 (退出码 ${error.status})`);
      return true;
    }
    console.log(`✗ 失败: 期望退出码 ${expectedExitCode}，但实际为 ${error.status}`);
    return false;
  }
}

function checkFileExists(filePath) {
  const exists = fs.existsSync(filePath);
  console.log(`${filePath}: ${exists ? '✓ 存在' : '✗ 不存在'}`);
  return exists;
}

console.log('='.repeat(60));
console.log('CSV 主键重复检测 CLI 工具测试');
console.log('='.repeat(60));

let allPassed = true;

console.log('\n1. 测试帮助信息');
allPassed &= runTest('显示帮助', 'node src/cli.js --help', 0);

console.log('\n2. 测试干净数据 (无重复)');
allPassed &= runTest(
  '干净数据检测',
  'node src/cli.js test/data_clean.csv -k id',
  0
);

console.log('\n3. 测试脏数据 (有重复和空主键)');
allPassed &= runTest(
  '脏数据检测',
  'node src/cli.js test/data_dirty.csv -k id',
  1
);

console.log('\n4. 测试输出生成');
runTest(
  '生成所有输出文件',
  'node src/cli.js test/data_dirty.csv -k id -j test/result.json -r test/report.md -b test/bad_rows.csv',
  1
);

console.log('\n检查输出文件:');
allPassed &= checkFileExists('test/result.json');
allPassed &= checkFileExists('test/report.md');
allPassed &= checkFileExists('test/bad_rows.csv');

console.log('\n5. 检查 JSON 结果内容');
try {
  const jsonContent = JSON.parse(fs.readFileSync('test/result.json', 'utf8'));
  console.log(`  - 总行数: ${jsonContent.summary.totalRows}`);
  console.log(`  - 重复组数: ${jsonContent.summary.duplicateCount}`);
  console.log(`  - 空主键数: ${jsonContent.summary.nullKeyCount}`);
  console.log(`  - 有问题: ${jsonContent.summary.hasIssues}`);
  if (jsonContent.summary.duplicateCount === 2 && jsonContent.summary.nullKeyCount === 1) {
    console.log('  ✓ JSON 内容正确');
  } else {
    console.log('  ✗ JSON 内容不正确');
    allPassed = false;
  }
} catch (e) {
  console.log(`  ✗ JSON 解析失败: ${e.message}`);
  allPassed = false;
}

console.log('\n6. 检查坏行 CSV 内容');
try {
  const badRowsContent = fs.readFileSync('test/bad_rows.csv', 'utf8');
  const lines = badRowsContent.split('\n').filter(l => l.trim());
  console.log(`  - 坏行数量: ${lines.length - 1} (不含表头)`);
  if (lines.length > 1) {
    console.log('  ✓ 坏行 CSV 包含数据');
  } else {
    console.log('  ✗ 坏行 CSV 为空');
    allPassed = false;
  }
} catch (e) {
  console.log(`  ✗ 读取坏行 CSV 失败: ${e.message}`);
  allPassed = false;
}

console.log('\n7. 测试联合主键');
allPassed &= runTest(
  '联合主键检测',
  'node src/cli.js test/data_dirty.csv -k id,name',
  1
);

console.log('\n8. 测试参数组合 - 不区分大小写');
allPassed &= runTest(
  '不区分大小写检测',
  'node src/cli.js test/data_dirty.csv -k id --lower-case',
  1
);

console.log('\n9. 测试不存在的文件');
allPassed &= runTest(
  '不存在文件错误处理',
  'node src/cli.js test/nonexistent.csv -k id',
  2
);

console.log('\n10. 测试不存在的主键列');
allPassed &= runTest(
  '不存在列错误处理',
  'node src/cli.js test/data_clean.csv -k nonexistent',
  2
);

console.log('\n' + '='.repeat(60));
if (allPassed) {
  console.log('✓ 所有测试通过！');
} else {
  console.log('✗ 部分测试失败！');
}
console.log('='.repeat(60));

process.exit(allPassed ? 0 : 1);
