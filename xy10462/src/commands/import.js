const chalk = require('chalk');
const path = require('path');

const DataStore = require('../services/DataStore');
const ImportService = require('../services/ImportService');

module.exports = function(program) {
  program
    .command('import <file>')
    .description('从文件导入车辆档案、整备项目和费用数据 (支持 JSON 和 CSV 格式)')
    .option('-d, --data-dir <dir>', '数据存储目录', 'data')
    .action(async (file, options) => {
      try {
        const dataDir = path.resolve(options.dataDir);
        const dataStore = new DataStore(dataDir);
        await dataStore.init();

        const importService = new ImportService(dataStore);
        const filePath = path.resolve(file);

        console.log(chalk.blue(`正在导入文件: ${filePath}`));
        console.log(chalk.gray(`数据目录: ${dataDir}\n`));

        const results = await importService.importFromFile(filePath);

        console.log(chalk.green('✓ 导入完成!\n'));

        console.log(chalk.bold('导入结果:\n'));
        
        console.log(`  车辆档案: `);
        console.log(`    成功导入: ${chalk.green(results.vehicles.imported)} 台`);
        if (results.vehicles.errors.length > 0) {
          console.log(`    失败: ${chalk.red(results.vehicles.errors.length)} 个`);
          results.vehicles.errors.forEach(error => {
            console.log(`      - ${error}`);
          });
        }

        console.log(`\n  整备项目: `);
        console.log(`    成功导入: ${chalk.green(results.preparationItems.imported)} 项`);
        if (results.preparationItems.errors.length > 0) {
          console.log(`    失败: ${chalk.red(results.preparationItems.errors.length)} 个`);
          results.preparationItems.errors.forEach(error => {
            console.log(`      - ${error}`);
          });
        }

        console.log(`\n  费用记录: `);
        console.log(`    成功导入: ${chalk.green(results.costs.imported)} 条`);
        if (results.costs.errors.length > 0) {
          console.log(`    失败: ${chalk.red(results.costs.errors.length)} 个`);
          results.costs.errors.forEach(error => {
            console.log(`      - ${error}`);
          });
        }

        const totalImported = results.vehicles.imported + results.preparationItems.imported + results.costs.imported;
        const totalErrors = results.vehicles.errors.length + results.preparationItems.errors.length + results.costs.errors.length;

        console.log(`\n${chalk.bold('总计:')} 成功导入 ${chalk.green(totalImported)} 条记录，${chalk.red(totalErrors)} 条失败`);

      } catch (error) {
        console.error(chalk.red(`\n✗ 导入失败: ${error.message}`));
        console.error(chalk.gray(error.stack));
        process.exit(1);
      }
    });
};
