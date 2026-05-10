#!/usr/bin/env node
const { InMemoryDataStore } = require('./dist/store/DataStore');
const { ImportService } = require('./dist/services/ImportService');
const { CalculationService } = require('./dist/services/CalculationService');
const { ReportService } = require('./dist/services/ReportService');
const path = require('path');
const fs = require('fs');

async function runTest() {
  console.log('=== 生鲜店损耗盘点 CLI 测试 ===\n');
  
  const store = new InMemoryDataStore();
  const importService = new ImportService(store);
  const calculationService = new CalculationService(store);
  const reportService = new ReportService();
  
  const sampleDataPath = path.resolve(__dirname, 'samples/data.json');
  
  console.log('1. 导入样例数据...');
  const importResult = await importService.importFiles([sampleDataPath]);
  console.log(`   导入结果：成功 ${importResult.imported} 条，跳过 ${importResult.skipped} 条`);
  
  if (importResult.errors.length > 0) {
    console.log('\n   导入错误：');
    importResult.errors.forEach(e => console.log(`   - ${e.message}`));
  }
  
  console.log('\n2. 测试幂等性（重复导入相同数据）...');
  const idempotentResult = await importService.importFiles([sampleDataPath]);
  console.log(`   导入结果：成功 ${idempotentResult.imported} 条，跳过 ${idempotentResult.skipped} 条`);
  console.log(`   幂等性测试：${idempotentResult.skipped === importResult.imported ? '通过' : '失败'}`);
  
  console.log('\n3. 检查异常...');
  const exceptions = calculationService.detectExceptions();
  console.log(`   发现 ${exceptions.length} 个异常：`);
  exceptions.forEach(e => console.log(`   - ${e.code}: ${e.message}`));
  
  console.log('\n4. 商品汇总...');
  const summaries = calculationService.calculateAllProducts();
  console.log(`   共 ${summaries.length} 种商品：`);
  summaries.forEach(s => {
    console.log(`   - ${s.productName} (${s.productCode}): 采购${s.totalPurchased}, 销售${s.totalSold}, 报损${s.totalLoss}, 毛利¥${s.totalGrossProfit.toFixed(2)}`);
  });
  
  console.log('\n5. 批次计算...');
  const batches = calculationService.calculateAllBatches();
  console.log(`   共 ${batches.length} 个批次：`);
  batches.forEach(b => {
    console.log(`   - ${b.productName} 批次 ${b.batchId}: 损耗率${b.lossRate.toFixed(2)}%, 毛利率${b.grossProfitMargin.toFixed(2)}%, 库存差异${b.inventoryDiscrepancy}`);
  });
  
  console.log('\n6. 生成报告...');
  const report = calculationService.generateReport();
  const reportDir = path.resolve(__dirname, 'test-reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  reportService.exportToJson(report, path.join(reportDir, 'report.json'));
  reportService.exportToMarkdown(report, path.join(reportDir, 'report.md'));
  console.log(`   报告已生成到 ${reportDir}/ 目录`);
  
  console.log('\n7. 报告摘要：');
  console.log(`   - 商品种类：${report.summary.totalProducts} 种`);
  console.log(`   - 批次数量：${report.summary.totalBatches} 批`);
  console.log(`   - 总毛利：¥${report.summary.totalGrossProfit.toFixed(2)}`);
  console.log(`   - 综合损耗率：${report.summary.overallLossRate.toFixed(2)}%`);
  console.log(`   - 需要复核：${report.needsReview.batches.length} 个批次`);
  
  console.log('\n=== 测试完成 ===');
  
  return report;
}

runTest().catch(err => {
  console.error('测试失败：', err);
  process.exit(1);
});
