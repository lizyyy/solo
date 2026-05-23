const fs = require('fs');

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function color(color, text) {
  return COLORS[color] + text + COLORS.reset;
}

function outputResults(data) {
  const { statistics, rejectedRecords, badRows, unmatchedArrival, unmatchedTemperature } = data;
  const { summary } = statistics;

  console.log('\n' + color('bright', '📊 检查结果摘要'));
  console.log('  ──────────────────────────────────────');
  console.log(`  处理批次总数: ${summary.totalProcessed}`);
  console.log(`  ${color('red', '拒收批次:')} ${summary.totalRejected} (${summary.rejectionRate}%)`);
  console.log(`  ${color('green', '通过批次:')} ${summary.totalAccepted}`);
  console.log(`  ${color('yellow', '异常样本:')} ${summary.totalAnomalies}`);
  console.log(`  ${color('red', '坏记录数:')} ${summary.totalBadRows}`);
  console.log(`  拒收数量: ${summary.rejectedQuantity} / ${summary.totalQuantity}`);
  console.log('  ──────────────────────────────────────\n');

  if (rejectedRecords.length > 0) {
    console.log(color('red', color('bright', '❌ 拒收批次详情:')));
    console.log('  ──────────────────────────────────────');
    for (const record of rejectedRecords.slice(0, 10)) {
      console.log(`  批次: ${color('yellow', record.batchId)}`);
      console.log(`    供应商: ${record.supplier}`);
      console.log(`    品类: ${record.category}`);
      console.log(`    数量: ${record.quantity}`);
      console.log(`    最高温度: ${color('red', record.temperature.max + '℃')}`);
      console.log(`    原因: ${record.rejectionReason}`);
      console.log(`    原始行: 到货单 ${record._arrivalRow}, 温度记录 ${record._temperatureRows.join(', ')}`);
      console.log('');
    }
    if (rejectedRecords.length > 10) {
      console.log(`  ...还有 ${rejectedRecords.length - 10} 条拒收记录，请查看完整报告\n`);
    }
  }

  if (badRows.length > 0) {
    console.log(color('red', color('bright', '⚠️  坏记录详情 (保留原始位置):')));
    console.log('  ──────────────────────────────────────');
    for (const row of badRows.slice(0, 5)) {
      console.log(`  来源: ${row._fileType === 'arrival' ? '到货单' : '温度记录'}`);
      console.log(`    原始行号: ${row._originalRow}`);
      console.log(`    错误: ${row._validationErrors.join('; ')}`);
      console.log('');
    }
    if (badRows.length > 5) {
      console.log(`  ...还有 ${badRows.length - 5} 条坏记录，请查看完整报告\n`);
    }
  }

  if (unmatchedArrival.length > 0 || unmatchedTemperature.length > 0) {
    console.log(color('yellow', color('bright', '🔍 未匹配记录:')));
    console.log('  ──────────────────────────────────────');
    if (unmatchedArrival.length > 0) {
      console.log(`  未匹配到货单: ${unmatchedArrival.length} 条`);
      for (const record of unmatchedArrival.slice(0, 3)) {
        console.log(`    批次 ${record.batchId} (行 ${record._originalRow})`);
      }
    }
    if (unmatchedTemperature.length > 0) {
      console.log(`  未匹配温度记录: ${unmatchedTemperature.length} 条`);
      for (const record of unmatchedTemperature.slice(0, 3)) {
        console.log(`    批次 ${record.batchId} (行 ${record._originalRow})`);
      }
    }
    console.log('');
  }

  console.log(color('bright', '📈 供应商拒收排行 (Top 5):'));
  console.log('  ──────────────────────────────────────');
  for (const supplier of statistics.topRejectedSuppliers) {
    console.log(`  ${supplier.supplier}: ${supplier.rejected}/${supplier.total} 拒收 (${supplier.rejectionRate}%)`);
  }
  console.log('');
}

async function outputJSON(data, filePath) {
  const jsonOutput = JSON.stringify(data, null, 2);
  fs.writeFileSync(filePath, jsonOutput, 'utf8');
}

async function outputMarkdownReport(data, filePath) {
  const { statistics, rejectedRecords, anomalyRecords, badRows, unmatchedArrival, unmatchedTemperature, runTime, threshold } = data;
  const { summary } = statistics;

  let md = '# 生鲜到货温度检查报告\n\n';
  md += `**生成时间**: ${new Date(runTime).toLocaleString('zh-CN')}\n\n`;
  md += `**拒收阈值**: ${threshold}℃\n\n`;

  md += '## 📊 概览统计\n\n';
  md += '| 指标 | 数值 |\n';
  md += '|------|------|\n';
  md += `| 处理批次总数 | ${summary.totalProcessed} |\n`;
  md += `| 拒收批次 | ${summary.totalRejected} (${summary.rejectionRate}%) |\n`;
  md += `| 通过批次 | ${summary.totalAccepted} |\n`;
  md += `| 异常样本数 | ${summary.totalAnomalies} |\n`;
  md += `| 坏记录数 | ${summary.totalBadRows} |\n`;
  md += `| 拒收数量 | ${summary.rejectedQuantity} / ${summary.totalQuantity} |\n\n`;

  md += '## ❌ 拒收批次详情\n\n';
  if (rejectedRecords.length === 0) {
    md += '无拒收批次\n\n';
  } else {
    md += '| 批次号 | 供应商 | 品类 | 数量 | 最高温度 | 到货单行号 | 温度记录行号 | 拒收原因 |\n';
    md += '|--------|--------|------|------|----------|------------|--------------|----------|\n';
    for (const record of rejectedRecords) {
      md += `| ${record.batchId} | ${record.supplier} | ${record.category} | ${record.quantity} | ${record.temperature.max}℃ | ${record._arrivalRow} | ${record._temperatureRows.join(', ')} | ${record.rejectionReason} |\n`;
    }
    md += '\n';
  }

  md += '## ⚠️ 异常样本详情 (保留原始位置)\n\n';
  if (anomalyRecords.length === 0) {
    md += '无异常样本\n\n';
  } else {
    md += '| 批次号 | 供应商 | 品类 | 温度 | 测量时间 | 测量点 | 原始行号 |\n';
    md += '|--------|--------|------|------|----------|--------|----------|\n';
    for (const anomaly of anomalyRecords) {
      md += `| ${anomaly.batchId} | ${anomaly.supplier} | ${anomaly.category} | ${anomaly.temperature}℃ | ${anomaly.measureTime} | ${anomaly.measurePoint} | ${anomaly._originalRow} |\n`;
    }
    md += '\n';
  }

  md += '## 📈 供应商统计\n\n';
  md += '| 供应商 | 总批次 | 拒收 | 通过 | 拒收率 | 总数量 | 拒收数量 | 涉及品类 |\n';
  md += '|--------|--------|------|------|--------|--------|----------|----------|\n';
  for (const [supplier, stats] of Object.entries(statistics.bySupplier)) {
    md += `| ${supplier} | ${stats.total} | ${stats.rejected} | ${stats.accepted} | ${stats.rejectionRate}% | ${stats.totalQuantity} | ${stats.rejectedQuantity} | ${stats.categories.join(', ')} |\n`;
  }
  md += '\n';

  md += '## 🏷️ 品类统计\n\n';
  md += '| 品类 | 总批次 | 拒收 | 通过 | 拒收率 |\n';
  md += '|------|--------|------|------|--------|\n';
  for (const [category, stats] of Object.entries(statistics.byCategory)) {
    md += `| ${category} | ${stats.total} | ${stats.rejected} | ${stats.accepted} | ${stats.rejectionRate}% |\n`;
  }
  md += '\n';

  md += '## ❗ 坏记录详情 (保留原始位置)\n\n';
  if (badRows.length === 0) {
    md += '无坏记录\n\n';
  } else {
    md += '| 来源文件 | 原始行号 | 错误信息 |\n';
    md += '|----------|----------|----------|\n';
    for (const row of badRows) {
      md += `| ${row._fileType === 'arrival' ? '到货单' : '温度记录'} | ${row._originalRow} | ${row._validationErrors.join('; ')} |\n`;
    }
    md += '\n';
  }

  md += '## 🔍 未匹配记录\n\n';
  if (unmatchedArrival.length === 0 && unmatchedTemperature.length === 0) {
    md += '全部匹配成功\n\n';
  } else {
    if (unmatchedArrival.length > 0) {
      md += '### 未匹配到货单\n\n';
      md += '| 批次号 | 供应商 | 品类 | 原始行号 |\n';
      md += '|--------|--------|------|----------|\n';
      for (const record of unmatchedArrival) {
        md += `| ${record.batchId || '-'} | ${record.supplier || '-'} | ${record.category || '-'} | ${record._originalRow} |\n`;
      }
      md += '\n';
    }
    if (unmatchedTemperature.length > 0) {
      md += '### 未匹配温度记录\n\n';
      md += '| 批次号 | 温度 | 原始行号 |\n';
      md += '|--------|------|----------|\n';
      for (const record of unmatchedTemperature) {
        md += `| ${record.batchId || '-'} | ${record.temperature || '-'} | ${record._originalRow} |\n`;
      }
      md += '\n';
    }
  }

  fs.writeFileSync(filePath, md, 'utf8');
}

module.exports = {
  outputResults,
  outputJSON,
  outputMarkdownReport
};