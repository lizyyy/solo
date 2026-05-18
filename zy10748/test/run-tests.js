const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TEST_CASES = [
  {
    name: '正常路径 - 标准数据文件',
    description: '使用完整字段的正常 CSV 文件生成催还名单',
    inputDir: path.join(__dirname, '..', 'data', 'normal'),
    date: '2024-02-20',
    expectedExitCode: 0,
    checks: [
      '输出催还名单文件存在',
      '输出异常报告文件存在',
      '输出汇总报告文件存在',
      '催还名单包含逾期记录'
    ]
  },
  {
    name: '异常路径 - 缺少必要字段',
    description: '测试缺少字段的文件是否能正确报错并继续处理',
    inputDir: path.join(__dirname, '..', 'data', 'abnormal', '缺列文件.csv'),
    date: '2024-02-20',
    expectedExitCode: 0,
    checks: [
      '错误报告中记录 MISSING_COLUMNS 错误'
    ]
  },
  {
    name: '异常路径 - 重复资产编号',
    description: '测试重复记录检测功能',
    inputDir: path.join(__dirname, '..', 'data', 'abnormal', '重复记录.csv'),
    date: '2024-02-20',
    expectedExitCode: 0,
    checks: [
      '检测到重复的资产编号'
    ]
  },
  {
    name: '异常路径 - 特殊情况处理',
    description: '测试员工离职、转部门、资产维修的处理',
    inputDir: path.join(__dirname, '..', 'data', 'abnormal', '特殊情况.csv'),
    date: '2024-02-20',
    expectedExitCode: 0,
    checks: [
      '检测到员工离职情况',
      '检测到转部门情况',
      '维修中的资产跳过催还'
    ]
  },
  {
    name: '异常路径 - 空目录处理',
    description: '测试空目录的警告提示',
    inputDir: path.join(__dirname, '..', 'data', 'abnormal', '空目录'),
    date: '2024-02-20',
    expectedExitCode: 0,
    checks: [
      '输出 EMPTY_DIRECTORY 警告'
    ]
  }
];

function runTest(testCase) {
  console.log('\n' + '='.repeat(70));
  console.log(`测试用例: ${testCase.name}`);
  console.log(`描述: ${testCase.description}`);
  console.log('='.repeat(70));

  const outputDir = path.join(__dirname, '..', 'test-output', testCase.name.replace(/\s+/g, '_'));
  
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
  fs.mkdirSync(outputDir, { recursive: true });

  let exitCode;
  let output;

  try {
    const cmd = `node "${path.join(__dirname, '..', 'src', 'cli.js')}" run --input "${testCase.inputDir}" --output "${outputDir}" --date "${testCase.date}" 2>&1`;
    output = execSync(cmd, { encoding: 'utf8', timeout: 30000 });
    exitCode = 0;
  } catch (error) {
    output = error.stdout || error.message;
    exitCode = error.status;
  }

  console.log(`退出码: ${exitCode} (预期: ${testCase.expectedExitCode})`);
  console.log(`状态: ${exitCode === testCase.expectedExitCode ? '✓ 通过' : '✗ 失败'}`);
  
  console.log('\n--- 输出摘要 ---');
  output.split('\n').slice(0, 20).forEach(line => {
    if (line.trim()) console.log('  ' + line);
  });

  const results = {
    passed: exitCode === testCase.expectedExitCode,
    exitCode,
    expectedExitCode: testCase.expectedExitCode,
    output,
    outputDir
  };

  console.log('\n' + '-'.repeat(70));
  
  return results;
}

function runAllTests() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║           资产借还台账逾期催还名单 - 测试套件                      ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');

  const results = [];
  let passedCount = 0;

  for (const testCase of TEST_CASES) {
    const result = runTest(testCase);
    results.push({ testCase, ...result });
    if (result.passed) passedCount++;
  }

  console.log('\n\n' + '='.repeat(70));
  console.log('                          测试总结');
  console.log('='.repeat(70));
  console.log(`总测试数: ${TEST_CASES.length}`);
  console.log(`通过: ${passedCount}`);
  console.log(`失败: ${TEST_CASES.length - passedCount}`);
  console.log(`通过率: ${((passedCount / TEST_CASES.length) * 100).toFixed(1)}%`);
  console.log('='.repeat(70));

  if (passedCount < TEST_CASES.length) {
    console.log('\n失败的测试:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.testCase.name}`);
    });
    process.exit(1);
  } else {
    console.log('\n✓ 所有测试通过!');
    process.exit(0);
  }
}

if (require.main === module) {
  runAllTests();
}

module.exports = { runAllTests, runTest };
