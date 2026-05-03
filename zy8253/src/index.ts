#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import { readAllDataFiles, getDefaultFilePaths, FilePaths } from './readers';
import { validateData } from './validators';
import { analyzeData } from './analyzers';
import { exportAllResults } from './exporters';

const program = new Command();

program
  .name('thermal-review')
  .description('换电柜热失控早期复盘工具')
  .version('1.0.0');

program
  .command('validate')
  .description('验证输入数据的有效性')
  .option('-d, --data-dir <dir>', '数据文件目录', process.cwd())
  .option('--cabinets <path>', 'cabinets.yaml 文件路径')
  .option('--temperature <path>', 'slot_temperature.csv 文件路径')
  .option('--swaps <path>', 'swap_events.jsonl 文件路径')
  .option('--batteries <path>', 'battery_registry.csv 文件路径')
  .option('--rules <path>', 'rules.yaml 文件路径')
  .action(async (options) => {
    try {
      let filePaths: FilePaths;
      
      if (options.cabinets || options.temperature || options.swaps || options.batteries || options.rules) {
        const baseDir = options.dataDir;
        filePaths = {
          cabinetsYaml: options.cabinets || path.join(baseDir, 'cabinets.yaml'),
          slotTemperatureCsv: options.temperature || path.join(baseDir, 'slot_temperature.csv'),
          swapEventsJsonl: options.swaps || path.join(baseDir, 'swap_events.jsonl'),
          batteryRegistryCsv: options.batteries || path.join(baseDir, 'battery_registry.csv'),
          rulesYaml: options.rules || path.join(baseDir, 'rules.yaml'),
        };
      } else {
        filePaths = getDefaultFilePaths(options.dataDir);
      }

      console.log('正在读取数据文件...');
      const data = await readAllDataFiles(filePaths);
      
      console.log('正在验证数据...');
      const result = validateData(data);
      
      console.log('\n=== 数据验证结果 ===\n');
      console.log(`状态: ${result.isValid ? '✅ 通过' : '❌ 存在错误'}`);
      console.log(`错误数: ${result.errors.length}`);
      console.log(`警告数: ${result.warnings.length}`);
      
      console.log('\n=== 数据统计 ===\n');
      console.log(`换电柜数量: ${result.stats.totalCabinets}`);
      console.log(`温度记录数: ${result.stats.totalTemperatureRecords}`);
      console.log(`换电事件数: ${result.stats.totalSwapEvents}`);
      console.log(`电池注册数: ${result.stats.totalBatteries}`);
      console.log(`告警规则数: ${result.stats.totalRules}`);
      
      if (result.errors.length > 0) {
        console.log('\n=== 验证错误 ===\n');
        result.errors.forEach((error, index) => {
          console.log(`${index + 1}. [${error.field}] ${error.message}`);
          if (error.rowNumber) console.log(`   行号: ${error.rowNumber}`);
          if (error.value !== undefined) console.log(`   值: ${error.value}`);
        });
      }
      
      if (result.warnings.length > 0) {
        console.log('\n=== 验证警告 ===\n');
        result.warnings.forEach((warning, index) => {
          console.log(`${index + 1}. [${warning.field}] ${warning.message}`);
          if (warning.rowNumber) console.log(`   行号: ${warning.rowNumber}`);
          if (warning.value !== undefined) console.log(`   值: ${warning.value}`);
        });
      }
      
      process.exit(result.isValid ? 0 : 1);
    } catch (error) {
      console.error('验证失败:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('analyze')
  .description('分析数据，检测热失控风险')
  .option('-d, --data-dir <dir>', '数据文件目录', process.cwd())
  .option('--cabinets <path>', 'cabinets.yaml 文件路径')
  .option('--temperature <path>', 'slot_temperature.csv 文件路径')
  .option('--swaps <path>', 'swap_events.jsonl 文件路径')
  .option('--batteries <path>', 'battery_registry.csv 文件路径')
  .option('--rules <path>', 'rules.yaml 文件路径')
  .action(async (options) => {
    try {
      let filePaths: FilePaths;
      
      if (options.cabinets || options.temperature || options.swaps || options.batteries || options.rules) {
        const baseDir = options.dataDir;
        filePaths = {
          cabinetsYaml: options.cabinets || path.join(baseDir, 'cabinets.yaml'),
          slotTemperatureCsv: options.temperature || path.join(baseDir, 'slot_temperature.csv'),
          swapEventsJsonl: options.swaps || path.join(baseDir, 'swap_events.jsonl'),
          batteryRegistryCsv: options.batteries || path.join(baseDir, 'battery_registry.csv'),
          rulesYaml: options.rules || path.join(baseDir, 'rules.yaml'),
        };
      } else {
        filePaths = getDefaultFilePaths(options.dataDir);
      }

      console.log('正在读取数据文件...');
      const data = await readAllDataFiles(filePaths);
      
      console.log('正在验证数据...');
      const validationResult = validateData(data);
      
      if (!validationResult.isValid) {
        console.error('数据验证失败，无法进行分析。请先运行 validate 命令检查数据。');
        process.exit(1);
      }
      
      console.log('正在分析数据...');
      const analysisResult = analyzeData(data);
      
      console.log('\n=== 分析结果 ===\n');
      console.log(`总会话数: ${analysisResult.summary.totalSessions}`);
      console.log(`总风险项: ${analysisResult.summary.totalRisks}`);
      console.log(`已关闭告警: ${analysisResult.summary.alertsClosed}`);
      console.log(`进行中告警: ${analysisResult.summary.alertsOpen}`);
      
      if (Object.keys(analysisResult.summary.risksByType).length > 0) {
        console.log('\n=== 风险类型分布 ===\n');
        for (const [type, count] of Object.entries(analysisResult.summary.risksByType)) {
          console.log(`  ${type}: ${count}`);
        }
      }
      
      if (Object.keys(analysisResult.summary.risksBySeverity).length > 0) {
        console.log('\n=== 风险严重程度分布 ===\n');
        for (const [severity, count] of Object.entries(analysisResult.summary.risksBySeverity)) {
          console.log(`  ${severity}: ${count}`);
        }
      }
      
      if (analysisResult.riskItems.length > 0) {
        console.log('\n=== 风险项详情 ===\n');
        analysisResult.riskItems.forEach((risk, index) => {
          console.log(`${index + 1}. [${risk.severity.toUpperCase()}] ${risk.riskType}`);
          console.log(`   电池: ${risk.batteryId}`);
          console.log(`   位置: ${risk.cabinetId}-${risk.slotId}`);
          console.log(`   描述: ${risk.description}`);
          console.log();
        });
      } else {
        console.log('\n✅ 未检测到任何风险项\n');
      }
      
    } catch (error) {
      console.error('分析失败:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('export')
  .description('导出分析结果到文件')
  .option('-d, --data-dir <dir>', '数据文件目录', process.cwd())
  .option('-o, --output-dir <dir>', '输出目录', process.cwd())
  .option('--cabinets <path>', 'cabinets.yaml 文件路径')
  .option('--temperature <path>', 'slot_temperature.csv 文件路径')
  .option('--swaps <path>', 'swap_events.jsonl 文件路径')
  .option('--batteries <path>', 'battery_registry.csv 文件路径')
  .option('--rules <path>', 'rules.yaml 文件路径')
  .action(async (options) => {
    try {
      let filePaths: FilePaths;
      
      if (options.cabinets || options.temperature || options.swaps || options.batteries || options.rules) {
        const baseDir = options.dataDir;
        filePaths = {
          cabinetsYaml: options.cabinets || path.join(baseDir, 'cabinets.yaml'),
          slotTemperatureCsv: options.temperature || path.join(baseDir, 'slot_temperature.csv'),
          swapEventsJsonl: options.swaps || path.join(baseDir, 'swap_events.jsonl'),
          batteryRegistryCsv: options.batteries || path.join(baseDir, 'battery_registry.csv'),
          rulesYaml: options.rules || path.join(baseDir, 'rules.yaml'),
        };
      } else {
        filePaths = getDefaultFilePaths(options.dataDir);
      }

      console.log('正在读取数据文件...');
      const data = await readAllDataFiles(filePaths);
      
      console.log('正在验证数据...');
      const validationResult = validateData(data);
      
      console.log('正在分析数据...');
      const analysisResult = analyzeData(data);
      
      console.log('正在导出结果...');
      const { riskItemsPath, thermalReviewPath } = exportAllResults(
        analysisResult,
        validationResult,
        options.outputDir
      );
      
      console.log('\n✅ 导出完成!\n');
      console.log(`风险项 CSV: ${riskItemsPath}`);
      console.log(`复盘报告 Markdown: ${thermalReviewPath}`);
      
    } catch (error) {
      console.error('导出失败:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse(process.argv);
