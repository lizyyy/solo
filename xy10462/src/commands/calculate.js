const chalk = require('chalk');
const path = require('path');

const DataStore = require('../services/DataStore');
const ReportService = require('../services/ReportService');

module.exports = function(program) {
  program
    .command('calculate')
    .description('计算每台车的整备成本和毛利，并检查问题')
    .option('-d, --data-dir <dir>', '数据存储目录', 'data')
    .option('-i, --id <id>', '指定车辆 ID 进行计算')
    .option('-v, --vin <vin>', '指定 VIN 进行计算')
    .option('-p, --plate <plate>', '指定车牌号进行计算')
    .action(async (options) => {
      try {
        const dataDir = path.resolve(options.dataDir);
        const dataStore = new DataStore(dataDir);
        await dataStore.init();

        const reportService = new ReportService(dataStore);

        let vehicles = [];

        if (options.id) {
          const vehicle = dataStore.getVehicleById(options.id);
          if (!vehicle) {
            console.error(chalk.red(`✗ 未找到车辆 ID: ${options.id}`));
            process.exit(1);
          }
          vehicles = [vehicle];
        } else if (options.vin) {
          const vehicle = dataStore.getVehicleByVin(options.vin);
          if (!vehicle) {
            console.error(chalk.red(`✗ 未找到车辆 VIN: ${options.vin}`));
            process.exit(1);
          }
          vehicles = [vehicle];
        } else if (options.plate) {
          const vehicle = dataStore.getVehicleByPlate(options.plate);
          if (!vehicle) {
            console.error(chalk.red(`✗ 未找到车牌号: ${options.plate}`));
            process.exit(1);
          }
          vehicles = [vehicle];
        } else {
          vehicles = dataStore.getAllVehicles();
        }

        if (vehicles.length === 0) {
          console.log(chalk.yellow('⚠ 没有车辆数据。请先使用 import 命令导入数据。'));
          return;
        }

        console.log(chalk.bold.cyan('📊 成本和毛利计算结果'));
        console.log(chalk.gray('============================\n'));

        vehicles.forEach((vehicle, index) => {
          console.log(reportService.generateVehicleDetail(vehicle));

          if (index < vehicles.length - 1) {
            console.log('');
          }
        });

        console.log('\n' + chalk.gray('='.repeat(60)));
        console.log(chalk.bold('计算完成!'));
        console.log(`共处理 ${vehicles.length} 台车辆`);

      } catch (error) {
        console.error(chalk.red(`\n✗ 计算失败: ${error.message}`));
        console.error(chalk.gray(error.stack));
        process.exit(1);
      }
    });
};
