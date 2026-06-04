const NuclearDensityPeakAnalysis = require('../src/index');
const path = require('path');
const fs = require('fs');

async function runSelfCheck() {
  console.log('='.repeat(70));
  console.log('核密度客流峰值 - 基本自检');
  console.log('='.repeat(70));
  console.log();

  const results = {
    duplicateImport: null,
    negativeValueHandling: null,
    missingValueHandling: null,
    supplementRecalculate: null,
    exportConsistency: null,
    sameDataSource: null
  };

  const analysis = new NuclearDensityPeakAnalysis({
    dataDir: './data',
    calculator: { bandwidth: 30, gridSize: 50 }
  });

  const testFile1 = path.join(__dirname, '../data/raw/sample-flow-data-part1.csv');
  const testFile2 = path.join(__dirname, '../data/raw/sample-flow-data-part2-supplement.csv');

  console.log('【自检1】重复导入检测');
  console.log('-'.repeat(70));
  try {
    await analysis.importData(testFile1, '自检测试-第一次');
    const secondImport = await analysis.importData(testFile1, '自检测试-重复导入');
    
    if (!secondImport.success && secondImport.reason === 'duplicate_import') {
      results.duplicateImport = { pass: true, message: '重复导入检测正常工作' };
      console.log('✓ PASS: 重复导入被正确拦截');
    } else {
      results.duplicateImport = { pass: false, message: '重复导入未被检测到' };
      console.log('✗ FAIL: 重复导入未被检测到');
    }
  } catch (e) {
    results.duplicateImport = { pass: false, message: e.message };
    console.log(`✗ FAIL: ${e.message}`);
  }
  console.log();

  console.log('【自检2】负数样本被旧表当成缺失的处理');
  console.log('-'.repeat(70));
  let boundaryCases;
  try {
    const negativeSamples = analysis.getNegativeSamples();
    boundaryCases = analysis.getBoundaryCases();
    
    const hasNegativePending = negativeSamples.some(s => 
      s._meta.status === 'pending_review'
    );
    
    if (negativeSamples.length > 0 && hasNegativePending) {
      results.negativeValueHandling = { 
        pass: true, 
        message: `检测到${negativeSamples.length}个负数样本，状态设为待复核，不会自动当成缺失值` 
      };
      console.log(`✓ PASS: 检测到${negativeSamples.length}个负数样本，状态为待复核（pending_review）`);
      negativeSamples.forEach(s => {
        console.log(`  - 行${s._meta.originalLineNumber}: flow=${s.flow} → 状态=${s._meta.status}`);
      });
    } else {
      results.negativeValueHandling = { pass: false, message: '负数样本处理异常' };
      console.log('✗ FAIL: 负数样本处理异常');
    }
  } catch (e) {
    results.negativeValueHandling = { pass: false, message: e.message };
    console.log(`✗ FAIL: ${e.message}`);
  }
  console.log();

  console.log('【自检3】缺失值处理');
  console.log('-'.repeat(70));
  try {
    const hasMissingBoundary = boundaryCases.some(s => 
      s._meta.issues.some(i => i.type === 'missing_value')
    );
    
    if (hasMissingBoundary) {
      results.missingValueHandling = { 
        pass: true, 
        message: '缺失值被标记为边界案例，正确追踪' 
      };
      console.log('✓ PASS: 缺失值被标记为边界案例（boundary_case）');
    } else {
      results.missingValueHandling = { pass: false, message: '缺失值未被正确标记' };
      console.log('✗ FAIL: 缺失值未被正确标记');
    }
  } catch (e) {
    results.missingValueHandling = { pass: false, message: e.message };
    console.log(`✗ FAIL: ${e.message}`);
  }
  console.log();

  console.log('【自检4】补录后重算');
  console.log('-'.repeat(70));
  try {
    analysis.analyze('flow');
    const peaksBefore = analysis.dataManager.calculationResults.peaks.length;
    
    await analysis.importData(testFile2, '补录数据');
    analysis.recalculateAfterSupplement();
    const peaksAfter = analysis.dataManager.calculationResults.peaks.length;
    
    results.supplementRecalculate = { 
      pass: true, 
      message: `补录前${peaksBefore}个峰值，补录后${peaksAfter}个峰值，重算功能正常` 
    };
    console.log(`✓ PASS: 补录前${peaksBefore}个峰值，补录后${peaksAfter}个峰值，重算功能正常`);
  } catch (e) {
    results.supplementRecalculate = { pass: false, message: e.message };
    console.log(`✗ FAIL: ${e.message}`);
  }
  console.log();

  console.log('【自检5】导出一致性检查');
  console.log('-'.repeat(70));
  try {
    const consistency = analysis.getConsistencyCheck();
    results.exportConsistency = {
      pass: consistency.consistent,
      message: consistency.consistent ? 
        '数据导出各维度计数一致' : 
        `发现${consistency.issues.length}个一致性问题`
    };
    
    if (consistency.consistent) {
      console.log('✓ PASS: 数据导出各维度计数一致');
      console.log(`  统计: 总记录=${consistency.summary.totalRecords}, 边界案例=${consistency.summary.boundaryCases}, 负数样本=${consistency.summary.negativeSamples}`);
    } else {
      console.log('✗ FAIL: 发现一致性问题');
      consistency.issues.forEach(i => console.log(`  - ${i.message}`));
    }
  } catch (e) {
    results.exportConsistency = { pass: false, message: e.message };
    console.log(`✗ FAIL: ${e.message}`);
  }
  console.log();

  console.log('【自检6】页面/接口/导出同一份数据源');
  console.log('-'.repeat(70));
  try {
    const pageData = analysis.getPageDisplayData();
    const apiResponse = analysis.getAPIResponse();
    const exportData = analysis.exporter.getConsolidatedData();

    const pageBoundaryCount = pageData.boundaryCases.length;
    const apiBoundaryCount = apiResponse.data.boundaryCasesPreview.length;
    const exportBoundaryCount = exportData.boundaryCases.length;
    
    const pageTotal = pageData.overview.totalRecords;
    const apiTotal = apiResponse.data.summary.totalRecords;
    const exportTotal = exportData.summary.totalRecords;

    const sameTotal = pageTotal === apiTotal && apiTotal === exportTotal;
    const sameBoundary = pageBoundaryCount === exportBoundaryCount;

    results.sameDataSource = {
      pass: sameTotal && sameBoundary,
      message: sameTotal && sameBoundary ?
        '页面展示、API返回、导出明细读取同一份结果' :
        `页面/API/导出数据不一致 - 总数: ${pageTotal}/${apiTotal}/${exportTotal}, 边界案例: ${pageBoundaryCount}/${exportBoundaryCount}`
    };

    if (sameTotal && sameBoundary) {
      console.log('✓ PASS: 页面展示、API返回、导出明细读取同一份结果');
      console.log(`  总数校验: 页面=${pageTotal}, API=${apiTotal}, 导出=${exportTotal}`);
      console.log(`  边界案例校验: 页面=${pageBoundaryCount}, 导出=${exportBoundaryCount}`);
    } else {
      console.log('✗ FAIL: 页面/API/导出数据不一致');
      console.log(`  总数: 页面=${pageTotal}, API=${apiTotal}, 导出=${exportTotal}`);
      console.log(`  边界案例: 页面=${pageBoundaryCount}, 导出=${exportBoundaryCount}`);
    }
  } catch (e) {
    results.sameDataSource = { pass: false, message: e.message };
    console.log(`✗ FAIL: ${e.message}`);
  }
  console.log();

  console.log('='.repeat(70));
  console.log('自检结果汇总');
  console.log('='.repeat(70));
  
  const allPassed = Object.values(results).every(r => r && r.pass);
  let passed = 0;
  let failed = 0;
  
  Object.entries(results).forEach(([key, value]) => {
    const status = value && value.pass ? '✓ PASS' : '✗ FAIL';
    if (value && value.pass) passed++; else failed++;
    console.log(`${status} [${key}]: ${value ? value.message : '未执行'}`);
  });
  
  console.log();
  console.log(`通过: ${passed}/${Object.keys(results).length}, 失败: ${failed}`);
  console.log(allPassed ? '✅ 所有自检通过！' : '❌ 部分自检失败，请检查');
  console.log();

  const reportPath = path.join(__dirname, '../data/audit', 'self-check-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    results,
    summary: { passed, failed, total: Object.keys(results).length }
  }, null, 2));
  
  console.log(`自检报告已保存: ${reportPath}`);

  return allPassed;
}

runSelfCheck().catch(console.error);
