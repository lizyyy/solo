const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const DataStore = require('../dataStore');

async function mapTestCasesCommand(filePath, options) {
  const store = new DataStore();
  const spinner = ora('开始映射测试用例...').start();

  try {
    const requirements = store.loadRequirements();
    const requirementIds = new Set(requirements.items.map(req => req.id));

    if (requirements.items.length === 0) {
      spinner.fail('没有找到需求数据');
      console.log(chalk.yellow('  提示: 请先导入需求数据'));
      process.exit(1);
    }

    if (!fs.existsSync(filePath)) {
      spinner.fail('文件不存在');
      console.log(chalk.red(`  文件路径: ${filePath}`));
      process.exit(1);
    }

    spinner.text = '读取测试用例文件...';
    let rawData;
    try {
      rawData = fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      spinner.fail('读取文件失败');
      console.log(chalk.red(`  错误: ${error.message}`));
      store.addFailure('import_error', filePath, '读取测试用例文件失败', { error: error.message });
      process.exit(1);
    }

    spinner.text = '解析测试用例数据...';
    let testCases;
    try {
      testCases = JSON.parse(rawData);
    } catch (error) {
      spinner.fail('解析 JSON 失败');
      console.log(chalk.red(`  错误: ${error.message}`));
      store.addFailure('parse_error', filePath, '解析测试用例 JSON 失败', { error: error.message });
      process.exit(1);
    }

    let items = [];
    if (Array.isArray(testCases)) {
      items = testCases;
    } else if (testCases && Array.isArray(testCases.items)) {
      items = testCases.items;
    } else {
      spinner.fail('无效的测试用例数据格式');
      console.log(chalk.red('  测试用例数据应为数组或包含 items 数组的对象'));
      store.addFailure('format_error', filePath, '无效的测试用例数据格式');
      process.exit(1);
    }

    spinner.text = '验证测试用例数据...';
    const validation = store.validateTestCases(items);

    if (!validation.valid) {
      spinner.fail('测试用例数据验证失败');
      console.log(chalk.red('\n  错误列表:'));
      validation.errors.forEach(err => console.log(chalk.red(`    ✗ ${err}`)));
      store.addFailure('validation_error', filePath, '测试用例数据验证失败', { errors: validation.errors });
      process.exit(1);
    }

    if (validation.warnings.length > 0) {
      console.log(chalk.yellow('\n  警告列表:'));
      validation.warnings.forEach(warn => console.log(chalk.yellow(`    ⚠ ${warn}`)));
    }

    spinner.text = '验证需求关联...';
    const mappingIssues = [];
    items.forEach((testCase, index) => {
      if (testCase.requirements) {
        testCase.requirements.forEach(reqId => {
          if (!requirementIds.has(reqId)) {
            mappingIssues.push(`测试用例 ${testCase.id} 关联了不存在的需求: ${reqId}`);
          }
        });
      }
    });

    if (mappingIssues.length > 0) {
      console.log(chalk.yellow('\n  映射警告:'));
      mappingIssues.forEach(issue => console.log(chalk.yellow(`    ⚠ ${issue}`)));
    }

    spinner.text = '合并现有测试用例...';
    const existing = store.loadTestCases();
    const merged = store.mergeTestCases(existing, items, {
      overwrite: options.overwrite,
      skipDuplicates: options.skipDuplicates !== false
    });

    store.saveTestCases(merged);

    spinner.succeed('测试用例映射完成');
    console.log(chalk.green('\n  映射统计:'));
    console.log(chalk.green(`    ✓ 新增: ${merged.stats.added}`));
    console.log(chalk.green(`    ✓ 更新: ${merged.stats.updated}`));
    console.log(chalk.green(`    ✓ 重复: ${merged.stats.duplicates}`));
    console.log(chalk.green(`    ✓ 总计: ${merged.items.length}`));

    const coverageStats = calculateCoverageStats(merged.items, requirements.items);
    console.log(chalk.cyan('\n  需求覆盖统计:'));
    console.log(chalk.cyan(`    ✓ 已覆盖需求: ${coverageStats.covered}`));
    console.log(chalk.cyan(`    ✓ 未覆盖需求: ${coverageStats.uncovered}`));
    console.log(chalk.cyan(`    ✓ 覆盖率: ${coverageStats.rate}%`));

    if (options.verbose) {
      console.log(chalk.magenta('\n  测试用例列表:'));
      merged.items.forEach((tc, index) => {
        const reqCount = tc.requirements ? tc.requirements.length : 0;
        console.log(chalk.magenta(`    ${index + 1}. [${tc.id}] ${tc.title} (关联 ${reqCount} 个需求)`));
      });
    }

    return merged;
  } catch (error) {
    spinner.fail('映射过程出错');
    console.log(chalk.red(`  错误: ${error.message}`));
    console.log(chalk.red(`  堆栈: ${error.stack}`));
    store.addFailure('unexpected_error', filePath, '映射测试用例时发生未知错误', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

function calculateCoverageStats(testCases, requirements) {
  const coveredRequirements = new Set();
  testCases.forEach(tc => {
    if (tc.requirements) {
      tc.requirements.forEach(reqId => coveredRequirements.add(reqId));
    }
  });

  const total = requirements.length;
  const covered = coveredRequirements.size;
  const uncovered = total - covered;
  const rate = total > 0 ? ((covered / total) * 100).toFixed(2) : 0;

  return { total, covered, uncovered, rate };
}

module.exports = mapTestCasesCommand;
