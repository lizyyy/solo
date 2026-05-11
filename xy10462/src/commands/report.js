const chalk = require('chalk');
const path = require('path');
const fs = require('fs-extra');

const DataStore = require('../services/DataStore');
const ReportService = require('../services/ReportService');

module.exports = function(program) {
  program
    .command('report')
    .description('生成报告 (单车明细、利润排序、待处理问题)')
    .option('-d, --data-dir <dir>', '数据存储目录', 'data')
    .option('-t, --type <type>', '报告类型: summary|detail|ranking|issues|all', 'all')
    .option('-o, --output <file>', '输出到文件')
    .option('-s, --sort <sort>', '排序方式: profit|margin', 'profit')
    .option('-a, --ascending', '升序排列 (默认降序)')
    .option('-i, --vehicle-id <id>', '车辆 ID (用于 detail 报告)')
    .option('-v, --vin <vin>', '车辆 VIN (用于 detail 报告)')
    .action(async (options) => {
      try {
        const dataDir = path.resolve(options.dataDir);
        const dataStore = new DataStore(dataDir);
        await dataStore.init();

        const reportService = new ReportService(dataStore);

        let output = '';

        switch (options.type) {
          case 'summary':
            output = reportService.generateSummary();
            break;

          case 'detail': {
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
            output = reportService.generateVehicleDetail(vehicle);
            break;
          }

          case 'ranking':
            output = reportService.generateProfitRanking(options.ascending);
            break;

          case 'issues':
            output = reportService.generateIssuesReport();
            break;

          case 'all':
          default:
            output = reportService.generateFullReport();
            break;
        }

        if (options.output) {
          const outputPath = path.resolve(options.output);
          await fs.ensureDir(path.dirname(outputPath));
          
          const plainOutput = stripAnsi(output);
          await fs.writeFile(outputPath, plainOutput, 'utf-8');
          
          console.log(chalk.green(`✓ 报告已保存到: ${outputPath}`));
        } else {
          console.log(output);
        }

      } catch (error) {
        console.error(chalk.red(`\n✗ 生成报告失败: ${error.message}`));
        console.error(chalk.gray(error.stack));
        process.exit(1);
      }
    });
};

function stripAnsi(str) {
  return str.replace(/\x1B[[(?);]{0,2}(;?\d)*./g, '');
}
