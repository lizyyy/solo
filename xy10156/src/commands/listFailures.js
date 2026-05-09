const chalk = require('chalk');
const ora = require('ora');
const DataStore = require('../dataStore');

async function listFailuresCommand(options) {
  const store = new DataStore();
  const spinner = ora('获取失败项列表...').start();

  try {
    const failures = store.loadFailures();

    if (failures.items.length === 0) {
      spinner.succeed('没有失败项记录');
      console.log(chalk.green('  所有操作均已成功完成'));
      return { items: [], stats: { total: 0 } };
    }

    let filteredItems = failures.items;

    if (options.type) {
      filteredItems = filteredItems.filter(f => f.type === options.type);
    }

    if (options.relatedId) {
      filteredItems = filteredItems.filter(f => f.relatedId === options.relatedId);
    }

    const limit = options.limit ? parseInt(options.limit) : filteredItems.length;
    const displayItems = filteredItems.slice(0, limit);

    spinner.succeed(`找到 ${filteredItems.length} 个失败项`);
    
    const typeStats = {};
    failures.items.forEach(f => {
      if (!typeStats[f.type]) {
        typeStats[f.type] = 0;
      }
      typeStats[f.type]++;
    });

    console.log(chalk.cyan('\n  失败项统计:'));
    console.log(chalk.cyan(`    ✓ 总计: ${failures.items.length}`));
    Object.entries(typeStats).forEach(([type, count]) => {
      console.log(chalk.cyan(`    - ${type}: ${count}`));
    });

    if (displayItems.length > 0) {
      console.log(chalk.yellow('\n  失败项详情:'));
      displayItems.forEach((failure, index) => {
        console.log(chalk.yellow(`\n  ${index + 1}. [${failure.type}] ${failure.relatedId}`));
        console.log(chalk.white(`     描述: ${failure.description}`));
        console.log(chalk.gray(`     时间: ${new Date(failure.timestamp).toLocaleString()}`));
        
        if (failure.details && Object.keys(failure.details).length > 0) {
          console.log(chalk.gray(`     详情: ${JSON.stringify(failure.details, null, 2).split('\n').map((line, i) => i === 0 ? line : '           ' + line).join('\n')}`));
        }
      });
    }

    if (filteredItems.length > limit) {
      console.log(chalk.yellow(`\n  ... 还有 ${filteredItems.length - limit} 个失败项，使用 --limit 参数查看更多`));
    }

    return {
      items: displayItems,
      stats: {
        total: failures.items.length,
        filtered: filteredItems.length,
        displayed: displayItems.length,
        byType: typeStats
      }
    };
  } catch (error) {
    spinner.fail('获取失败项过程出错');
    console.log(chalk.red(`  错误: ${error.message}`));
    console.log(chalk.red(`  堆栈: ${error.stack}`));
    process.exit(1);
  }
}

module.exports = listFailuresCommand;
