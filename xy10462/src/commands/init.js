const chalk = require('chalk');
const path = require('path');
const fs = require('fs-extra');

const DataStore = require('../services/DataStore');
const ImportService = require('../services/ImportService');

module.exports = function(program) {
  program
    .command('init-samples')
    .description('使用样例数据初始化数据目录')
    .option('-d, --data-dir <dir>', '数据存储目录', 'data')
    .option('-f, --force', '覆盖现有数据', false)
    .action(async (options) => {
      try {
        const dataDir = path.resolve(options.dataDir);
        const vehiclesFile = path.join(dataDir, 'vehicles.json');
        const sampleDataPath = path.join(__dirname, '..', '..', 'examples', 'sample-data.json');

        if (await fs.pathExists(vehiclesFile) && !options.force) {
          console.log(chalk.yellow('⚠  数据目录已存在数据。'));
          console.log(chalk.gray('使用 --force 选项覆盖现有数据。'));
          process.exit(0);
        }

        if (options.force) {
          await fs.remove(dataDir);
          console.log(chalk.gray('已清除现有数据...'));
        }

        const dataStore = new DataStore(dataDir);
        await dataStore.init();

        const importService = new ImportService(dataStore);
        const results = await importService.importFromJSON(sampleDataPath);

        console.log(chalk.green('✓ 样例数据初始化成功!\n'));

        console.log(chalk.bold('导入结果:\n'));
        console.log(`  车辆档案: ${chalk.green(results.vehicles.imported)} 台`);
        console.log(`  整备项目: ${chalk.green(results.preparationItems.imported)} 项`);
        console.log(`  费用记录: ${chalk.green(results.costs.imported)} 条`);

        if (results.costs.errors.length > 0) {
          console.log(`\n${chalk.yellow('⚠  无法归属的费用 (测试样例):')}`);
          results.costs.errors.forEach(error => {
            console.log(`  - ${error}`);
          });
        }

        console.log(`\n${chalk.bold('数据目录:')} ${dataDir}`);
        console.log(`\n${chalk.gray('样例数据包含:')}`);
        console.log(chalk.gray('  1. 丰田卡罗拉 - 正常整备案例'));
        console.log(chalk.gray('  2. 大众朗逸 - 费用超预算，售价低于成本'));
        console.log(chalk.gray('  3. 哈弗H6 - 重复整备项目'));
        console.log(chalk.gray('  4. 日产轩逸 - 整备未完成却待售'));
        console.log(chalk.gray('  5. 本田思域 - 整备中'));

        console.log(`\n${chalk.cyan('下一步操作:')}`);
        console.log(`  npm run ucp -- calculate          计算所有车辆成本和毛利`);
        console.log(`  npm run ucp -- report             生成完整报告`);
        console.log(`  npm run ucp -- report -t issues   查看问题报告`);
        console.log(`  npm run ucp -- report -t ranking  查看利润排序`);

      } catch (error) {
        console.error(chalk.red(`\n✗ 初始化失败: ${error.message}`));
        console.error(chalk.gray(error.stack));
        process.exit(1);
      }
    });
};
