#!/usr/bin/env node

import * as yargs from 'yargs';
import * as path from 'path';
import { loadAllData } from './data-loader';
import { validateData, formatValidationResult } from './validator';
import { reconcileData, formatReconciliationResult } from './reconciler';
import { comparePeriods, compareStalls, formatComparisonResult } from './comparer';
import { exportReconciliation, exportValidation, exportComparison } from './exporter';
import { ExportOptions } from './types';
import { ensureDirectoryExists } from './utils';

const argv = yargs
  .scriptName('nm-reconcile')
  .usage('$0 <command> [options]')
  .option('input', {
    alias: 'i',
    type: 'string',
    description: '输入数据目录路径',
    default: './data'
  })
  .option('output', {
    alias: 'o',
    type: 'string',
    description: '输出目录路径',
    default: './reports'
  })
  .option('config', {
    alias: 'c',
    type: 'string',
    description: '配置文件路径'
  })
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: '显示详细信息',
    default: false
  })
  .option('quiet', {
    alias: 'q',
    type: 'boolean',
    description: '静默模式，只输出必要信息',
    default: false
  })
  
  .command('validate', '验证数据完整性', {}, async (args) => {
    try {
      const inputDir = path.resolve(String(args.input));
      const configPath = args.config ? path.resolve(String(args.config)) : undefined;
      
      if (!args.quiet) {
        console.log(`📂 加载数据目录: ${inputDir}`);
      }
      
      const data = loadAllData(inputDir, configPath);
      
      if (!args.quiet) {
        console.log(`✅ 加载完成: ${data.sales.length} 笔销售, ${data.payments.length} 笔收款, ${data.inventory.items.length} 种商品, ${data.fees.length} 笔费用, ${data.returns.length} 笔退货`);
        console.log('');
      }
      
      const validationResult = validateData(data);
      
      console.log(formatValidationResult(validationResult));
      
      if (args.output) {
        const outputDir = path.resolve(String(args.output));
        ensureDirectoryExists(outputDir);
        
        const exportOptions: ExportOptions = {
          format: 'markdown',
          includeDailyDetails: false,
          includeProductDetails: false,
          includeStallDetails: false,
          includeActionItems: false,
          includeIssues: false,
          outputPath: outputDir,
          fileName: 'validation-report'
        };
        
        const mdPath = exportValidation(validationResult, exportOptions, data.config);
        if (!args.quiet) {
          console.log(`\n📄 Markdown 报告已保存: ${mdPath}`);
        }
        
        exportOptions.format = 'json';
        exportOptions.fileName = 'validation-result';
        const jsonPath = exportValidation(validationResult, exportOptions, data.config);
        if (!args.quiet) {
          console.log(`📄 JSON 报告已保存: ${jsonPath}`);
        }
        
        exportOptions.format = 'csv';
        exportOptions.fileName = 'validation-issues';
        const csvPath = exportValidation(validationResult, exportOptions, data.config);
        if (!args.quiet) {
          console.log(`📄 CSV 报告已保存: ${csvPath}`);
        }
      }
      
      process.exit(validationResult.valid ? 0 : 1);
    } catch (error) {
      console.error('❌ 验证失败:', error);
      process.exit(1);
    }
  })
  
  .command('reconcile', '计算利润并对账', (yargs) => {
    return yargs
      .option('start-date', {
        type: 'string',
        description: '开始日期 (YYYY-MM-DD)'
      })
      .option('end-date', {
        type: 'string',
        description: '结束日期 (YYYY-MM-DD)'
      })
      .option('stall-id', {
        type: 'string',
        description: '摊位ID'
      })
      .option('format', {
        type: 'string',
        choices: ['console', 'markdown', 'csv', 'json'],
        default: 'console',
        description: '输出格式'
      })
      .option('file-name', {
        type: 'string',
        description: '输出文件名 (不含扩展名)'
      })
      .option('all-details', {
        type: 'boolean',
        default: false,
        description: '包含所有详细信息'
      });
  }, async (args) => {
    try {
      const inputDir = path.resolve(String(args.input));
      const configPath = args.config ? path.resolve(String(args.config)) : undefined;
      
      if (!args.quiet) {
        console.log(`📂 加载数据目录: ${inputDir}`);
      }
      
      const data = loadAllData(inputDir, configPath);
      
      if (!args.quiet) {
        console.log(`✅ 加载完成: ${data.sales.length} 笔销售, ${data.payments.length} 笔收款`);
      }
      
      const reconciliationResult = reconcileData(data, {
        startDate: args['start-date'] as string | undefined,
        endDate: args['end-date'] as string | undefined,
        stallId: args['stall-id'] as string | undefined
      });
      
      const format = args.format as 'console' | 'markdown' | 'csv' | 'json';
      
      if (format === 'console') {
        console.log('');
        console.log(formatReconciliationResult(reconciliationResult, data.config));
      }
      
      if (args.output || format !== 'console') {
        const outputDir = path.resolve(String(args.output || './reports'));
        ensureDirectoryExists(outputDir);
        
        const exportOptions: ExportOptions = {
          format: format === 'console' ? 'markdown' : format,
          includeDailyDetails: args['all-details'] as boolean,
          includeProductDetails: args['all-details'] as boolean,
          includeStallDetails: args['all-details'] as boolean,
          includeActionItems: true,
          includeIssues: true,
          outputPath: outputDir,
          fileName: args['file-name'] as string | undefined
        };
        
        const exportedPath = exportReconciliation(reconciliationResult, exportOptions, data.config);
        console.log(`\n📄 报告已保存: ${exportedPath}`);
        
        if (args['all-details']) {
          exportOptions.format = 'json';
          const jsonPath = exportReconciliation(reconciliationResult, exportOptions, data.config);
          console.log(`📄 JSON 报告已保存: ${jsonPath}`);
          
          exportOptions.format = 'csv';
          const csvPath = exportReconciliation(reconciliationResult, exportOptions, data.config);
          console.log(`📄 CSV 报告已保存: ${csvPath}`);
        }
      }
      
      process.exit(0);
    } catch (error) {
      console.error('❌ 对账失败:', error);
      process.exit(1);
    }
  })
  
  .command('compare', '对比两个时段或摊位的利润差异', (yargs) => {
    return yargs
      .option('base-start', {
        type: 'string',
        description: '基准期开始日期 (YYYY-MM-DD)',
        demandOption: true
      })
      .option('base-end', {
        type: 'string',
        description: '基准期结束日期 (YYYY-MM-DD)',
        demandOption: true
      })
      .option('base-stall', {
        type: 'string',
        description: '基准期摊位ID'
      })
      .option('compare-start', {
        type: 'string',
        description: '对比期开始日期 (YYYY-MM-DD)',
        demandOption: true
      })
      .option('compare-end', {
        type: 'string',
        description: '对比期结束日期 (YYYY-MM-DD)',
        demandOption: true
      })
      .option('compare-stall', {
        type: 'string',
        description: '对比期摊位ID'
      })
      .option('format', {
        type: 'string',
        choices: ['console', 'markdown', 'csv', 'json'],
        default: 'console',
        description: '输出格式'
      })
      .option('file-name', {
        type: 'string',
        description: '输出文件名 (不含扩展名)'
      });
  }, async (args) => {
    try {
      const inputDir = path.resolve(String(args.input));
      const configPath = args.config ? path.resolve(String(args.config)) : undefined;
      
      if (!args.quiet) {
        console.log(`📂 加载数据目录: ${inputDir}`);
      }
      
      const data = loadAllData(inputDir, configPath);
      
      let comparisonResult;
      
      if (args['base-stall'] && args['compare-stall'] && args['base-stall'] !== args['compare-stall']) {
        comparisonResult = compareStalls(
          data,
          args['base-stall'] as string,
          args['compare-stall'] as string,
          {
            startDate: args['base-start'] as string,
            endDate: args['base-end'] as string
          }
        );
      } else {
        comparisonResult = comparePeriods(
          data,
          {
            startDate: args['base-start'] as string,
            endDate: args['base-end'] as string,
            stallId: args['base-stall'] as string | undefined
          },
          {
            startDate: args['compare-start'] as string,
            endDate: args['compare-end'] as string,
            stallId: args['compare-stall'] as string | undefined
          }
        );
      }
      
      const format = args.format as 'console' | 'markdown' | 'csv' | 'json';
      
      if (format === 'console') {
        console.log('');
        console.log(formatComparisonResult(comparisonResult, data.config));
      }
      
      if (args.output || format !== 'console') {
        const outputDir = path.resolve(String(args.output || './reports'));
        ensureDirectoryExists(outputDir);
        
        const exportOptions: ExportOptions = {
          format: format === 'console' ? 'markdown' : format,
          includeDailyDetails: false,
          includeProductDetails: false,
          includeStallDetails: false,
          includeActionItems: false,
          includeIssues: false,
          outputPath: outputDir,
          fileName: args['file-name'] as string | undefined
        };
        
        const exportedPath = exportComparison(comparisonResult, exportOptions, data.config);
        console.log(`\n📄 对比报告已保存: ${exportedPath}`);
      }
      
      process.exit(0);
    } catch (error) {
      console.error('❌ 对比分析失败:', error);
      process.exit(1);
    }
  })
  
  .command('export', '导出报告', (yargs) => {
    return yargs
      .option('type', {
        type: 'string',
        choices: ['reconciliation', 'validation', 'comparison'],
        default: 'reconciliation',
        description: '报告类型'
      })
      .option('format', {
        type: 'string',
        choices: ['markdown', 'csv', 'json'],
        default: 'markdown',
        description: '输出格式'
      })
      .option('start-date', {
        type: 'string',
        description: '开始日期 (YYYY-MM-DD)'
      })
      .option('end-date', {
        type: 'string',
        description: '结束日期 (YYYY-MM-DD)'
      })
      .option('stall-id', {
        type: 'string',
        description: '摊位ID'
      })
      .option('file-name', {
        type: 'string',
        description: '输出文件名 (不含扩展名)'
      })
      .option('all-details', {
        type: 'boolean',
        default: true,
        description: '包含所有详细信息'
      });
  }, async (args) => {
    try {
      const inputDir = path.resolve(String(args.input));
      const configPath = args.config ? path.resolve(String(args.config)) : undefined;
      const outputDir = path.resolve(String(args.output));
      const type = args.type as 'reconciliation' | 'validation' | 'comparison';
      const format = args.format as 'markdown' | 'csv' | 'json';
      
      ensureDirectoryExists(outputDir);
      
      const data = loadAllData(inputDir, configPath);
      
      const exportOptions: ExportOptions = {
        format,
        includeDailyDetails: args['all-details'] as boolean,
        includeProductDetails: args['all-details'] as boolean,
        includeStallDetails: args['all-details'] as boolean,
        includeActionItems: true,
        includeIssues: true,
        outputPath: outputDir,
        fileName: args['file-name'] as string | undefined
      };
      
      let exportedPath: string;
      
      if (type === 'validation') {
        const validationResult = validateData(data);
        exportedPath = exportValidation(validationResult, exportOptions, data.config);
      } else {
        const reconciliationResult = reconcileData(data, {
          startDate: args['start-date'] as string | undefined,
          endDate: args['end-date'] as string | undefined,
          stallId: args['stall-id'] as string | undefined
        });
        exportedPath = exportReconciliation(reconciliationResult, exportOptions, data.config);
      }
      
      console.log(`📄 报告已导出: ${exportedPath}`);
      process.exit(0);
    } catch (error) {
      console.error('❌ 导出失败:', error);
      process.exit(1);
    }
  })
  
  .command('run-all', '运行完整流程：验证 -> 对账 -> 导出', (yargs) => {
    return yargs
      .option('start-date', {
        type: 'string',
        description: '开始日期 (YYYY-MM-DD)'
      })
      .option('end-date', {
        type: 'string',
        description: '结束日期 (YYYY-MM-DD)'
      })
      .option('stall-id', {
        type: 'string',
        description: '摊位ID'
      });
  }, async (args) => {
    try {
      const inputDir = path.resolve(String(args.input));
      const outputDir = path.resolve(String(args.output));
      const configPath = args.config ? path.resolve(String(args.config)) : undefined;
      
      console.log('='.repeat(70));
      console.log('🚀 夜市对账完整流程');
      console.log('='.repeat(70));
      
      console.log(`\n📂 输入目录: ${inputDir}`);
      console.log(`📂 输出目录: ${outputDir}`);
      console.log('');
      
      console.log('📋 第一步: 加载数据...');
      const data = loadAllData(inputDir, configPath);
      console.log(`   ✅ 加载完成: ${data.sales.length} 笔销售, ${data.payments.length} 笔收款, ${data.inventory.items.length} 种商品`);
      
      console.log('\n🔍 第二步: 验证数据...');
      const validationResult = validateData(data);
      console.log(formatValidationResult(validationResult));
      
      ensureDirectoryExists(outputDir);
      
      const validationExportOptions: ExportOptions = {
        format: 'markdown',
        includeDailyDetails: false,
        includeProductDetails: false,
        includeStallDetails: false,
        includeActionItems: false,
        includeIssues: false,
        outputPath: outputDir,
        fileName: '01-validation-report'
      };
      const validationPath = exportValidation(validationResult, validationExportOptions, data.config);
      console.log(`\n📄 验证报告已保存: ${validationPath}`);
      
      if (!validationResult.valid) {
        console.log('\n⚠️  数据验证存在错误，建议先修复后再继续对账。');
        console.log('   如要强制继续，请单独运行 reconcile 命令。');
        process.exit(1);
      }
      
      console.log('\n💰 第三步: 对账计算...');
      const reconciliationResult = reconcileData(data, {
        startDate: args['start-date'] as string | undefined,
        endDate: args['end-date'] as string | undefined,
        stallId: args['stall-id'] as string | undefined
      });
      console.log(formatReconciliationResult(reconciliationResult, data.config));
      
      const reconciliationExportOptions: ExportOptions = {
        format: 'markdown',
        includeDailyDetails: true,
        includeProductDetails: true,
        includeStallDetails: true,
        includeActionItems: true,
        includeIssues: true,
        outputPath: outputDir,
        fileName: '02-reconciliation-report'
      };
      
      const mdPath = exportReconciliation(reconciliationResult, reconciliationExportOptions, data.config);
      console.log(`\n📄 Markdown 报告已保存: ${mdPath}`);
      
      reconciliationExportOptions.format = 'json';
      reconciliationExportOptions.fileName = '03-reconciliation-data';
      const jsonPath = exportReconciliation(reconciliationResult, reconciliationExportOptions, data.config);
      console.log(`📄 JSON 数据已保存: ${jsonPath}`);
      
      reconciliationExportOptions.format = 'csv';
      reconciliationExportOptions.fileName = '04-reconciliation-summary';
      const csvPath = exportReconciliation(reconciliationResult, reconciliationExportOptions, data.config);
      console.log(`📄 CSV 摘要已保存: ${csvPath}`);
      
      console.log('\n' + '='.repeat(70));
      console.log('✅ 完整流程执行完成！');
      console.log('='.repeat(70));
      console.log(`\n📊 本期净利润: ${data.config.currency.symbol}${reconciliationResult.overall.netProfit}`);
      console.log(`📈 利润率: ${(reconciliationResult.overall.profitMargin * 100).toFixed(2)}%`);
      console.log(`\n📂 所有报告已保存到: ${outputDir}`);
      
      if (reconciliationResult.actionItems.length > 0) {
        console.log(`\n⚠️  待办事项: ${reconciliationResult.actionItems.length} 项需要处理`);
      }
      
      process.exit(0);
    } catch (error) {
      console.error('❌ 流程执行失败:', error);
      process.exit(1);
    }
  })
  
  .demandCommand(1, '请指定一个命令')
  .help()
  .alias('h', 'help')
  .version()
  .alias('v', 'version')
  .epilog('夜市对账工具 - 帮你收摊后把账对清楚')
  .argv;
