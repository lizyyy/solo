const fs = require('fs');
const path = require('path');
const { Parser } = require('json2csv');

function loadRules(rulesFile) {
  const content = fs.readFileSync(rulesFile, 'utf8');
  return JSON.parse(content);
}

function sortResults(results) {
  return results.sort((a, b) => {
    if (a.sourceFile !== b.sourceFile) {
      return a.sourceFile.localeCompare(b.sourceFile, 'zh-CN');
    }
    if (a.prescriptionId !== b.prescriptionId) {
      return a.prescriptionId.localeCompare(b.prescriptionId, 'zh-CN');
    }
    return a.recordIndex - b.recordIndex;
  });
}

function writeOutput(outputDir, results, verbose) {
  const summaryFile = path.join(outputDir, 'validation_summary.json');
  const detailFile = path.join(outputDir, 'validation_details.csv');
  const statsFile = path.join(outputDir, 'validation_stats.txt');
  
  fs.writeFileSync(summaryFile, JSON.stringify(results, null, 2), 'utf8');
  
  const flatResults = results.map(r => {
    const warnings = r.warnings || [];
    const errors = r.errors || [];
    
    return {
      sourceFile: r.sourceFile,
      prescriptionId: r.prescriptionId,
      patientName: r.patientName,
      status: r.status,
      warningCount: warnings.length,
      errorCount: errors.length,
      warningTypes: warnings.map(w => w.type).join(';'),
      errorTypes: errors.map(e => e.type).join(';'),
      warningMessages: warnings.map(w => w.message).join(' | '),
      errorMessages: errors.map(e => e.message).join(' | ')
    };
  });
  
  if (flatResults.length > 0) {
    const parser = new Parser({
      fields: Object.keys(flatResults[0])
    });
    const csv = parser.parse(flatResults);
    fs.writeFileSync(detailFile, csv, 'utf8');
  }
  
  const stats = calculateStats(results);
  fs.writeFileSync(statsFile, formatStats(stats), 'utf8');
  
  if (verbose) {
    console.log(`输出文件已写入: ${outputDir}`);
    console.log(`  - validation_summary.json`);
    console.log(`  - validation_details.csv`);
    console.log(`  - validation_stats.txt`);
  }
}

function calculateStats(results) {
  const total = results.length;
  const passed = results.filter(r => r.status === 'PASS').length;
  const warned = results.filter(r => r.status === 'WARNING').length;
  const errored = results.filter(r => r.status === 'ERROR').length;
  
  const eyeSwapCount = results.filter(r => 
    r.warnings && r.warnings.some(w => w.type === 'EYE_SWAP')
  ).length;
  
  const axisRangeCount = results.filter(r => 
    r.warnings && r.warnings.some(w => w.type === 'AXIS_RANGE')
  ).length;
  
  const reprocessedCount = results.filter(r => 
    r.warnings && r.warnings.some(w => w.type === 'REPROCESSED')
  ).length;
  
  return {
    total,
    passed,
    warned,
    errored,
    eyeSwapCount,
    axisRangeCount,
    reprocessedCount,
    passRate: total > 0 ? ((passed / total) * 100).toFixed(2) : 0
  };
}

function formatStats(stats) {
  return `眼镜店镜片参数校验统计报告
========================

总体统计:
  - 总记录数: ${stats.total}
  - 通过数: ${stats.passed}
  - 警告数: ${stats.warned}
  - 错误数: ${stats.errored}
  - 通过率: ${stats.passRate}%

警告类型分布:
  - 左右眼颠倒检测: ${stats.eyeSwapCount} 条
  - 轴位范围异常: ${stats.axisRangeCount} 条
  - 重跑数据标记: ${stats.reprocessedCount} 条

说明:
  - PASS: 所有校验通过
  - WARNING: 存在警告（可继续处理，但需关注）
  - ERROR: 存在错误（必须修正）
`;
}

module.exports = {
  loadRules,
  sortResults,
  writeOutput
};
