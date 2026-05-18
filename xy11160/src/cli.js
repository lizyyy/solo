#!/usr/bin/env node

const { Command } = require('commander');
const { VegetableReconciler, EXIT_CODES } = require('./reconciler');
const path = require('path');

const program = new Command();

program
  .name('veg-reconcile')
  .description('蔬菜配送站蔬菜称重对账 CLI 工具')
  .version('1.0.0')
  .option('-c, --config <path>', '规则配置文件路径', 'config/default.json')
  .option('-i, --input <path>', '输入数据文件路径', 'data/sample-input.json')
  .option('-o, --output <path>', '输出结果文件路径', 'output/result.json')
  .option('-q, --quiet', '静默模式，不输出控制台信息')
  .option('--no-save', '不保存输出文件')
  .parse(process.argv);

const options = program.opts();

async function main() {
  try {
    const configPath = path.resolve(options.config);
    const inputPath = path.resolve(options.input);
    const outputPath = path.resolve(options.output);

    const reconciler = new VegetableReconciler(configPath);
    const inputData = reconciler.loadInputData(inputPath);
    const results = reconciler.reconcile(inputData);

    if (!options.quiet) {
      reconciler.printSummary(results);
    }

    if (options.save) {
      reconciler.saveOutput(results, outputPath);
      if (!options.quiet) {
        console.log(`结果已保存至: ${outputPath}`);
      }
    }

    if (results.overallStatus === 'FAIL') {
      process.exit(EXIT_CODES.RECONCILIATION_FAILED);
    }

    process.exit(EXIT_CODES.SUCCESS);

  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    console.error('退出码:', error.code || EXIT_CODES.ERROR_CALCULATION);
    process.exit(error.code || EXIT_CODES.ERROR_CALCULATION);
  }
}

process.on('uncaughtException', (error) => {
  console.error('\n❌ 未捕获的异常:', error.message);
  process.exit(EXIT_CODES.ERROR_CALCULATION);
});

process.on('unhandledRejection', (reason) => {
  console.error('\n❌ 未处理的拒绝:', reason);
  process.exit(EXIT_CODES.ERROR_CALCULATION);
});

main();
