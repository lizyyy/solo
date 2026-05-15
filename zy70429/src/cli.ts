#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { CacheAnalyzer, generateSummary } from './cache-analyzer';
import { generateTrainingEnvironmentData, generateBatchReservations } from './data-generator';
import * as fs from 'fs';
import * as path from 'path';

const program = new Command();
const analyzer = new CacheAnalyzer();

const DEFAULT_DATA_FILE = path.resolve(process.cwd(), 'data', 'bus-reservations.json');

function ensureDataDir() {
  const dataDir = path.dirname(DEFAULT_DATA_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function saveData(reservations: any[], filePath: string = DEFAULT_DATA_FILE) {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(reservations, null, 2));
  return filePath;
}

function loadData(filePath: string = DEFAULT_DATA_FILE): any[] | null {
  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return data;
  }
  return null;
}

program
  .name('cache-analyzer')
  .description('缓存命中分析命令行工具')
  .version('1.0.0');

program
  .command('generate')
  .description('生成班车预约测试数据')
  .option('-c, --count <number>', '生成数量', '20')
  .option('-o, --output <file>', `输出文件 (默认: ${DEFAULT_DATA_FILE})`)
  .option('--with-conflict', '包含并发冲突场景', true)
  .action((options) => {
    console.log(chalk.blue('=== 生成班车预约测试数据 ==='));
    
    let data;
    if (options.withConflict) {
      data = generateTrainingEnvironmentData();
      console.log(chalk.green(`✓ 生成 ${data.normalReservations.length} 条正常预约记录`));
      console.log(chalk.yellow(`✓ 包含 1 个并发冲突场景 (RES-CONFLICT-001)`));
    } else {
      const reservations = generateBatchReservations(parseInt(options.count));
      data = { allReservations: reservations, normalReservations: reservations, conflictScenario: null };
      console.log(chalk.green(`✓ 生成 ${reservations.length} 条预约记录`));
    }

    analyzer.loadReservations(data.allReservations);
    console.log(chalk.green('✓ 数据已加载到缓存分析器'));

    const outputPath = options.output ? path.resolve(options.output) : DEFAULT_DATA_FILE;
    saveData(data.allReservations, outputPath);
    console.log(chalk.green(`✓ 数据已保存到: ${outputPath}`));
    console.log('');
  });

program
  .command('analyze')
  .description('执行缓存命中分析')
  .option('-i, --input <file>', `从JSON文件加载数据 (默认: ${DEFAULT_DATA_FILE})`)
  .option('--show-raw', '显示原始数据')
  .action((options) => {
    console.log(chalk.blue('=== 执行缓存命中分析 ==='));

    const inputPath = options.input ? path.resolve(options.input) : DEFAULT_DATA_FILE;
    const data = loadData(inputPath);
    
    if (data) {
      analyzer.loadReservations(data);
      console.log(chalk.green(`✓ 从文件加载数据: ${inputPath}`));
    } else {
      console.log(chalk.yellow(`⚠ 未找到数据文件: ${inputPath}`));
      console.log(chalk.yellow('  将使用内存中的空缓存进行分析'));
      console.log(chalk.yellow('  提示: 请先运行 `generate` 命令生成测试数据'));
    }

    const result = analyzer.analyze();
    
    const statsTable = new Table({
      head: ['指标', '数值'],
      colWidths: [20, 30],
    });

    statsTable.push(
      ['总操作数', result.stats.totalOperations],
      ['命中数', result.stats.hits],
      ['未命中数', result.stats.misses],
      ['命中率', (result.stats.hitRate * 100).toFixed(2) + '%'],
      ['并发冲突数', result.stats.concurrentConflicts],
      ['被覆盖KEY数', result.stats.overwrittenKeys.length],
    );

    console.log('\n' + statsTable.toString());

    if (result.anomalies.length > 0) {
      console.log('\n' + chalk.yellow('=== 检测到异常 ==='));
      
      for (const anomaly of result.anomalies) {
        console.log('\n' + chalk.red(`异常类型: ${anomaly.type}`));
        console.log(`预约ID: ${anomaly.reservationId}`);
        console.log(`描述: ${anomaly.description}`);
        
        if (anomaly.beforeValue && anomaly.afterValue) {
          const diffTable = new Table({
            head: ['字段', '变更前', '变更后'],
            colWidths: [15, 30, 30],
          });
          
          for (const field of anomaly.affectedFields) {
            diffTable.push([
              field,
              JSON.stringify(anomaly.beforeValue[field]),
              JSON.stringify(anomaly.afterValue[field]),
            ]);
          }
          console.log(diffTable.toString());
        }
      }
    } else {
      console.log('\n' + chalk.green('✓ 未检测到异常'));
    }

    if (options.showRaw) {
      console.log('\n' + chalk.blue('=== 原始数据样本 ==='));
      const sampleTable = new Table({
        head: ['ID', '员工', '线路', '站点', '日期', '时段', '来源'],
        colWidths: [18, 10, 18, 14, 12, 10, 20],
      });
      
      result.rawData.slice(0, 5).forEach(r => {
        sampleTable.push([
          r.id,
          r.employeeName,
          r.busRoute,
          r.busStop,
          r.date,
          r.timeSlot,
          r.source,
        ]);
      });
      console.log(sampleTable.toString());
    }

    console.log('\n' + generateSummary(result));
  });

program
  .command('preview')
  .description('预览批量操作影响范围')
  .option('-i, --input <file>', `从JSON文件加载数据 (默认: ${DEFAULT_DATA_FILE})`)
  .option('--cleanup', '预览清理异常记录')
  .option('--fix <id>', '预览修复指定异常记录')
  .action((options) => {
    console.log(chalk.blue('=== 预览批量操作 ==='));

    const inputPath = options.input ? path.resolve(options.input) : DEFAULT_DATA_FILE;
    const data = loadData(inputPath);
    
    if (data) {
      analyzer.loadReservations(data);
      console.log(chalk.green(`✓ 从文件加载数据: ${inputPath}`));
    } else {
      const testData = generateTrainingEnvironmentData();
      analyzer.loadReservations(testData.allReservations);
      console.log(chalk.yellow(`⚠ 未找到数据文件，自动生成测试数据用于预览`));
    }

    if (options.cleanup) {
      const preview = analyzer.previewCleanup();
      console.log(chalk.yellow(`操作: ${preview.action}`));
      console.log(chalk.yellow(`影响数量: ${preview.count}`));
      console.log(chalk.yellow(`影响ID: ${preview.affectedIds.join(', ')}`));
      
      if (preview.sampleItems.length > 0) {
        console.log('\n' + chalk.blue('样本记录:'));
        preview.sampleItems.forEach(r => {
          console.log(`  - ${r.id}: ${r.employeeName} - ${r.busRoute}`);
        });
      }
    } else if (options.fix) {
      const result = analyzer.analyze();
      const anomaly = result.anomalies.find(a => a.reservationId === options.fix);
      if (anomaly) {
        const preview = analyzer.previewFix(anomaly);
        console.log(chalk.yellow(`操作: ${preview.action}`));
        console.log(chalk.yellow(`影响数量: ${preview.count}`));
        console.log(chalk.yellow(`影响ID: ${preview.affectedIds.join(', ')}`));
      } else {
        console.log(chalk.red(`未找到异常记录: ${options.fix}`));
      }
    }
  });

program
  .command('execute')
  .description('执行批量操作')
  .option('-i, --input <file>', `从JSON文件加载数据 (默认: ${DEFAULT_DATA_FILE})`)
  .option('--fix-all', '修复所有异常记录')
  .option('--fix <id>', '修复指定异常记录')
  .option('--rollback-plan', '生成回滚计划')
  .action((options) => {
    console.log(chalk.blue('=== 执行批量操作 ==='));

    const inputPath = options.input ? path.resolve(options.input) : DEFAULT_DATA_FILE;
    const data = loadData(inputPath);
    
    if (data) {
      analyzer.loadReservations(data);
      console.log(chalk.green(`✓ 从文件加载数据: ${inputPath}`));
    } else {
      const testData = generateTrainingEnvironmentData();
      analyzer.loadReservations(testData.allReservations);
      console.log(chalk.yellow(`⚠ 未找到数据文件，自动生成测试数据用于执行`));
    }
    
    const result = analyzer.analyze();

    if (options.rollbackPlan) {
      const plan = analyzer.createRollbackPlan();
      console.log(chalk.green(`✓ 生成回滚计划: ${plan.rollbackId}`));
      console.log(chalk.green(`✓ 备份记录数: ${plan.backupSnapshot.length}`));
      console.log(chalk.green(`✓ 创建时间: ${plan.createdAt}`));
      
      const rollbackFile = path.resolve(`rollback-${plan.rollbackId}.json`);
      fs.writeFileSync(rollbackFile, JSON.stringify(plan, null, 2));
      console.log(chalk.green(`✓ 回滚计划已保存: ${rollbackFile}`));
      return;
    }

    if (options.fixAll) {
      console.log(chalk.yellow(`将修复 ${result.anomalies.length} 条异常记录`));
      result.anomalies.forEach(anomaly => {
        const fixed = analyzer.applyFix(anomaly);
        if (fixed) {
          console.log(chalk.green(`✓ 已修复: ${anomaly.reservationId}`));
        }
      });
    } else if (options.fix) {
      const anomaly = result.anomalies.find(a => a.reservationId === options.fix);
      if (anomaly) {
        const fixed = analyzer.applyFix(anomaly);
        if (fixed) {
          console.log(chalk.green(`✓ 已修复: ${options.fix}`));
          console.log(chalk.green(`  新版本号: ${fixed.version}`));
          console.log(chalk.green(`  修复来源: ${fixed.source}`));
        }
      } else {
        console.log(chalk.red(`未找到异常记录: ${options.fix}`));
      }
    }
  });

program
  .command('summary')
  .description('生成最终分析摘要')
  .option('-i, --input <file>', `从JSON文件加载数据 (默认: ${DEFAULT_DATA_FILE})`)
  .action((options) => {
    const inputPath = options.input ? path.resolve(options.input) : DEFAULT_DATA_FILE;
    const data = loadData(inputPath);
    
    if (data) {
      analyzer.loadReservations(data);
      console.log(chalk.green(`✓ 从文件加载数据: ${inputPath}`));
    } else {
      const testData = generateTrainingEnvironmentData();
      analyzer.loadReservations(testData.allReservations);
      console.log(chalk.yellow(`⚠ 未找到数据文件，自动生成测试数据用于分析`));
    }
    
    for (let i = 0; i < 10; i++) {
      analyzer.get('RES-CONFLICT-001');
    }
    analyzer.get('NON-EXISTENT-KEY');

    const result = analyzer.analyze();
    console.log('\n' + generateSummary(result));
  });

program.parse(process.argv);
