const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const DataStore = require('../dataStore');

async function importRequirementsCommand(filePath, options) {
  const store = new DataStore();
  const spinner = ora('开始导入需求...').start();

  try {
    if (!fs.existsSync(filePath)) {
      spinner.fail('文件不存在');
      console.log(chalk.red(`  文件路径: ${filePath}`));
      process.exit(1);
    }

    spinner.text = '读取需求文件...';
    let rawData;
    try {
      rawData = fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      spinner.fail('读取文件失败');
      console.log(chalk.red(`  错误: ${error.message}`));
      store.addFailure('import_error', filePath, '读取需求文件失败', { error: error.message });
      process.exit(1);
    }

    spinner.text = '解析需求数据...';
    let requirements;
    try {
      requirements = JSON.parse(rawData);
    } catch (error) {
      spinner.fail('解析 JSON 失败');
      console.log(chalk.red(`  错误: ${error.message}`));
      store.addFailure('parse_error', filePath, '解析需求 JSON 失败', { error: error.message });
      process.exit(1);
    }

    let items = [];
    if (Array.isArray(requirements)) {
      items = requirements;
    } else if (requirements && Array.isArray(requirements.items)) {
      items = requirements.items;
    } else {
      spinner.fail('无效的需求数据格式');
      console.log(chalk.red('  需求数据应为数组或包含 items 数组的对象'));
      store.addFailure('format_error', filePath, '无效的需求数据格式');
      process.exit(1);
    }

    spinner.text = '验证需求数据...';
    const validation = store.validateRequirements(items);

    if (!validation.valid) {
      spinner.fail('需求数据验证失败');
      console.log(chalk.red('\n  错误列表:'));
      validation.errors.forEach(err => console.log(chalk.red(`    ✗ ${err}`)));
      store.addFailure('validation_error', filePath, '需求数据验证失败', { errors: validation.errors });
      process.exit(1);
    }

    if (validation.warnings.length > 0) {
      console.log(chalk.yellow('\n  警告列表:'));
      validation.warnings.forEach(warn => console.log(chalk.yellow(`    ⚠ ${warn}`)));
    }

    spinner.text = '合并现有需求...';
    const existing = store.loadRequirements();
    const merged = store.mergeRequirements(existing, items, {
      overwrite: options.overwrite,
      skipDuplicates: options.skipDuplicates !== false
    });

    store.saveRequirements(merged);

    spinner.succeed('需求导入完成');
    console.log(chalk.green('\n  导入统计:'));
    console.log(chalk.green(`    ✓ 新增: ${merged.stats.added}`));
    console.log(chalk.green(`    ✓ 更新: ${merged.stats.updated}`));
    console.log(chalk.green(`    ✓ 重复: ${merged.stats.duplicates}`));
    console.log(chalk.green(`    ✓ 总计: ${merged.items.length}`));

    if (options.verbose) {
      console.log(chalk.cyan('\n  需求列表:'));
      merged.items.forEach((req, index) => {
        console.log(chalk.cyan(`    ${index + 1}. [${req.id}] ${req.title}`));
      });
    }

    return merged;
  } catch (error) {
    spinner.fail('导入过程出错');
    console.log(chalk.red(`  错误: ${error.message}`));
    console.log(chalk.red(`  堆栈: ${error.stack}`));
    store.addFailure('unexpected_error', filePath, '导入需求时发生未知错误', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

module.exports = importRequirementsCommand;
