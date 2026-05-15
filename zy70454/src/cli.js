#!/usr/bin/env node

import { Command } from 'commander';
import { initDB } from './models/database.js';
import { processSupplierBatch, refreshSupplierCache } from './services/supplementService.js';
import { exportAbnormalSamples, exportByRerunMarker } from './services/exportService.js';
import { generateBatchReport, generateLegalEvidenceReport, generateSummaryReport } from './services/reportService.js';
import { generateMixedBatchData, generateNormalTestData, generateCacheIssueTestData } from './utils/testData.js';
import { getAllSuppliers } from './models/supplier.js';
import { getAbnormalMaterials } from './models/material.js';

const program = new Command();

program
  .name('dbdt')
  .description('数据库字段废弃处理命令行工具')
  .version('1.0.0');

program
  .command('process')
  .description('处理供应商目录补录批次')
  .option('--mode <mode>', '处理模式: normal/cache-issue/mixed', 'mixed')
  .action(async (options) => {
    await initDB();
    console.log('开始处理供应商目录补录...');
    
    let batchData;
    switch (options.mode) {
      case 'normal':
        batchData = generateNormalTestData();
        console.log('使用正常材料组');
        break;
      case 'cache-issue':
        batchData = generateCacheIssueTestData();
        console.log('使用缓存异常材料');
        break;
      case 'mixed':
      default:
        batchData = generateMixedBatchData();
        console.log('使用混合批次（正常材料 + 异常材料）');
        break;
    }

    console.log(`批次大小: ${batchData.length}`);
    
    const result = await processSupplierBatch(batchData);
    
    console.log('\n=== 处理结果 ===');
    console.log(`批次ID: ${result.batchId}`);
    console.log(`重跑标记: ${result.rerunMarker}`);
    console.log(`总数: ${result.total}`);
    console.log(`成功: ${result.success}`);
    console.log(`失败: ${result.error}`);
    
    console.log('\n=== 明细 ===');
    result.details.forEach((detail, index) => {
      console.log(`\n[${index + 1}] ${detail.supplierName} (${detail.supplierCode})`);
      console.log(`    状态: ${detail.status}`);
      if (detail.status === 'success') {
        console.log(`    摘要: ${detail.summary}`);
      } else {
        console.log(`    错误: ${detail.errorMessage}`);
        console.log(`    异常类型: ${detail.errorType}`);
      }
    });

    console.log('\n=== 生成报告 ===');
    const batchReport = await generateBatchReport(result.batchId);
    console.log(`批次报告已生成: ${batchReport.filePath}`);
    
    const legalReport = await generateLegalEvidenceReport(result.rerunMarker);
    console.log(`法务证据报告已生成: ${legalReport.filePath}`);
    
    console.log('\n处理完成！');
  });

program
  .command('export-abnormal')
  .description('导出异常样本')
  .option('--output <path>', '输出文件路径')
  .action(async (options) => {
    await initDB();
    console.log('正在导出异常样本...');
    const result = await exportAbnormalSamples(options.output);
    console.log(`导出数量: ${result.exported}`);
    if (result.exported > 0) {
      console.log(`输出文件: ${result.filePath}`);
    } else {
      console.log(result.message);
    }
  });

program
  .command('export-rerun')
  .description('按重跑标记导出数据')
  .argument('<rerunMarker>', '重跑标记')
  .option('--output <path>', '输出文件路径')
  .action(async (rerunMarker, options) => {
    await initDB();
    console.log(`正在导出重跑标记 ${rerunMarker} 的数据...`);
    const result = await exportByRerunMarker(rerunMarker, options.output);
    console.log(`导出数量: ${result.exported}`);
    if (result.exported > 0) {
      console.log(`输出文件: ${result.filePath}`);
    } else {
      console.log(result.message);
    }
  });

program
  .command('report-batch')
  .description('生成批次报告')
  .argument('<batchId>', '批次ID')
  .action(async (batchId) => {
    await initDB();
    console.log(`正在生成批次 ${batchId} 的报告...`);
    const result = await generateBatchReport(batchId);
    if (result.generated) {
      console.log(`报告已生成: ${result.filePath}`);
      console.log(`总数: ${result.report.summary.total}`);
      console.log(`成功: ${result.report.summary.success}`);
      console.log(`失败: ${result.report.summary.error}`);
    } else {
      console.log(result.message);
    }
  });

program
  .command('report-legal')
  .description('生成法务证据报告')
  .argument('<rerunMarker>', '重跑标记')
  .action(async (rerunMarker) => {
    await initDB();
    console.log(`正在生成重跑标记 ${rerunMarker} 的法务证据报告...`);
    const result = await generateLegalEvidenceReport(rerunMarker);
    if (result.generated) {
      console.log(`法务证据报告已生成: ${result.filePath}`);
      console.log(`复核样例已包含，可用于审计追溯`);
      console.log(`总记录数: ${result.report.statistics.totalRecords}`);
    } else {
      console.log(result.message);
    }
  });

program
  .command('report-summary')
  .description('生成总览报告')
  .action(async () => {
    await initDB();
    console.log('正在生成总览报告...');
    const result = await generateSummaryReport();
    console.log(`报告已生成: ${result.filePath}`);
    console.log(`供应商总数: ${result.report.summary.totalSuppliers}`);
    console.log(`异常样本数: ${result.report.summary.totalAbnormal}`);
  });

program
  .command('list-suppliers')
  .description('列出所有供应商')
  .action(async () => {
    await initDB();
    const suppliers = await getAllSuppliers();
    console.log(`供应商总数: ${suppliers.length}`);
    suppliers.forEach(s => {
      console.log(`  ${s.code} - ${s.name} (${s.status})`);
    });
  });

program
  .command('list-abnormal')
  .description('列出所有异常材料')
  .action(async () => {
    await initDB();
    const materials = await getAbnormalMaterials();
    console.log(`异常材料总数: ${materials.length}`);
    materials.forEach(m => {
      console.log(`  ${m.id} - ${m.material_type}`);
      console.log(`    错误: ${m.error_message}`);
    });
  });

program
  .command('refresh-cache')
  .description('刷新供应商目录缓存')
  .action(async () => {
    await initDB();
    const result = await refreshSupplierCache();
    console.log('缓存已刷新');
    console.log(`新版本: ${result.version}`);
  });

program.parseAsync();
