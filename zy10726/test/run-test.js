const fs = require('fs');
const path = require('path');
const AppointmentReviewer = require('../src/reviewer');

const chalk = {
  green: (t) => `\x1b[32m${t}\x1b[0m`,
  red: (t) => `\x1b[31m${t}\x1b[0m`,
  blue: (t) => `\x1b[34m${t}\x1b[0m`,
  yellow: (t) => `\x1b[33m${t}\x1b[0m`
};

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(chalk.green(`✓ ${name}`));
    passed++;
  } catch (error) {
    console.log(chalk.red(`✗ ${name}`));
    console.log(chalk.red(`  Error: ${error.message}`));
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

async function runTests() {
  console.log(chalk.blue('\n========== 检查预约数据号源释放复盘 - 测试开始 ==========\n'));

  const reviewer = new AppointmentReviewer();
  const testDir = path.join(__dirname, 'test_data');
  const outputDir = path.join(__dirname, 'test_output');

  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }

  console.log(chalk.yellow('\n--- 初始化测试环境 ---'));
  await reviewer.initSample(testDir);

  await test('样例文件创建成功', () => {
    assert(fs.existsSync(path.join(testDir, 'sample_appointments.csv')), '样例数据文件不存在');
    assert(fs.existsSync(path.join(testDir, 'config.json')), '配置文件不存在');
  });

  console.log(chalk.yellow('\n--- 正常路径测试 ---'));

  let result;
  await test('第一次运行成功', async () => {
    result = await reviewer.run({
      inputPath: testDir,
      outputPath: outputDir,
      configPath: path.join(testDir, 'config.json'),
      noAppend: false,
      checkIntegrity: true
    });
  });

  await test('未释放号源检测正确', () => {
    assert(result.unreleasedCount === 3, `期望 3 条未释放号源，实际 ${result.unreleasedCount} 条`);
  });

  await test('误释放号源检测正确', () => {
    assert(result.falseReleasedCount === 1, `期望 1 条误释放号源，实际 ${result.falseReleasedCount} 条`);
  });

  await test('退费延迟检测正确', () => {
    assert(result.refundDelayCount === 2, `期望 2 条退费延迟，实际 ${result.refundDelayCount} 条`);
  });

  await test('手工改约检测正确', () => {
    assert(result.manualRescheduleCount === 1, `期望 1 条手工改约，实际 ${result.manualRescheduleCount} 条`);
  });

  await test('重复占号检测正确', () => {
    assert(result.duplicateCount === 2, `期望 2 条重复占号，实际 ${result.duplicateCount} 条`);
  });

  await test('结果文件包含原始文件名和行号', () => {
    const resultFile = path.join(outputDir, 'appointment_release_review_result.csv');
    const content = fs.readFileSync(resultFile, 'utf8');
    assert(content.includes('sample_appointments.csv'), '结果文件缺少原始文件名');
    assert(content.includes('2') || content.includes('3'), '结果文件缺少原始行号');
  });

  await test('结果文件包含检查预约专项字段', () => {
    const resultFile = path.join(outputDir, 'appointment_release_review_result.csv');
    const content = fs.readFileSync(resultFile, 'utf8');
    assert(content.includes('未释放号源'), '缺少未释放号源标识');
    assert(content.includes('误释放号源'), '缺少误释放号源标识');
    assert(content.includes('退费延迟'), '缺少退费延迟标识');
    assert(content.includes('手工改约'), '缺少手工改约标识');
    assert(content.includes('重复占号'), '缺少重复占号标识');
    assert(!content.includes('通用编号'), '不应该出现通用编号');
  });

  console.log(chalk.yellow('\n--- 异常路径测试 - 重复运行防追加 ---'));

  await test('第二次运行跳过已处理文件', async () => {
    const result2 = await reviewer.run({
      inputPath: testDir,
      outputPath: outputDir,
      configPath: path.join(testDir, 'config.json'),
      noAppend: false,
      checkIntegrity: true
    });
    assert(result2.processedFiles === 0, `第二次运行应该跳过所有文件，实际处理了 ${result2.processedFiles} 个`);
  });

  await test('重复运行后结果文件行数不变', () => {
    const resultFile = path.join(outputDir, 'appointment_release_review_result.csv');
    const lines = fs.readFileSync(resultFile, 'utf8').trim().split('\n').length;
    const expectedLines = 10;
    assert(lines === expectedLines, `期望 ${expectedLines} 行，实际 ${lines} 行，可能重复追加了`);
  });

  console.log(chalk.yellow('\n--- 异常路径测试 - 强制覆盖 ---'));

  await test('强制覆盖模式正常工作', async () => {
    const result3 = await reviewer.run({
      inputPath: testDir,
      outputPath: outputDir,
      configPath: path.join(testDir, 'config.json'),
      noAppend: true,
      checkIntegrity: true
    });
    assert(result3.processedFiles === 1, '强制覆盖应该重新处理文件');
  });

  console.log(chalk.yellow('\n--- 异常路径测试 - 文件完整性校验 ---'));

  await test('结果文件完整性验证通过', async () => {
    const resultFile = path.join(outputDir, 'appointment_release_review_result.csv');
    const isValid = await reviewer.verifyResultFile(resultFile);
    assert(isValid === true, '结果文件完整性验证应该通过');
  });

  await test('损坏文件完整性验证不通过', async () => {
    const resultFile = path.join(outputDir, 'appointment_release_review_result.csv');
    const originalContent = fs.readFileSync(resultFile, 'utf8');
    fs.writeFileSync(resultFile, originalContent + '\n损坏的内容', 'utf8');
    
    const isValid = await reviewer.verifyResultFile(resultFile);
    assert(isValid === false, '损坏文件完整性验证应该不通过');
    
    fs.writeFileSync(resultFile, originalContent, 'utf8');
  });

  console.log(chalk.yellow('\n--- 异常路径测试 - 空输入处理 ---'));

  await test('空输入目录抛出有意义错误', async () => {
    const emptyDir = path.join(__dirname, 'empty_dir');
    if (!fs.existsSync(emptyDir)) {
      fs.mkdirSync(emptyDir);
    }
    
    let errorThrown = false;
    try {
      await reviewer.run({
        inputPath: emptyDir,
        outputPath: outputDir,
        noAppend: true,
        checkIntegrity: true
      });
    } catch (error) {
      errorThrown = true;
      assert(error.message === '没有需要处理的有效文件', '错误信息不正确');
    }
    assert(errorThrown, '空输入应该抛出错误');
  });

  console.log(chalk.yellow('\n--- 异常路径测试 - 增量文件处理 ---'));

  await test('新增文件只处理新文件', async () => {
    const newData = `患者ID,预约ID,科室,医生,预约时间,释放状态,释放时间,退费时间,操作类型
P006,A006,眼科,赵医生,2024-01-18 09:00,未释放,,,系统预约`;
    fs.writeFileSync(path.join(testDir, 'new_appointments.csv'), newData, 'utf8');

    const result4 = await reviewer.run({
      inputPath: testDir,
      outputPath: outputDir,
      configPath: path.join(testDir, 'config.json'),
      noAppend: false,
      checkIntegrity: true
    });
    
    assert(result4.processedFiles === 1, `应该只处理 1 个新文件，实际处理了 ${result4.processedFiles} 个`);
    assert(result4.unreleasedCount === 1, '新文件中的未释放号源应该被检测到');
  });

  console.log(chalk.yellow('\n--- 测试总结 ---'));
  console.log(chalk.green(`通过: ${passed}`));
  console.log(chalk.red(`失败: ${failed}`));

  if (failed === 0) {
    console.log(chalk.green('\n✓ 所有测试通过！检查预约数据号源释放复盘功能正常工作。\n'));
    process.exit(0);
  } else {
    console.log(chalk.red('\n✗ 有测试失败，请检查代码。\n'));
    process.exit(1);
  }
}

runTests();
