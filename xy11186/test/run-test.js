const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('='.repeat(60));
console.log('酒类经销商酒水返利台账 CLI - 测试运行');
console.log('='.repeat(60));
console.log('');

function runCmd(cmd) {
  console.log(`执行: ${cmd}`);
  try {
    const output = execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' });
    console.log(output);
    return true;
  } catch (err) {
    console.error('错误:', err.stderr || err.message);
    return false;
  }
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function checkCsvStructure(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  if (lines.length < 2) return false;
  const firstLine = lines[0];
  const columns = firstLine.split(',');
  return columns.length >= 3;
}

let allPassed = true;

console.log('步骤 1: 检查项目结构...');
const requiredFiles = [
  'package.json',
  'src/index.js',
  'data/返利台账_202403_华北华东.csv',
  'data/返利台账_202403_华中华南.csv'
];

for (const file of requiredFiles) {
  if (fileExists(file)) {
    console.log(`  ✓ ${file}`);
  } else {
    console.log(`  ✗ ${file} - 缺失`);
    allPassed = false;
  }
}

console.log('');
console.log('步骤 2: 安装依赖...');
if (!fileExists('node_modules')) {
  runCmd('npm install');
} else {
  console.log('  ✓ 依赖已安装');
}

console.log('');
console.log('步骤 3: 运行 CLI 处理数据...');
const outputDir1 = './output_test1';
const outputDir2 = './output_test2';

if (fs.existsSync(outputDir1)) fs.rmSync(outputDir1, { recursive: true });
if (fs.existsSync(outputDir2)) fs.rmSync(outputDir2, { recursive: true });

runCmd(`node src/index.js process ./data -o ${outputDir1}`);

console.log('');
console.log('步骤 4: 验证输出文件...');
const expectedFiles = [
  `${outputDir1}/处理后_返利台账_202403_华北华东.csv`,
  `${outputDir1}/处理后_返利台账_202403_华中华南.csv`,
  `${outputDir1}/处理日志.csv`
];

for (const file of expectedFiles) {
  if (fileExists(file)) {
    console.log(`  ✓ ${path.basename(file)}`);
    if (checkCsvStructure(file)) {
      console.log(`    ✓ 文件格式正确`);
    } else {
      console.log(`    ✗ 文件格式异常`);
      allPassed = false;
    }
  } else {
    console.log(`  ✗ ${path.basename(file)} - 未生成`);
    allPassed = false;
  }
}

console.log('');
console.log('步骤 5: 验证稳定排序（两次运行结果一致）...');
runCmd(`node src/index.js process ./data -o ${outputDir2}`);

try {
  const file1 = fs.readFileSync(`${outputDir1}/处理后_返利台账_202403_华北华东.csv`, 'utf-8');
  const file2 = fs.readFileSync(`${outputDir2}/处理后_返利台账_202403_华北华东.csv`, 'utf-8');
  
  if (file1 === file2) {
    console.log('  ✓ 稳定排序验证通过 - 两次运行结果完全一致');
  } else {
    console.log('  ✗ 稳定排序验证失败 - 两次运行结果不一致');
    allPassed = false;
  }
} catch (err) {
  console.log('  ✗ 无法比较文件');
  allPassed = false;
}

console.log('');
console.log('步骤 6: 检查跨月退货标记...');
const content = fs.readFileSync(`${outputDir1}/处理后_返利台账_202403_华北华东.csv`, 'utf-8');
if (content.includes('跨月退货') && (content.includes('是') || content.includes('跨月退货: 原交易月份'))) {
  console.log('  ✓ 跨月退货功能正常');
} else {
  console.log('  ✗ 跨月退货功能可能异常');
  console.log('    内容预览:', content.substring(0, 500));
  allPassed = false;
}

console.log('');
console.log('步骤 7: 检查搭赠品标记...');
if (content.includes('搭赠品') && content.includes('含搭赠品:')) {
  console.log('  ✓ 搭赠品功能正常');
} else {
  console.log('  ✗ 搭赠品功能可能异常');
  allPassed = false;
}

console.log('');
console.log('='.repeat(60));
if (allPassed) {
  console.log('✅ 所有测试通过!');
  console.log('');
  console.log('你可以运行以下命令进行日常使用:');
  console.log('  npm start -- process ./data/*.csv');
  console.log('  npm start -- process ./data -o ./my-output');
  console.log('');
  console.log('输出文件位于: ./output_test1/');
} else {
  console.log('❌ 部分测试未通过，请检查上述错误信息');
}
console.log('='.repeat(60));

if (fs.existsSync(outputDir2)) fs.rmSync(outputDir2, { recursive: true });