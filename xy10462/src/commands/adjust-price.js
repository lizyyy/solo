const chalk = require('chalk');
const path = require('path');
const readline = require('readline');

const DataStore = require('../services/DataStore');
const ReportService = require('../services/ReportService');

module.exports = function(program) {
  program
    .command('adjust-price')
    .description('人工调整车辆售价并保留调整说明')
    .option('-d, --data-dir <dir>', '数据存储目录', 'data')
    .option('-i, --vehicle-id <id>', '车辆 ID')
    .option('-v, --vin <vin>', '车辆 VIN')
    .option('-n, --new-price <price>', '新售价')
    .option('-r, --reason <reason>', '调整原因')
    .option('-u, --user <user>', '操作人', 'operator')
    .action(async (options) => {
      try {
        const dataDir = path.resolve(options.dataDir);
        const dataStore = new DataStore(dataDir);
        await dataStore.init();

        const reportService = new ReportService(dataStore);

        let vehicle = null;
        if (options.vehicleId) {
          vehicle = dataStore.getVehicleById(options.vehicleId);
        } else if (options.vin) {
          vehicle = dataStore.getVehicleByVin(options.vin);
        }

        if (!vehicle) {
          console.error(chalk.red('✗ 请使用 --vehicle-id 或 --vin 指定车辆'));
          process.exit(1);
        }

        const currentPrice = vehicle.getCurrentSellingPrice();
        const originalPrice = vehicle.getOriginalSellingPrice();
        const totalCost = vehicle.getTotalCost();

        let newPrice = options.newPrice;
        let reason = options.reason;

        if (!newPrice || !reason) {
          console.log(chalk.bold.cyan('💰 售价调整'));
          console.log(chalk.gray('================\n'));
          console.log(`车辆: ${vehicle.displayName}`);
          console.log(`VIN: ${vehicle.vin}`);
          console.log(`\n当前售价: ${reportService.formatPrice(currentPrice)}`);
          console.log(`原始售价: ${reportService.formatPrice(originalPrice)}`);
          console.log(`总成本: ${reportService.formatPrice(totalCost)}`);
          console.log(`当前毛利: ${reportService.formatProfit(currentPrice - totalCost)}`);
          console.log('');

          if (!newPrice) {
            newPrice = await askQuestion(`请输入新售价 (当前: ${reportService.formatPrice(currentPrice)}): `);
          }
          
          if (!reason) {
            reason = await askQuestion('请输入调整原因: ');
          }
        }

        const newPriceNum = Number(newPrice);
        if (isNaN(newPriceNum) || newPriceNum <= 0) {
          console.error(chalk.red('✗ 售价必须是有效的正数'));
          process.exit(1);
        }

        if (!reason || reason.trim() === '') {
          console.error(chalk.red('✗ 必须提供调整原因'));
          process.exit(1);
        }

        const oldProfit = currentPrice - totalCost;
        const newProfit = newPriceNum - totalCost;
        const profitChange = newProfit - oldProfit;
        const priceChange = newPriceNum - currentPrice;

        console.log('\n' + chalk.bold.yellow('调整预览:'));
        console.log(`  售价变化: ${reportService.formatPrice(currentPrice)} → ${reportService.formatPrice(newPriceNum)}`);
        console.log(`  价格差: ${priceChange >= 0 ? chalk.green('+' + reportService.formatPrice(priceChange)) : chalk.red(reportService.formatPrice(priceChange))}`);
        console.log(`  原毛利: ${reportService.formatProfit(oldProfit)}`);
        console.log(`  新毛利: ${reportService.formatProfit(newProfit)}`);
        console.log(`  毛利变化: ${profitChange >= 0 ? chalk.green('+' + reportService.formatPrice(profitChange)) : chalk.red(reportService.formatPrice(profitChange))}`);
        console.log(`  调整原因: ${reason}`);

        if (newPriceNum < totalCost) {
          console.log(chalk.red.bold('\n⚠ 警告: 新售价低于总成本!'));
        }

        const adjustment = dataStore.addPriceAdjustment(vehicle.id, {
          newPrice: newPriceNum,
          reason: reason,
          createdBy: options.user
        });

        await dataStore.save();

        console.log('\n' + chalk.green('✓ 售价调整成功!'));
        console.log(`\n调整记录已保存。`);
        console.log(reportService.generateVehicleDetail(vehicle));

      } catch (error) {
        console.error(chalk.red(`\n✗ 调整售价失败: ${error.message}`));
        console.error(chalk.gray(error.stack));
        process.exit(1);
      }
    });
};

function askQuestion(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}
