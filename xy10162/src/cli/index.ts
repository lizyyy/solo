#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import { importFile } from '../services/importService';
import { createValidationService } from '../services/validationService';
import { getStorageService } from '../services/storageService';
import { getExportService } from '../services/exportService';
import { formatDate } from '../utils/helpers';
import { ValidationOptions, ExportOptions } from '../types/invoice';

const program = new Command();

program
  .name('invoice-verifier')
  .description('批量发票真伪核验 CLI 工具 - 处理重复票、红冲票和金额不一致检测')
  .version('1.0.0');

program
  .command('verify')
  .description('导入发票文件并进行核验')
  .argument('<file>', '发票文件路径 (CSV 或 JSON)')
  .option('-o, --output <dir>', '输出目录', 'output')
  .option('--no-save', '不保存到历史记录')
  .option('--strict', '严格模式')
  .option('--skip-duplicates', '跳过重复检测')
  .option('--skip-red', '跳过红冲检测')
  .option('--skip-amount', '跳过金额一致性检测')
  .option('--format <format>', '导出格式 (json|csv)', 'json')
  .action(async (file: string, options: any) => {
    const spinner = ora('开始处理...').start();
    
    try {
      const filePath = path.resolve(file);
      spinner.text = `正在导入文件: ${filePath}`;
      
      const importResult = await importFile(filePath);
      
      if (importResult.failedRecords > 0) {
        spinner.warn(`导入完成，成功 ${importResult.importedRecords} 条，失败 ${importResult.failedRecords} 条`);
        console.log(chalk.yellow('\n失败记录详情:'));
        for (const failed of importResult.failedRecordsDetails) {
          console.log(chalk.yellow(`  行 ${failed.lineNumber}: ${failed.error}`));
        }
      } else {
        spinner.succeed(`导入完成，共 ${importResult.importedRecords} 条记录`);
      }

      if (importResult.invoices.length === 0) {
        console.log(chalk.red('没有可处理的发票数据'));
        return;
      }

      const validationOptions: ValidationOptions = {
        checkDuplicates: !options.skipDuplicates,
        checkRedInvoices: !options.skipRed,
        checkAmountConsistency: !options.skipAmount,
        strictMode: options.strict || false
      };

      spinner.start('正在进行发票核验...');
      const storage = getStorageService();
      await storage.init();
      
      const existingInvoices = await storage.getAllInvoices();
      const validationService = createValidationService(validationOptions);
      const validationResult = await validationService.validate(
        importResult.invoices,
        existingInvoices
      );

      spinner.succeed('发票核验完成');

      console.log(chalk.bold('\n========== 核验结果 =========='));
      console.log(chalk.cyan(`总发票数: ${validationResult.totalInvoices}`));
      console.log(chalk.green(`有效发票: ${validationResult.validInvoices}`));
      console.log(chalk.red(`异常发票: ${validationResult.invalidInvoices}`));
      console.log(chalk.yellow(`重复发票组: ${validationResult.duplicateGroups.length}`));
      console.log(chalk.magenta(`红冲发票: ${validationResult.redInvoiceRelations.length}`));
      console.log(chalk.gray(`处理耗时: ${validationResult.processingTime}ms`));

      if (validationResult.errors.length > 0) {
        console.log(chalk.bold('\n========== 异常详情 =========='));
        
        const duplicateErrors = validationResult.errors.filter(e => e.type === 'DUPLICATE_INVOICE');
        if (duplicateErrors.length > 0) {
          console.log(chalk.yellow(`\n重复发票 (${Math.ceil(duplicateErrors.length / 2)} 组):`));
          for (const group of validationResult.duplicateGroups) {
            console.log(chalk.yellow(`  组 ${group.key}:`));
            for (const inv of group.invoices) {
              const isRec = group.recommendedInvoice?.id === inv.id ? ' (推荐保留)' : '';
              console.log(chalk.yellow(`    - ${inv.invoiceCode}-${inv.invoiceNumber} ¥${inv.totalAmount}${isRec}`));
            }
          }
        }

        const redErrors = validationResult.errors.filter(e => 
          e.type === 'RED_INVOICE_WITHOUT_ORIGINAL' || e.type === 'RED_INVOICE_AMOUNT_MISMATCH'
        );
        if (redErrors.length > 0) {
          console.log(chalk.magenta(`\n红冲发票异常 (${redErrors.length} 条):`));
          for (const error of redErrors) {
            console.log(chalk.magenta(`  - ${error.message}`));
          }
        }

        const amountErrors = validationResult.errors.filter(e => e.type === 'AMOUNT_TOTAL_MISMATCH');
        if (amountErrors.length > 0) {
          console.log(chalk.red(`\n金额不一致 (${amountErrors.length} 条):`));
          for (const error of amountErrors) {
            console.log(chalk.red(`  - ${error.message}`));
          }
        }
      }

      if (options.save) {
        spinner.start('正在保存历史记录...');
        await storage.addHistory(
          importResult,
          validationResult,
          path.basename(filePath)
        );
        spinner.succeed('历史记录已保存');
      } else {
        spinner.info('已跳过保存历史记录');
      }

      const outputDir = path.resolve(options.output);
      const exportService = getExportService();
      const exportFormat = options.format as 'json' | 'csv';
      
      spinner.start(`正在导出报告到 ${outputDir}...`);
      
      const baseFileName = `report_${Date.now()}`;
      
      await exportService.exportReport(
        importResult.invoices,
        validationResult,
        path.join(outputDir, baseFileName),
        { format: exportFormat }
      );

      if (validationResult.duplicateGroups.length > 0) {
        await exportService.exportDuplicates(
          validationResult,
          path.join(outputDir, `${baseFileName}_duplicates`),
          { format: exportFormat }
        );
      }

      if (validationResult.redInvoiceRelations.length > 0) {
        await exportService.exportRedInvoices(
          validationResult,
          path.join(outputDir, `${baseFileName}_red_invoices`),
          { format: exportFormat }
        );
      }

      if (validationResult.errors.length > 0) {
        await exportService.exportErrors(
          validationResult,
          path.join(outputDir, `${baseFileName}_errors`),
          { format: exportFormat }
        );
      }

      spinner.succeed(`报告已导出到: ${outputDir}`);
      
      console.log(chalk.bold('\n========== 批次信息 =========='));
      console.log(chalk.cyan(`批次号: ${importResult.batchId}`));
      console.log(chalk.gray('使用 `invoice-verifier history --batch <批次号>` 查看详情'));

    } catch (error: any) {
      spinner.fail('处理失败');
      console.error(chalk.red(error.message || error));
      process.exit(1);
    }
  });

program
  .command('history')
  .description('查看历史核验记录')
  .option('-b, --batch <batchId>', '按批次号筛选')
  .option('-l, --limit <number>', '显示条数', '10')
  .option('-o, --output <file>', '导出到文件')
  .option('--format <format>', '导出格式 (json|csv)', 'json')
  .action(async (options: any) => {
    const storage = getStorageService();
    await storage.init();
    
    let historyRecords;
    
    if (options.batch) {
      const record = await storage.getHistoryByBatchId(options.batch);
      historyRecords = record ? [record] : [];
    } else {
      historyRecords = await storage.getHistory();
      historyRecords = historyRecords.slice(0, parseInt(options.limit));
    }

    if (historyRecords.length === 0) {
      console.log(chalk.yellow('暂无历史记录'));
      return;
    }

    console.log(chalk.bold('\n========== 历史记录 =========='));
    
    for (let i = 0; i < historyRecords.length; i++) {
      const record = historyRecords[i];
      console.log(chalk.cyan(`\n[${i + 1}] ${record.batchId}`));
      console.log(chalk.gray(`  文件名: ${record.fileName}`));
      console.log(chalk.gray(`  导入时间: ${formatDate(record.importTime)}`));
      console.log(chalk.green(`  有效: ${record.validRecords}`) + 
                  chalk.gray(' / ') + 
                  chalk.red(`无效: ${record.invalidRecords}`) + 
                  chalk.gray(` / 总计: ${record.totalRecords}`));
      
      if (record.validationResult) {
        console.log(chalk.yellow(`  重复组: ${record.validationResult.duplicateGroups.length}`));
        console.log(chalk.magenta(`  红冲票: ${record.validationResult.redInvoiceRelations.length}`));
      }
    }

    if (options.output) {
      const exportService = getExportService();
      const outputPath = await exportService.exportHistory(
        historyRecords,
        path.resolve(options.output),
        { format: options.format as 'json' | 'csv' }
      );
      console.log(chalk.green(`\n已导出到: ${outputPath}`));
    }
  });

program
  .command('delete')
  .description('删除指定批次的历史记录')
  .argument('<batchId>', '批次号')
  .option('-y, --yes', '确认删除，跳过提示')
  .action(async (batchId: string, options: any) => {
    const storage = getStorageService();
    await storage.init();
    
    const record = await storage.getHistoryByBatchId(batchId);
    if (!record) {
      console.log(chalk.yellow(`未找到批次: ${batchId}`));
      return;
    }

    if (!options.yes) {
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise<string>((resolve) => {
        readline.question(
          chalk.yellow(`确定要删除批次 ${batchId} 吗？(y/N): `),
          resolve
        );
      });
      readline.close();

      if (!['y', 'yes'].includes(answer.toLowerCase())) {
        console.log(chalk.gray('已取消删除'));
        return;
      }
    }

    const deleted = await storage.deleteHistory(batchId);
    if (deleted) {
      console.log(chalk.green(`已删除批次: ${batchId}`));
    } else {
      console.log(chalk.red('删除失败'));
    }
  });

program
  .command('stats')
  .description('查看数据库统计信息')
  .action(async () => {
    const storage = getStorageService();
    await storage.init();
    
    const stats = await storage.getStats();
    
    console.log(chalk.bold('\n========== 数据库统计 =========='));
    console.log(chalk.cyan(`历史记录数: ${stats.totalHistoryRecords}`));
    console.log(chalk.cyan(`发票总数: ${stats.totalInvoices}`));
    console.log(chalk.gray(`数据库大小: ${(stats.databaseSize / 1024).toFixed(2)} KB`));
    console.log(chalk.gray(`最后更新: ${stats.lastUpdatedAt}`));
    console.log(chalk.gray(`数据库路径: ${storage.getDatabasePath()}`));
  });

program
  .command('export-samples')
  .description('导出示例文件')
  .argument('<dir>', '输出目录')
  .action(async (dir: string) => {
    const outputDir = path.resolve(dir);
    const fs = require('fs');
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const csvContent = `发票代码,发票号码,开票日期,金额,税额,价税合计,销售方名称,购买方名称,发票类型,状态,备注
123456789012,00012345,2024-01-15,1000.00,130.00,1130.00,示例公司A,示例公司B,增值税专用发票,正常,示例正常发票
123456789012,00012346,2024-01-16,500.00,65.00,565.00,示例公司C,示例公司B,增值税普通发票,正常,
123456789012,00012345,2024-01-15,1000.00,130.00,1130.00,示例公司A,示例公司B,增值税专用发票,正常,重复发票示例
123456789012,00012347,2024-01-17,-2000.00,-260.00,-2260.00,示例公司D,示例公司B,增值税专用发票,红冲,红冲发票示例
123456789012,00012348,2024-01-18,800.00,100.00,950.00,示例公司E,示例公司B,电子普通发票,正常,金额不一致示例`;

    const jsonContent = [
      {
        "发票代码": "123456789012",
        "发票号码": "00012345",
        "开票日期": "2024-01-15",
        "金额": 1000.00,
        "税额": 130.00,
        "价税合计": 1130.00,
        "销售方名称": "示例公司A",
        "购买方名称": "示例公司B",
        "发票类型": "增值税专用发票",
        "状态": "正常",
        "备注": "示例正常发票"
      },
      {
        "发票代码": "123456789012",
        "发票号码": "00012346",
        "开票日期": "2024-01-16",
        "金额": 500.00,
        "税额": 65.00,
        "价税合计": 565.00,
        "销售方名称": "示例公司C",
        "购买方名称": "示例公司B",
        "发票类型": "增值税普通发票",
        "状态": "正常"
      }
    ];

    fs.writeFileSync(path.join(outputDir, 'sample-invoices.csv'), csvContent, 'utf8');
    fs.writeFileSync(path.join(outputDir, 'sample-invoices.json'), JSON.stringify(jsonContent, null, 2), 'utf8');
    
    console.log(chalk.green(`示例文件已导出到: ${outputDir}`));
    console.log(chalk.gray('包含: sample-invoices.csv, sample-invoices.json'));
  });

program.parse(process.argv);
