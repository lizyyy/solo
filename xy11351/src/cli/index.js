#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { initDatabase, PrintBatch } = require('../models');
const importService = require('../services/importService');
const qualityService = require('../services/qualityService');
const queryService = require('../services/queryService');
const exportService = require('../services/exportService');

const args = process.argv.slice(2);
const command = args[0];

async function getBatchId(batchNoOrId) {
  if (batchNoOrId.includes('-') && batchNoOrId.length === 36) {
    return batchNoOrId;
  }
  const batch = await PrintBatch.findOne({ where: { batchNo: batchNoOrId } });
  if (!batch) {
    throw new Error(`找不到批次: ${batchNoOrId}`);
  }
  return batch.id;
}

async function readCsv(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

function printResult(result) {
  console.log('\n=== 导入结果 ===');
  console.log(`总计: ${result.total}`);
  console.log(`成功: ${result.success.length}`);
  console.log(`跳过: ${result.skipped.length}`);
  console.log(`失败: ${result.failed.length}`);
  
  if (result.skipped.length > 0) {
    console.log('\n已跳过的记录:');
    result.skipped.forEach(item => {
      console.log(`  - ${item.batchNo || item.index}: ${item.reason}`);
    });
  }
  
  if (result.failed.length > 0) {
    console.log('\n失败的记录:');
    result.failed.forEach(item => {
      console.log(`  - 索引 ${item.index}: ${item.error || item.errors?.map(e => e.message).join(', ')}`);
    });
  }
  console.log('');
}

async function main() {
  await initDatabase();

  switch (command) {
    case 'import:paper': {
      const filePath = args[1];
      if (!filePath) {
        console.log('用法: npm run cli import:paper <csv文件路径>');
        process.exit(1);
      }
      const data = await readCsv(filePath);
      const result = await importService.importPaperBatches(data, 'cli');
      printResult(result);
      break;
    }
    
    case 'import:print': {
      const filePath = args[1];
      if (!filePath) {
        console.log('用法: npm run cli import:print <csv文件路径>');
        process.exit(1);
      }
      const data = await readCsv(filePath);
      const result = await importService.importPrintBatches(data, 'cli');
      printResult(result);
      break;
    }
    
    case 'import:lab': {
      const filePath = args[1];
      if (!filePath) {
        console.log('用法: npm run cli import:lab <csv文件路径>');
        process.exit(1);
      }
      const data = await readCsv(filePath);
      const result = await importService.importLabRecords(data, 'cli');
      printResult(result);
      break;
    }
    
    case 'quality:determine': {
      const batchNoOrId = args[1];
      if (!batchNoOrId) {
        console.log('用法: npm run cli quality:determine <批次号/批次ID>');
        process.exit(1);
      }
      const batchId = await getBatchId(batchNoOrId);
      const result = await qualityService.determineQuality(batchId, 'cli');
      console.log('\n质量判定结果:');
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    
    case 'quality:review': {
      const batchNoOrId = args[1];
      const reviewResult = args[2] || 'pass';
      if (!batchNoOrId) {
        console.log('用法: npm run cli quality:review <批次号/批次ID> [pass|fail]');
        process.exit(1);
      }
      const batchId = await getBatchId(batchNoOrId);
      const result = await qualityService.reviewQuality(batchId, 'cli', reviewResult);
      console.log('\n复核结果:');
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    
    case 'quality:order': {
      const batchNoOrId = args[1];
      if (!batchNoOrId) {
        console.log('用法: npm run cli quality:order <批次号/批次ID>');
        process.exit(1);
      }
      const batchId = await getBatchId(batchNoOrId);
      const result = await qualityService.generateQualityOrder(batchId, 'cli');
      console.log('\n质检单已生成:');
      console.log(`单号: ${result.orderNo}`);
      console.log(`批次: ${result.printBatchNo}`);
      console.log(`结论: ${result.conclusion}`);
      break;
    }
    
    case 'quality:trends': {
      const result = await qualityService.getQualityTrends();
      console.log('\n质量趋势:');
      console.log(`总批次: ${result.summary.totalBatches}`);
      console.log(`已通过: ${result.summary.approvedCount}`);
      console.log(`已驳回: ${result.summary.rejectedCount}`);
      console.log(`返工次数: ${result.summary.reworkedCount}`);
      console.log(`平均合格率: ${result.summary.avgPassRate}%`);
      console.log('\n质量分布:');
      Object.entries(result.summary.qualityDistribution).forEach(([level, count]) => {
        console.log(`  ${level}: ${count}`);
      });
      break;
    }
    
    case 'export:excel': {
      const outputPath = args[1] || `质检报告_${new Date().toISOString().slice(0, 10)}.xlsx`;
      const buffer = await exportService.exportToExcel({});
      fs.writeFileSync(outputPath, buffer);
      console.log(`报告已导出: ${outputPath}`);
      break;
    }
    
    case 'export:csv': {
      const outputPath = args[1] || `质检报告_${new Date().toISOString().slice(0, 10)}.csv`;
      const csv = await exportService.exportToCsv({});
      fs.writeFileSync(outputPath, '\uFEFF' + csv);
      console.log(`报告已导出: ${outputPath}`);
      break;
    }
    
    case 'list:batches': {
      const result = await queryService.queryPrintBatches({ pageSize: 100 });
      console.log(`\n共 ${result.total} 个印刷批次:\n`);
      result.data.forEach(batch => {
        console.log(`${batch.batchNo} | ${batch.productName} | 状态:${batch.status} | 质量:${batch.qualityLevel || '-'}`);
      });
      break;
    }
    
    case 'server': {
      require('../index');
      break;
    }
    
    case 'help':
    default: {
      console.log(`
印刷车间品控系统 - 命令行工具

用法:
  npm run cli <命令> [参数]

命令:
  import:paper <csv文件>       导入纸张批次数据
  import:print <csv文件>         导入印刷批次数据
  import:lab <csv文件>           导入Lab检测记录
  
  quality:determine <批次ID>    执行质量判定
  quality:review <批次ID>      执行复核 (pass/fail)
  quality:order <批次ID>       生成质检单
  quality:trends                 查看质量趋势
  
  list:batches                    列出印刷批次
  
  export:excel [输出路径]       导出Excel报告
  export:csv [输出路径]         导出CSV报告
  
  server                           启动API服务
  help                             显示帮助信息

示例CSV格式:
  纸张批次: batchNo,paperType,supplier,weight,receiveDate,quantity
  印刷批次: batchNo,productName,paperBatchNo,printDate,quantity,targetL,targetA,targetB,responsible
  Lab记录: printBatchNo,samplePoint,measureL,measureA,measureB,measureTime,measuredBy
`);
    }
  }
  
  process.exit(0);
}

main().catch(error => {
  console.error('错误:', error.message);
  process.exit(1);
});
