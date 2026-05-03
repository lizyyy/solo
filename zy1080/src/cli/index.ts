#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import { InputParser, ParsedInputData } from '../input';
import { DataValidator } from '../validation';
import { Simulator } from '../simulation';
import { RiskAssessor } from '../risk';
import { ReportGenerator } from '../report';
import { SimulationResult, WateringPlan } from '../types';

const program = new Command();

program
  .name('garden-sim')
  .description('阳台种菜浇水预演工具 - 科学计算CLI')
  .version('1.0.0');

program
  .command('validate')
  .description('验证输入数据文件')
  .option('-p, --plants <path>', '植物数据文件路径', 'plants.csv')
  .option('-o, --pots <path>', '花盆数据文件路径', 'pots.json')
  .option('-w, --weather <path>', '天气数据文件路径', 'weather.csv')
  .option('-r, --watering-plan <path>', '浇水计划文件路径', 'watering-plan.json')
  .option('-d, --workdir <path>', '工作目录', process.cwd())
  .action(async (options) => {
    try {
      const workDir = path.resolve(options.workdir);
      console.log(`📂 工作目录: ${workDir}`);
      console.log('');

      const parser = new InputParser(workDir);
      
      console.log('📖 读取输入数据...');
      const data = parser.parseAll(
        options.plants,
        options.pots,
        options.weather,
        [options.wateringPlan]
      );

      console.log(`✅ 数据读取成功!');
      console.log(`   - 植物: ${data.plants.length} 种`);
      console.log(`   - 花盆: ${data.pots.length} 盆`);
      console.log(`   - 天气: ${data.weather.length} 天`);
      console.log(`   - 浇水计划: ${data.wateringPlans.length} 个`);
      console.log('');

      console.log('🔍 验证数据...');
      const validator = new DataValidator();
      const result = validator.validateAll(
        data.plants,
        data.pots,
        data.weather,
        data.wateringPlans
      );

      if (result.isValid) {
        console.log('✅ 数据验证通过!');
        if (result.warnings.length > 0) {
          console.log(`⚠️  有 ${result.warnings.length} 个警告:`);
          for (const warning of validator.formatWarnings(result.warnings)) {
            console.log(`   ${warning}`);
          }
        }
      } else {
          console.log('❌ 数据验证失败!');
          console.log(`   错误数量: ${result.errors.length}`);
          console.log('');
          for (const error of validator.formatErrors(result.errors)) {
            console.log(`   ${error}`);
          }
          process.exit(1);
        }

      console.log('');
      console.log('🎉 验证完成!');
    } catch (error) {
      console.error('❌ 验证过程中出错:');
      console.error(`   ${(error as Error).message}`);
      process.exit(1);
    }
  });

program
  .command('simulate')
  .description('运行浇水计划模拟')
  .option('-p, --plants <path>', '植物数据文件路径', 'plants.csv')
  .option('-o, --pots <path>', '花盆数据文件路径', 'pots.json')
  .option('-w, --weather <path>', '天气数据文件路径', 'weather.csv')
  .option('-r, --watering-plan <path>', '浇水计划文件路径', 'watering-plan.json')
  .option('-d, --workdir <path>', '工作目录', process.cwd())
  .option('-s, --start <date>', '模拟开始日期')
  .option('-e, --end <date>', '模拟结束日期')
  .option('--validate', '运行前验证数据', true)
  .action(async (options) => {
    try {
      const workDir = path.resolve(options.workdir);
      console.log(`📂 工作目录: ${workDir}`);
      console.log('');

      const parser = new InputParser(workDir);
      
      console.log('📖 读取输入数据...');
      const data = parser.parseAll(
        options.plants,
        options.pots,
        options.weather,
        [options.wateringPlan]
      );

      if (options.validate) {
        console.log('🔍 验证数据...');
        const validator = new DataValidator();
        const result = validator.validateAll(
          data.plants,
          data.pots,
          data.weather,
          data.wateringPlans
        );

        if (!result.isValid) {
          console.log('❌ 数据验证失败!');
          for (const error of validator.formatErrors(result.errors)) {
            console.log(`   ${error}`);
          }
          process.exit(1);
        }
        console.log('✅ 数据验证通过!');
      }
      console.log('');

      const wateringPlan = data.wateringPlans[0];
      if (!wateringPlan) {
        console.error('❌ 未找到浇水计划!');
        process.exit(1);
      }

      console.log(`🌱 开始模拟: ${wateringPlan.planName}`);
      console.log('');

      const simulator = new Simulator(data.plants, data.pots, data.weather);
      const rawResult = simulator.simulate(
        wateringPlan,
        options.start,
        options.end
      );

      console.log('⚠️  评估风险...');
      const riskAssessor = new RiskAssessor(data.pots, data.plants);
      const result = riskAssessor.updateSimulationResultWithRisks(rawResult);

      console.log('📊 生成报告...');
      console.log('');

      const reportGenerator = new ReportGenerator();
      const terminalReport = reportGenerator.generateTerminalSummary(result);
      console.log(terminalReport);

      console.log('');
      console.log('🎉 模拟完成!');
    } catch (error) {
      console.error('❌ 模拟过程中出错:');
      console.error(`   ${(error as Error).message}`);
      process.exit(1);
    }
  });

program
  .command('compare')
  .description('对比多个浇水计划')
  .option('-p, --plants <path>', '植物数据文件路径', 'plants.csv')
  .option('-o, --pots <path>', '花盆数据文件路径', 'pots.json')
  .option('-w, --weather <path>', '天气数据文件路径', 'weather.csv')
  .option('--plans <paths...>', '浇水计划文件路径列表')
  .option('-d, --workdir <path>', '工作目录', process.cwd())
  .option('-s, --start <date>', '模拟开始日期')
  .option('-e, --end <date>', '模拟结束日期')
  .action(async (options) => {
    try {
      const workDir = path.resolve(options.workdir);
      console.log(`📂 工作目录: ${workDir}`);
      console.log('');

      const planPaths = options.plans || [
        'watering-plan.json',
        'watering-plan-alternative.json'
      ];

      const parser = new InputParser(workDir);
      
      console.log('📖 读取输入数据...');
      
      const plants = parser.parsePlants(parser.readFile(options.plants));
      const pots = parser.parsePots(parser.readFile(options.pots));
      const weather = parser.parseWeather(parser.readFile(options.weather));

      const wateringPlans: WateringPlan[] = [];
      for (const planPath of planPaths) {
        if (parser.fileExists(planPath)) {
          const plan = parser.parseWateringPlan(parser.readFile(planPath));
          wateringPlans.push(plan);
          console.log(`   加载计划: ${plan.planName}`);
        }
      }

      if (wateringPlans.length < 2) {
        console.error('❌ 需要至少2个浇水计划进行对比!');
        console.error(`   找到的计划数量: ${wateringPlans.length}`);
        process.exit(1);
      }

      console.log('');
      console.log('🔍 运行所有计划模拟...');
      console.log('');

      const simulator = new Simulator(plants, pots, weather);
      const riskAssessor = new RiskAssessor(pots, plants);
      const results: SimulationResult[] = [];

      for (const plan of wateringPlans) {
        console.log(`⏳ 模拟: ${plan.planName}...`);
        const rawResult = simulator.simulate(plan, options.start, options.end);
        const result = riskAssessor.updateSimulationResultWithRisks(rawResult);
        results.push(result);
        console.log(`   风险数: ${result.risks.length}`);
      }

      console.log('');
      console.log('📊 生成对比报告...');
      console.log('');

      const reportGenerator = new ReportGenerator();
      const comparisonReport = reportGenerator.generateComparisonReport(results);
      console.log(comparisonReport);

      console.log('');
      console.log('🎉 对比完成!');
    } catch (error) {
      console.error('❌ 对比过程中出错:');
      console.error(`   ${(error as Error).message}`);
      process.exit(1);
    }
  });

program
  .command('export')
  .description('导出模拟结果为多种格式')
  .option('-p, --plants <path>', '植物数据文件路径', 'plants.csv')
  .option('-o, --pots <path>', '花盆数据文件路径', 'pots.json')
  .option('-w, --weather <path>', '天气数据文件路径', 'weather.csv')
  .option('-r, --watering-plan <path>', '浇水计划文件路径', 'watering-plan.json')
  .option('-d, --workdir <path>', '工作目录', process.cwd())
  .option('-s, --start <date>', '模拟开始日期')
  .option('-e, --end <date>', '模拟结束日期')
  .option('-f, --format <format>', '导出格式: all, terminal, markdown, html, json', 'all')
  .option('-o, --output <path>', '输出目录', './output')
  .action(async (options) => {
    try {
      const workDir = path.resolve(options.workdir);
      const outputDir = path.resolve(options.output);
      
      console.log(`📂 工作目录: ${workDir}`);
      console.log(`📁 输出目录: ${outputDir}`);
      console.log('');

      const parser = new InputParser(workDir);
      
      console.log('📖 读取输入数据...');
      const data = parser.parseAll(
        options.plants,
        options.pots,
        options.weather,
        [options.wateringPlan]
      );

      const wateringPlan = data.wateringPlans[0];
      if (!wateringPlan) {
        console.error('❌ 未找到浇水计划!');
        process.exit(1);
      }

      console.log(`🌱 开始模拟: ${wateringPlan.planName}`);
      console.log('');

      const simulator = new Simulator(data.plants, data.pots, data.weather);
      const rawResult = simulator.simulate(
        wateringPlan,
        options.start,
        options.end
      );

      const riskAssessor = new RiskAssessor(data.pots, data.plants);
      const result = riskAssessor.updateSimulationResultWithRisks(rawResult);

      const reportGenerator = new ReportGenerator();
      const formats = options.format === 'all' 
        ? ['terminal', 'markdown', 'html', 'json']
        : [options.format];

      console.log('📤 导出报告...');
      console.log('');

      for (const format of formats) {
        switch (format) {
          case 'terminal':
            console.log('📋 终端摘要:');
            console.log(reportGenerator.generateTerminalSummary(result));
            break;

          case 'markdown':
            const mdContent = reportGenerator.generateMarkdownReport(result);
            const mdPath = path.join(outputDir, 'report.md');
            reportGenerator.writeToFile(mdContent, mdPath);
            console.log(`✅ Markdown报告已保存: ${mdPath}`);
            break;

          case 'html':
            const htmlContent = reportGenerator.generateHTMLReport(result);
            const htmlPath = path.join(outputDir, 'report.html');
            reportGenerator.writeToFile(htmlContent, htmlPath);
            console.log(`✅ HTML报告已保存: ${htmlPath}`);
            break;

          case 'json':
            const jsonContent = reportGenerator.generateJSONReport(result);
            const jsonPath = path.join(outputDir, 'report.json');
            reportGenerator.writeToFile(jsonContent, jsonPath);
            console.log(`✅ JSON报告已保存: ${jsonPath}`);
            break;
        }
      }

      console.log('');
      console.log('🎉 导出完成!');
    } catch (error) {
      console.error('❌ 导出过程中出错:');
      console.error(`   ${(error as Error).message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
