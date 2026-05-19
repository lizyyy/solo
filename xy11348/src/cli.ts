#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { QualityControlDB } from './database/db';
import { QualityService } from './services/qualityService';
import { ImportService } from './services/importService';
import { writeFileSync } from 'fs';

const program = new Command();
const db = new QualityControlDB();
const qualityService = new QualityService(db);
const importService = new ImportService(db);

program
  .name('pqc')
  .description('印刷车间品控CLI工具')
  .version('1.0.0');

program
  .command('import-thresholds')
  .description('从CSV导入阈值配置')
  .argument('<file>', 'CSV文件路径')
  .action((file) => {
    try {
      const result = importService.importThresholdsFromCsv(file);
      console.log(chalk.green(`✓ 成功导入 ${result.success.length} 条阈值配置`));
      if (result.failed.length > 0) {
        console.log(chalk.yellow(`⚠ 失败 ${result.failed.length} 条:`));
        result.failed.forEach(f => {
          console.log(chalk.yellow(`  第${f.index + 1}行: ${f.error}`));
        });
      }
    } catch (error) {
      console.log(chalk.red(`✗ 导入失败: ${error}`));
    }
  });

program
  .command('import-paper')
  .description('从CSV导入纸张批次')
  .argument('<file>', 'CSV文件路径')
  .action((file) => {
    try {
      const result = importService.importPaperBatchesFromCsv(file);
      console.log(chalk.green(`✓ 成功导入 ${result.success.length} 条纸张批次`));
      if (result.failed.length > 0) {
        console.log(chalk.yellow(`⚠ 失败 ${result.failed.length} 条:`));
        result.failed.forEach(f => {
          console.log(chalk.yellow(`  第${f.index + 1}行: ${f.error}`));
        });
      }
    } catch (error) {
      console.log(chalk.red(`✗ 导入失败: ${error}`));
    }
  });

program
  .command('import-batch')
  .description('从CSV导入印刷批次及测量数据')
  .argument('<file>', 'CSV文件路径')
  .action((file) => {
    try {
      const result = importService.importPrintBatchFromCsv(file);
      console.log(chalk.green(`✓ 批次导入完成`));
      
      if (result.batchResult.success.length > 0) {
        console.log(chalk.green(`  批次: ${result.batchResult.success[0].batchNo}`));
      }
      
      if (result.measurementResult) {
        console.log(chalk.green(`  测量数据: ${result.measurementResult.success.length} 条成功`));
        if (result.measurementResult.failed.length > 0) {
          console.log(chalk.yellow(`  ${result.measurementResult.failed.length} 条失败`));
        }
      }
    } catch (error) {
      console.log(chalk.red(`✗ 导入失败: ${error}`));
    }
  });

program
  .command('evaluate')
  .description('评估批次质量')
  .argument('<batchNo>', '印刷批次号')
  .action((batchNo) => {
    try {
      const result = qualityService.evaluateBatch(batchNo);
      
      const table = new Table({
        head: ['指标', '数值'],
        colWidths: [20, 30]
      });

      table.push(['批次号', batchNo]);
      table.push(['总测量点数', result.totalCount.toString()]);
      table.push(['合格点数', result.passCount.toString()]);
      table.push(['不合格点数', result.failCount.toString()]);
      table.push(['合格率', `${(result.passRate * 100).toFixed(2)}%`]);
      
      let statusColor = chalk.green;
      let statusText = '通过';
      if (result.overallResult === 'fail') {
        statusColor = chalk.red;
        statusText = '不通过';
      } else if (result.overallResult === 'warning') {
        statusColor = chalk.yellow;
        statusText = '警告';
      }
      table.push(['总体评估', statusColor(statusText)]);

      console.log(table.toString());
    } catch (error) {
      console.log(chalk.red(`✗ 评估失败: ${error}`));
    }
  });

program
  .command('review')
  .description('复核批次')
  .argument('<batchNo>', '印刷批次号')
  .argument('<decision>', '复核决定: approve/reject/rework')
  .argument('<reviewer>', '复核人')
  .option('-r, --reason <reason>', '复核原因')
  .action((batchNo, decision, reviewer, options) => {
    try {
      const printBatch = db.getPrintBatchByBatchNo(batchNo);
      if (!printBatch) {
        console.log(chalk.red(`✗ 批次 ${batchNo} 不存在`));
        return;
      }

      const reviewId = db.insertReviewRecord({
        printBatchId: printBatch.id!,
        reviewer,
        reviewDate: new Date().toISOString(),
        decision: decision as any,
        reason: options.reason || '人工复核'
      });

      let newStatus = printBatch.status;
      if (decision === 'approve') {
        newStatus = 'approved';
      } else if (decision === 'reject') {
        newStatus = 'rejected';
      } else if (decision === 'rework') {
        newStatus = 'reworked';
      }

      db.updatePrintBatchStatus(batchNo, newStatus);

      console.log(chalk.green(`✓ 复核完成，批次状态已更新为: ${newStatus}`));
    } catch (error) {
      console.log(chalk.red(`✗ 复核失败: ${error}`));
    }
  });

program
  .command('report')
  .description('生成质检单')
  .argument('<batchNo>', '印刷批次号')
  .argument('<generatedBy>', '生成人')
  .option('-o, --output <file>', '输出文件路径')
  .action((batchNo, generatedBy, options) => {
    try {
      const printBatch = db.getPrintBatchByBatchNo(batchNo);
      if (!printBatch) {
        console.log(chalk.red(`✗ 批次 ${batchNo} 不存在`));
        return;
      }

      const measurements = db.getMeasurementsByPrintBatchId(printBatch.id!);
      const evaluation = qualityService.evaluateBatch(batchNo);
      const reworkRecords = db.getReworkRecordsByPrintBatchId(printBatch.id!);
      const reviewRecords = db.getReviewRecordsByPrintBatchId(printBatch.id!);

      const reportNo = qualityService.generateReportNo(batchNo);
      const reportId = db.insertInspectionReport({
        reportNo,
        printBatchId: printBatch.id!,
        generatedAt: new Date().toISOString(),
        generatedBy,
        totalMeasurements: evaluation.totalCount,
        passCount: evaluation.passCount,
        failCount: evaluation.failCount,
        passRate: evaluation.passRate,
        status: 'final'
      });

      let reportContent = `========================================\n`;
      reportContent += `           品 质 检 验 单\n`;
      reportContent += `========================================\n\n`;
      reportContent += `报告编号: ${reportNo}\n`;
      reportContent += `生成时间: ${new Date().toLocaleString()}\n`;
      reportContent += `生成人: ${generatedBy}\n\n`;
      
      reportContent += `【批次信息】\n`;
      reportContent += `印刷批次: ${printBatch.batchNo}\n`;
      reportContent += `产品名称: ${printBatch.productName}\n`;
      reportContent += `纸张批次: ${printBatch.paperBatchNo}\n`;
      reportContent += `印刷日期: ${printBatch.printDate}\n`;
      reportContent += `班次: ${printBatch.shift}\n`;
      reportContent += `操作员: ${printBatch.operator}\n`;
      reportContent += `机台: ${printBatch.machineNo}\n`;
      reportContent += `阈值标准: ${printBatch.thresholdName}\n\n`;

      reportContent += `【检验结果汇总】\n`;
      reportContent += `测量点数: ${evaluation.totalCount}\n`;
      reportContent += `合格点数: ${evaluation.passCount}\n`;
      reportContent += `不合格点数: ${evaluation.failCount}\n`;
      reportContent += `合格率: ${(evaluation.passRate * 100).toFixed(2)}%\n`;
      reportContent += `总体评估: ${evaluation.overallResult.toUpperCase()}\n\n`;

      reportContent += `【详细测量数据】\n`;
      measurements.forEach(m => {
        const status = m.isPass ? '✓' : '✗';
        const retain = m.isRetained ? '[留样]' : '';
        reportContent += `${status} 点位${m.measurementPoint}: L=${m.L.toFixed(2)} a=${m.a.toFixed(2)} b=${m.b.toFixed(2)} ΔE=${m.deltaE.toFixed(2)} ${retain}\n`;
      });

      if (reworkRecords.length > 0) {
        reportContent += `\n【返工记录】\n`;
        reworkRecords.forEach(r => {
          reportContent += `- ${r.reworkType}: ${r.reason} (${r.operator}, ${r.startTime})\n`;
        });
      }

      if (reviewRecords.length > 0) {
        reportContent += `\n【复核记录】\n`;
        reviewRecords.forEach(r => {
          reportContent += `- ${r.decision.toUpperCase()}: ${r.reason} (${r.reviewer}, ${r.reviewDate})\n`;
        });
      }

      reportContent += `\n========================================\n`;

      if (options.output) {
        writeFileSync(options.output, reportContent, 'utf-8');
        console.log(chalk.green(`✓ 质检单已保存到: ${options.output}`));
      } else {
        console.log(reportContent);
      }
    } catch (error) {
      console.log(chalk.red(`✗ 生成质检单失败: ${error}`));
    }
  });

program
  .command('trend')
  .description('查看质量趋势')
  .option('-d, --days <number>', '查看天数', '30')
  .action((options) => {
    try {
      const days = parseInt(options.days);
      const trend = qualityService.getBatchTrend(days);

      if (trend.length === 0) {
        console.log(chalk.yellow('⚠ 暂无数据'));
        return;
      }

      const table = new Table({
        head: ['日期', '批次数量', '合格率', '平均ΔE'],
        colWidths: [15, 12, 12, 12]
      });

      trend.forEach(t => {
        const passRateColor = t.passRate >= 0.95 ? chalk.green : (t.passRate >= 0.8 ? chalk.yellow : chalk.red);
        table.push([
          t.date,
          t.batchCount.toString(),
          passRateColor(`${(t.passRate * 100).toFixed(1)}%`),
          t.avgDeltaE.toFixed(3)
        ]);
      });

      console.log(chalk.bold(`\n最近 ${days} 天质量趋势:\n`));
      console.log(table.toString());
    } catch (error) {
      console.log(chalk.red(`✗ 查询趋势失败: ${error}`));
    }
  });

program
  .command('list-thresholds')
  .description('列出所有阈值配置')
  .action(() => {
    const thresholds = db.listThresholds();
    
    const table = new Table({
      head: ['名称', '标准L', '标准a', '标准b', 'ΔLmax', 'Δamax', 'Δbmax', 'ΔEmax'],
      colWidths: [15, 10, 10, 10, 10, 10, 10, 10]
    });

    thresholds.forEach(t => {
      table.push([
        t.name,
        t.standardL.toFixed(2),
        t.standardA.toFixed(2),
        t.standardB.toFixed(2),
        t.deltaLMax.toFixed(2),
        t.deltaAMax.toFixed(2),
        t.deltaBMax.toFixed(2),
        t.deltaEMax.toFixed(2)
      ]);
    });

    console.log(table.toString());
  });

program
  .command('list-batches')
  .description('列出所有印刷批次')
  .action(() => {
    const batches = db.listPrintBatches();
    
    const table = new Table({
      head: ['批次号', '产品名称', '纸张批次', '印刷日期', '状态'],
      colWidths: [20, 20, 15, 15, 12]
    });

    batches.forEach(b => {
      let statusColor = b.status === 'approved' ? chalk.green : 
                        b.status === 'rejected' ? chalk.red : 
                        b.status === 'reworked' ? chalk.yellow : chalk.white;
      table.push([
        b.batchNo,
        b.productName,
        b.paperBatchNo || '',
        b.printDate,
        statusColor(b.status)
      ]);
    });

    console.log(table.toString());
  });

program
  .command('measurements')
  .description('查看批次测量数据')
  .argument('<batchNo>', '印刷批次号')
  .action((batchNo) => {
    try {
      const printBatch = db.getPrintBatchByBatchNo(batchNo);
      if (!printBatch) {
        console.log(chalk.red(`✗ 批次 ${batchNo} 不存在`));
        return;
      }

      const measurements = db.getMeasurementsByPrintBatchId(printBatch.id!);
      
      const table = new Table({
        head: ['点位', 'L', 'a', 'b', 'ΔL', 'Δa', 'Δb', 'ΔE', '状态', '留样'],
        colWidths: [10, 10, 10, 10, 10, 10, 10, 10, 8, 8]
      });

      measurements.forEach(m => {
        const status = m.isPass ? chalk.green('✓') : chalk.red('✗');
        const retain = m.isRetained ? chalk.yellow('是') : '否';
        table.push([
          m.measurementPoint,
          m.L.toFixed(2),
          m.a.toFixed(2),
          m.b.toFixed(2),
          m.deltaL.toFixed(2),
          m.deltaA.toFixed(2),
          m.deltaB.toFixed(2),
          m.deltaE.toFixed(2),
          status,
          retain
        ]);
      });

      console.log(chalk.bold(`\n批次 ${batchNo} 测量数据:\n`));
      console.log(table.toString());
    } catch (error) {
      console.log(chalk.red(`✗ 查询失败: ${error}`));
    }
  });

program.parseAsync(process.argv).catch(console.error);

process.on('exit', () => {
  db.close();
});
