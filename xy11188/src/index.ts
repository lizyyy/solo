#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';
import { FileParser } from './parsers/fileParser';
import { EstimationEngine } from './rules/estimationEngine';
import { ExceptionReporter } from './report/exceptionReporter';
import {
  volumeCalculationFormula,
  weightCalculationFormula,
  specialCaseRulesDescription,
  defaultEstimationConfig
} from './rules/defaultConfig';

const program = new Command();

program
  .name('moving-estimate')
  .description('搬家调度队 - 装车估算CLI工具')
  .version('1.0.0');

program
  .command('estimate')
  .description('执行装车估算')
  .argument('<files...>', '要处理的文件路径')
  .option('--no-elevator', '目标地点无电梯')
  .option('--floors <number>', '楼层数', '3')
  .option('--output-json <path>', '输出JSON报告路径')
  .option('--output-text <path>', '输出文本报告路径')
  .option('--show-rules', '显示默认估算规则')
  .action(async (files: string[], options) => {
    if (options.showRules) {
      console.log(chalk.bold.blue('\n默认估算规则:'));
      console.log(volumeCalculationFormula);
      console.log(weightCalculationFormula);
      console.log(specialCaseRulesDescription);
      console.log(chalk.bold('车辆配置:'));
      for (const truck of defaultEstimationConfig.truckTypes) {
        console.log(`  ${truck.name}: 最大体积=${truck.maxVolume}m³, 最大重量=${truck.maxWeight}kg, 基础费用=${truck.baseCost}元`);
      }
      console.log('');
      return;
    }

    const filePaths = files.map(file => {
      if (path.isAbsolute(file)) {
        return file;
      }
      return path.resolve(process.cwd(), file);
    });

    for (const filePath of filePaths) {
      if (!fs.existsSync(filePath)) {
        console.error(chalk.red(`错误: 文件不存在 - ${filePath}`));
        process.exit(1);
      }
    }

    console.log(chalk.bold.blue('\n搬家调度队 - 装车估算开始'));
    console.log(chalk.gray(`处理文件: ${files.join(', ')}`));
    console.log(chalk.gray(`无电梯模式: ${options.noElevator ? '开启' : '关闭'}`));
    if (options.noElevator) {
      console.log(chalk.gray(`楼层数: ${options.floors}`));
    }
    console.log('');

    const fileParser = new FileParser();
    const estimationEngine = new EstimationEngine();
    const exceptionReporter = new ExceptionReporter();

    try {
      const parseResults = await fileParser.parseFiles(filePaths);
      const estimationResults = parseResults.map(result => {
        const validItems = result.items.filter(item => item.data !== null);
        return estimationEngine.estimate(
          validItems,
          !options.noElevator,
          parseInt(options.floors, 10)
        );
      });

      for (let i = 0; i < estimationResults.length; i++) {
        const result = estimationResults[i];
        const fileName = parseResults[i].fileName;
        
        console.log(chalk.bold.green(`\n[${fileName}] 估算结果:`));
        console.log(`  总体积: ${result.totalVolume.toFixed(3)} m³`);
        console.log(`  总重量: ${result.totalWeight.toFixed(2)} kg`);
        console.log(`  调整后体积: ${result.adjustedVolume.toFixed(3)} m³`);
        console.log(`  调整后重量: ${result.adjustedWeight.toFixed(2)} kg`);
        
        console.log(chalk.bold('\n  推荐车辆:'));
        for (const rec of result.recommendedTrucks.slice(0, 3)) {
          console.log(`    ${rec.truckType.name} x ${rec.quantity}: ${rec.totalCost} 元`);
        }

        console.log(chalk.bold('\n  明细:'));
        for (const detail of result.estimationDetails) {
          const notes = detail.notes.length > 0 ? ` [${detail.notes.join(', ')}]` : '';
          console.log(`    [${detail.fileName}:${detail.lineNumber}] ${detail.itemName}: ` +
            `${detail.volume.toFixed(3)}m³ / ${detail.weight.toFixed(2)}kg` +
            `${notes}`);
        }
      }

      const report = exceptionReporter.generateReport(parseResults, estimationResults);
      exceptionReporter.printConsoleReport(report);

      if (options.outputJson) {
        const outputPath = path.isAbsolute(options.outputJson) 
          ? options.outputJson 
          : path.resolve(process.cwd(), options.outputJson);
        exceptionReporter.saveJsonReport(report, outputPath);
      }

      if (options.outputText) {
        const outputPath = path.isAbsolute(options.outputText) 
          ? options.outputText 
          : path.resolve(process.cwd(), options.outputText);
        exceptionReporter.saveTextReport(report, outputPath);
      }

    } catch (error) {
      console.error(chalk.red(`\n处理失败: ${(error as Error).message}`));
      process.exit(1);
    }
  });

program
  .command('sample')
  .description('使用样例数据演示')
  .option('--no-elevator', '模拟无电梯场景')
  .option('--output-json <path>', '输出JSON报告路径')
  .option('--output-text <path>', '输出文本报告路径')
  .action(async (options) => {
    const samplesDir = path.resolve(__dirname, '../samples');
    
    if (!fs.existsSync(samplesDir)) {
      console.error(chalk.red('错误: 样例目录不存在'));
      process.exit(1);
    }

    const sampleFiles = [
      'normal_furniture.csv',
      'large_non_disassemblable.csv',
      'with_errors.csv',
      'office_moving.csv'
    ].map(file => path.join(samplesDir, file));

    console.log(chalk.bold.blue('\n搬家调度队 - 装车估算演示'));
    console.log(chalk.gray('使用样例文件: ' + sampleFiles.map(f => path.basename(f)).join(', ')));
    console.log(chalk.gray(`无电梯模式: ${options.noElevator ? '开启' : '关闭'}`));
    console.log('');

    const fileParser = new FileParser();
    const estimationEngine = new EstimationEngine();
    const exceptionReporter = new ExceptionReporter();

    try {
      const parseResults = await fileParser.parseFiles(sampleFiles);
      const estimationResults = parseResults.map(result => {
        const validItems = result.items.filter(item => item.data !== null);
        return estimationEngine.estimate(validItems, !options.noElevator, 3);
      });

      for (let i = 0; i < estimationResults.length; i++) {
        const result = estimationResults[i];
        const fileName = parseResults[i].fileName;
        
        console.log(chalk.bold.green(`\n[${fileName}] 估算结果:`));
        console.log(`  总体积: ${result.totalVolume.toFixed(3)} m³`);
        console.log(`  总重量: ${result.totalWeight.toFixed(2)} kg`);
        console.log(`  调整后体积: ${result.adjustedVolume.toFixed(3)} m³`);
        console.log(`  调整后重量: ${result.adjustedWeight.toFixed(2)} kg`);
        
        console.log(chalk.bold('\n  推荐车辆:'));
        for (const rec of result.recommendedTrucks.slice(0, 2)) {
          console.log(`    ${rec.truckType.name} x ${rec.quantity}: ${rec.totalCost} 元`);
        }
      }

      const report = exceptionReporter.generateReport(parseResults, estimationResults);
      exceptionReporter.printConsoleReport(report);

      if (options.outputJson) {
        const outputPath = path.isAbsolute(options.outputJson) 
          ? options.outputJson 
          : path.resolve(process.cwd(), options.outputJson);
        exceptionReporter.saveJsonReport(report, outputPath);
      }

      if (options.outputText) {
        const outputPath = path.isAbsolute(options.outputText) 
          ? options.outputText 
          : path.resolve(process.cwd(), options.outputText);
        exceptionReporter.saveTextReport(report, outputPath);
      }

    } catch (error) {
      console.error(chalk.red(`\n处理失败: ${(error as Error).message}`));
      process.exit(1);
    }
  });

program
  .command('rules')
  .description('显示默认估算规则')
  .action(() => {
    console.log(chalk.bold.blue('\n搬家调度队 - 默认估算规则'));
    console.log('='.repeat(60));
    console.log(volumeCalculationFormula);
    console.log(weightCalculationFormula);
    console.log(specialCaseRulesDescription);
    console.log(chalk.bold('车辆配置:'));
    for (const truck of defaultEstimationConfig.truckTypes) {
      console.log(`  ${truck.name}:`);
      console.log(`    最大体积: ${truck.maxVolume} m³`);
      console.log(`    最大重量: ${truck.maxWeight} kg`);
      console.log(`    基础费用: ${truck.baseCost} 元`);
    }
    console.log('');
  });

program.parse();
