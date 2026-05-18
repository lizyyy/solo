#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');
const RoastingCurveCompare = require('../src/index.js');

const program = new Command();

program
  .name('roast-compare')
  .description('咖啡豆烘焙厂烘焙曲线比对CLI工具')
  .version('1.0.0')
  .option('-i, --input <dir>', '输入目录路径，包含烘焙曲线CSV文件')
  .option('-o, --output <dir>', '输出目录路径，存放比对结果和异常报告')
  .option('-t, --template <file>', '标准模板曲线文件路径（可选）')
  .option('-s, --sensor-gap <seconds>', '传感器断点检测阈值（秒），默认30', parseInt)
  .option('-b, --batch-threshold <percent>', '拼批检测温度偏差阈值（%），默认5', parseFloat)
  .action(async (options) => {
    try {
      const inputDir = options.input || path.join(process.cwd(), 'samples', 'input');
      const outputDir = options.output || path.join(process.cwd(), 'samples', 'output');
      const templateFile = options.template;
      const sensorGapThreshold = options.sensorGap || 30;
      const batchThreshold = options.batchThreshold || 5;

      console.log(chalk.blue('咖啡豆烘焙曲线比对工具启动...'));
      console.log(chalk.gray(`输入目录: ${inputDir}`));
      console.log(chalk.gray(`输出目录: ${outputDir}`));
      console.log(chalk.gray(`传感器断点阈值: ${sensorGapThreshold}秒`));
      console.log(chalk.gray(`拼批偏差阈值: ${batchThreshold}%`));
      console.log();

      if (!fs.existsSync(inputDir)) {
        console.error(chalk.red(`错误: 输入目录不存在: ${inputDir}`));
        process.exit(1);
      }

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const comparator = new RoastingCurveCompare({
        inputDir,
        outputDir,
        templateFile,
        sensorGapThreshold,
        batchThreshold
      });

      const result = await comparator.run();
      
      console.log();
      console.log(chalk.green('处理完成!'));
      console.log(chalk.cyan(`处理文件数: ${result.totalFiles}`));
      console.log(chalk.yellow(`发现异常: ${result.totalAnomalies}`));
      console.log();
      console.log(chalk.gray(`结果已输出到: ${outputDir}`));
      
    } catch (error) {
      console.error(chalk.red('处理失败:'));
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

program.parse();
