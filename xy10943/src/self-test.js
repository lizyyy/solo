const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const { scanDirectory, parseFilename } = require('./scanner');
const { detectMissingPhotos, detectDuplicates } = require('./detector');
const { exportResults, printSummary } = require('./exporter');

const TEST_DATA_DIR = path.join(__dirname, '..', 'test-data');

async function createTestData() {
  console.log(chalk.gray('创建测试数据目录...'));
  
  if (fs.existsSync(TEST_DATA_DIR)) {
    await fs.promises.rm(TEST_DATA_DIR, { recursive: true, force: true });
  }
  
  await fs.promises.mkdir(TEST_DATA_DIR, { recursive: true });
  
  const testFiles = [
    { name: 'CUST001-WO001-before.jpg', content: 'test image 1' },
    { name: 'CUST001-WO001-after.jpg', content: 'test image 2' },
    { name: 'CUST001-WO002-before.jpg', content: 'test image 3' },
    { name: 'CUST001-WO002-after.jpg', content: 'test image 4' },
    
    { name: 'CUST002-WO001-before.jpg', content: 'test image 5' },
    
    { name: 'CUST003-WO001-after.jpg', content: 'test image 6' },
    { name: 'CUST003-WO002-before.jpg', content: 'test image 7' },
    { name: 'CUST003-WO002-after.jpg', content: 'test image 8' },
    
    { name: 'CUST004-WO001-before-01.jpg', content: 'test image 9' },
    { name: 'CUST004-WO001-before-02.jpg', content: 'test image 9' },
    { name: 'CUST004-WO001-after.jpg', content: 'test image 10' },
    
    { name: '客户001-工单001-维修前.jpg', content: 'test image 11' },
    { name: '客户001-工单001-维修后.jpg', content: 'test image 12' },
    { name: '客户002-工单001-维修前.jpg', content: 'test image 13' },
    
    { name: 'C005-WO001-before.jpg', content: 'test image 14' },
    { name: 'C005-WO001-after.jpg', content: 'test image 15' },
    
    { name: 'WO006-CUST006-before.jpg', content: 'test image 16' },
    { name: 'WO006-CUST006-after.jpg', content: 'test image 17' },
    
    { name: 'CUST007-WO001-repair.jpg', content: 'test image 18' },
    
    { name: 'random-image.jpg', content: 'invalid test' },
    { name: 'no-customer-id.jpg', content: 'invalid test' },
    { name: 'WO999-no-type.jpg', content: 'invalid test' },
    { name: 'short.jpg', content: 'invalid' },
    { name: 'CUST001-WO001.png', content: 'png test' }
  ];
  
  for (const file of testFiles) {
    const filePath = path.join(TEST_DATA_DIR, file.name);
    await fs.promises.writeFile(filePath, file.content, 'utf8');
  }
  
  const subDir1 = path.join(TEST_DATA_DIR, 'subfolder1');
  await fs.promises.mkdir(subDir1, { recursive: true });
  await fs.promises.writeFile(
    path.join(subDir1, 'CUST008-WO001-before.jpg'),
    'subfolder test 1'
  );
  await fs.promises.writeFile(
    path.join(subDir1, 'CUST008-WO001-after.jpg'),
    'subfolder test 2'
  );
  
  console.log(chalk.green(`✓ 创建了 ${testFiles.length + 2} 个测试文件`));
  return TEST_DATA_DIR;
}

async function runFilenameParserTests() {
  console.log(chalk.bold('\n1. 文件名解析测试...'));
  
  const testCases = [
    {
      filename: 'CUST001-WO001-before.jpg',
      expected: { valid: true, customerId: 'CUST001', workOrderId: 'WO001', photoType: 'before' }
    },
    {
      filename: 'CUST001-WO001-after.jpg',
      expected: { valid: true, customerId: 'CUST001', workOrderId: 'WO001', photoType: 'after' }
    },
    {
      filename: '客户001-工单001-维修前.jpg',
      expected: { valid: true, customerId: '001', workOrderId: '001', photoType: 'before' }
    },
    {
      filename: '客户001-工单001-维修后.jpg',
      expected: { valid: true, customerId: '001', workOrderId: '001', photoType: 'after' }
    },
    {
      filename: 'C005-WO001-before.jpg',
      expected: { valid: true, customerId: '005', workOrderId: '001', photoType: 'before' }
    },
    {
      filename: 'WO006-CUST006-before.jpg',
      expected: { valid: true, customerId: 'CUST006', workOrderId: 'WO006', photoType: 'before' }
    },
    {
      filename: 'CUST004-WO001-before-01.jpg',
      expected: { valid: true, customerId: 'CUST004', workOrderId: 'WO001', photoType: 'before', index: 1 }
    },
    {
      filename: 'CUST007-WO001-repair.jpg',
      expected: { valid: true, customerId: 'CUST007', workOrderId: 'WO001', photoType: 'repair' }
    },
    {
      filename: 'random-image.jpg',
      expected: { valid: false }
    },
    {
      filename: 'short.jpg',
      expected: { valid: false }
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of testCases) {
    const result = parseFilename(test.filename);
    
    let success = true;
    if (test.expected.valid !== result.valid) {
      success = false;
    } else if (test.expected.valid) {
      if (test.expected.customerId && result.customerId !== test.expected.customerId) {
        success = false;
      }
      if (test.expected.workOrderId && result.workOrderId !== test.expected.workOrderId) {
        success = false;
      }
      if (test.expected.photoType && result.photoType !== test.expected.photoType) {
        success = false;
      }
      if (test.expected.index !== undefined && result.index !== test.expected.index) {
        success = false;
      }
    }
    
    if (success) {
      passed++;
      console.log(chalk.green(`  ✓ ${test.filename}`));
    } else {
      failed++;
      console.log(chalk.red(`  ✗ ${test.filename}`));
      console.log(chalk.gray(`    预期: ${JSON.stringify(test.expected)}`));
      console.log(chalk.gray(`    实际: ${JSON.stringify(result)}`));
    }
  }
  
  console.log(chalk.blue(`  结果: ${passed} 通过, ${failed} 失败`));
  
  if (failed > 0) {
    throw new Error(`文件名解析测试失败: ${failed} 个用例未通过`);
  }
}

async function runDirectoryScanTests() {
  console.log(chalk.bold('\n2. 目录扫描测试...'));
  
  const files = await scanDirectory(TEST_DATA_DIR);
  console.log(chalk.green(`  ✓ 扫描到 ${files.length} 个图像文件`));
  
  const hasJpg = files.some(f => f.extension === '.jpg');
  const hasPng = files.some(f => f.extension === '.png');
  
  if (!hasJpg || !hasPng) {
    throw new Error('未能正确识别图像文件类型');
  }
  console.log(chalk.green(`  ✓ 正确识别多种图像格式`));
  
  const inSubfolder = files.some(f => f.path.includes('subfolder1'));
  if (!inSubfolder) {
    throw new Error('未能递归扫描子目录');
  }
  console.log(chalk.green(`  ✓ 支持递归扫描子目录`));
  
  return files;
}

async function runMissingPhotoTests(files) {
  console.log(chalk.bold('\n3. 缺失照片检测测试...'));
  
  const parsedFiles = files.map(file => ({
    ...file,
    parsed: parseFilename(file.name, file.path)
  }));
  
  const validFiles = parsedFiles.filter(f => f.parsed.valid);
  console.log(chalk.gray(`  有效解析文件: ${validFiles.length} 个`));
  
  const result = detectMissingPhotos(validFiles, ['before', 'after']);
  
  console.log(chalk.green(`  ✓ 总工单数量: ${result.totalWorkOrders}`));
  console.log(chalk.green(`  ✓ 完整工单数量: ${result.completeWorkOrders}`));
  console.log(chalk.green(`  ✓ 缺失照片工单: ${result.incompleteWorkOrders}`));
  
  if (result.totalWorkOrders === 0) {
    throw new Error('未能正确识别工单');
  }
  
  if (result.incompleteWorkOrders === 0) {
    throw new Error('未能检测到缺失的照片');
  }
  
  const expectedMissing = result.missingItems.some(item => 
    item.customerId === 'CUST002' && item.missingTypes.includes('after')
  );
  
  if (!expectedMissing) {
    throw new Error('未能正确检测到 CUST002 缺失的 after 照片');
  }
  console.log(chalk.green(`  ✓ 正确检测到缺失的照片类型`));
}

async function runDuplicateDetectionTests(files) {
  console.log(chalk.bold('\n4. 重复文件检测测试...'));
  
  const parsedFiles = files.map(file => ({
    ...file,
    parsed: parseFilename(file.name, file.path)
  }));
  
  const validFiles = parsedFiles.filter(f => f.parsed.valid);
  
  const result = await detectDuplicates(validFiles);
  
  console.log(chalk.green(`  ✓ 重复文件总数: ${result.totalDuplicates}`));
  console.log(chalk.green(`  ✓ 检测方法: ${result.detectionMethod}`));
  console.log(chalk.green(`  ✓ 重复文件组数: ${result.duplicateGroups.length}`));
  
  const hasCust004Dup = result.duplicateGroups.some(g => g.customerId === 'CUST004');
  if (!hasCust004Dup) {
    throw new Error('未能检测到 CUST004 的重复文件');
  }
  console.log(chalk.green(`  ✓ 正确检测到重复文件组`));
}

async function runExportTests(files) {
  console.log(chalk.bold('\n5. 导出功能测试...'));
  
  const parsedFiles = files.map(file => ({
    ...file,
    parsed: parseFilename(file.name, file.path)
  }));
  
  const validFiles = parsedFiles.filter(f => f.parsed.valid);
  const invalidFiles = parsedFiles.filter(f => !f.parsed.valid);
  
  const missingResult = detectMissingPhotos(validFiles, ['before', 'after']);
  const duplicateResult = await detectDuplicates(validFiles);
  
  const outputDir = path.join(__dirname, '..', 'test-output');
  const result = await exportResults({
    validFiles,
    invalidFiles,
    missingPhotos: missingResult,
    duplicates: duplicateResult,
    photoTypes: ['before', 'after'],
    options: {}
  }, outputDir);
  
  if (!fs.existsSync(result.jsonPath)) {
    throw new Error('JSON 结果文件未生成');
  }
  console.log(chalk.green(`  ✓ JSON 结果文件已生成`));
  
  if (!fs.existsSync(result.reportPath)) {
    throw new Error('Markdown 报告文件未生成');
  }
  console.log(chalk.green(`  ✓ Markdown 报告文件已生成`));
  
  const jsonContent = JSON.parse(fs.readFileSync(result.jsonPath, 'utf8'));
  if (!jsonContent.validFiles || !jsonContent.missingPhotos) {
    throw new Error('JSON 结果内容不完整');
  }
  console.log(chalk.green(`  ✓ JSON 结果内容完整`));
}

async function runBoundaryTests() {
  console.log(chalk.bold('\n6. 边界情况测试...'));
  
  const result1 = parseFilename('');
  if (result1.valid) {
    throw new Error('空文件名不应解析成功');
  }
  console.log(chalk.green(`  ✓ 空文件名处理正确`));
  
  const result2 = parseFilename('a.jpg');
  if (result2.valid) {
    throw new Error('过短文件名不应解析成功');
  }
  console.log(chalk.green(`  ✓ 过短文件名处理正确`));
  
  const result3 = parseFilename('客户A-工单B-维修前.jpg');
  console.log(chalk.gray(`    中文混合格式: valid=${result3.valid}`));
  console.log(chalk.green(`  ✓ 中文格式处理正确`));
  
  const types = ['BEFORE', 'After', '维修前', '维修后', 'REPAIR'];
  for (const type of types) {
    const result = parseFilename(`CUST001-WO001-${type}.jpg`);
    if (!result.valid) {
      throw new Error(`类型 ${type} 未能正确解析`);
    }
  }
  console.log(chalk.green(`  ✓ 大小写和中文类型处理正确`));
}

async function runSelfTest(keepData = false) {
  console.log(chalk.blue('='.repeat(60)));
  console.log(chalk.blue.bold('         售后照片清点工具 - 自检程序'));
  console.log(chalk.blue('='.repeat(60)));
  
  try {
    const testDir = await createTestData();
    
    await runFilenameParserTests();
    const files = await runDirectoryScanTests();
    await runMissingPhotoTests(files);
    await runDuplicateDetectionTests(files);
    await runExportTests(files);
    await runBoundaryTests();
    
    console.log(chalk.bold.green('\n' + '='.repeat(60)));
    console.log(chalk.bold.green('                ✓ 所有自检通过！'));
    console.log(chalk.bold.green('='.repeat(60) + '\n'));
    
    if (!keepData) {
      await fs.promises.rm(TEST_DATA_DIR, { recursive: true, force: true });
      console.log(chalk.gray('测试数据已清理\n'));
    } else {
      console.log(chalk.gray(`测试数据保留在: ${TEST_DATA_DIR}\n`));
    }
    
    return true;
  } catch (error) {
    console.error(chalk.bold.red('\n' + '='.repeat(60)));
    console.error(chalk.bold.red(`                ✗ 自检失败！`));
    console.error(chalk.bold.red('='.repeat(60)));
    console.error(chalk.red(`\n错误: ${error.message}\n`));
    throw error;
  }
}

if (require.main === module) {
  const keepData = process.argv.includes('--keep') || process.argv.includes('-k');
  runSelfTest(keepData).catch(() => process.exit(1));
}

module.exports = {
  runSelfTest,
  createTestData,
  TEST_DATA_DIR
};
