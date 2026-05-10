const fs = require('fs');
const path = require('path');
const { formatDate, now, logSuccess, logInfo } = require('../utils');
const store = require('../store');

function inventorySummary(storeType = 'pending') {
  const inventory = store.computeCurrentInventory(storeType);
  const specs = store.getSpecs(storeType);

  console.log('\n当前库存汇总:');
  console.log('='.repeat(60));

  inventory.forEach(inv => {
    const spec = specs.find(s => s.id === inv.specId);
    const name = spec ? spec.name : '未知规格';
    const unit = spec ? spec.unit : '';
    console.log(`  ${inv.specId} - ${name}: ${inv.quantity}${unit}`);
  });

  console.log('='.repeat(60));
  return inventory;
}

function transactionSummary(storeType = 'pending', options = {}) {
  const transactions = store.getTransactions(storeType);

  let filtered = transactions;
  if (options.startDate) {
    filtered = filtered.filter(t => t.importedAt >= options.startDate);
  }
  if (options.endDate) {
    filtered = filtered.filter(t => t.importedAt <= options.endDate);
  }

  const summary = {
    total: filtered.length,
    byType: {
      issue: 0,
      refund: 0,
      reissue: 0,
      inventory_check: 0
    },
    totalQuantity: 0,
    bySpec: {}
  };

  filtered.forEach(t => {
    if (summary.byType[t.type] !== undefined) {
      summary.byType[t.type]++;
    }
    summary.totalQuantity += t.quantity;

    if (!summary.bySpec[t.specId]) {
      summary.bySpec[t.specId] = { issue: 0, refund: 0, reissue: 0, inventory_check: 0, net: 0 };
    }
    summary.bySpec[t.specId][t.type] = (summary.bySpec[t.specId][t.type] || 0) + 1;
    summary.bySpec[t.specId].net += t.quantity;
  });

  console.log('\n交易汇总:');
  console.log('='.repeat(60));
  console.log(`  总交易数: ${summary.total}`);
  console.log(`  发放: ${summary.byType.issue}`);
  console.log(`  退费: ${summary.byType.refund}`);
  console.log(`  补发: ${summary.byType.reissue}`);
  console.log(`  盘点调整: ${summary.byType.inventory_check}`);
  console.log('='.repeat(60));

  return summary;
}

function generateDiffReport(storeType = 'pending', outputPath) {
  const specs = store.getSpecs(storeType);
  const transactions = store.getTransactions(storeType);
  const inventory = store.computeCurrentInventory(storeType);

  const inventoryChecks = transactions.filter(t => t.type === 'inventory_check');

  const report = {
    generatedAt: now(),
    generatedAtFormatted: formatDate(now()),
    summary: {
      totalSpecs: specs.length,
      totalTransactions: transactions.length,
      lastInventoryCheck: inventoryChecks.length > 0 ? Math.max(...inventoryChecks.map(t => t.importedAt)) : null
    },
    specs: [],
    diffs: []
  };

  specs.forEach(spec => {
    const specTransactions = transactions.filter(t => t.specId === spec.id);
    const inv = inventory.find(i => i.specId === spec.id);
    const currentQty = inv ? inv.quantity : 0;

    const issues = specTransactions.filter(t => t.type === 'issue');
    const refunds = specTransactions.filter(t => t.type === 'refund');
    const reissues = specTransactions.filter(t => t.type === 'reissue');
    const checks = specTransactions.filter(t => t.type === 'inventory_check');

    const totalIssued = issues.reduce((sum, t) => sum + Math.abs(t.quantity), 0);
    const totalRefunded = refunds.reduce((sum, t) => sum + t.quantity, 0);
    const totalReissued = reissues.reduce((sum, t) => sum + Math.abs(t.quantity), 0);
    const totalAdjusted = checks.reduce((sum, t) => sum + t.quantity, 0);

    const expectedInventory = totalRefunded + totalAdjusted - totalIssued - totalReissued;
    const diff = currentQty - expectedInventory;

    report.specs.push({
      specId: spec.id,
      specName: spec.name,
      unit: spec.unit,
      currentInventory: currentQty,
      totalIssued,
      totalRefunded,
      totalReissued,
      totalAdjusted,
      expectedInventory,
      diff
    });

    if (diff !== 0) {
      report.diffs.push({
        specId: spec.id,
        specName: spec.name,
        unit: spec.unit,
        expectedInventory,
        actualInventory: currentQty,
        diff,
        severity: Math.abs(diff) > 10 ? 'high' : Math.abs(diff) > 5 ? 'medium' : 'low'
      });
    }
  });

  if (outputPath) {
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');
    logSuccess(`差异报告已生成: ${outputPath}`);
  } else {
    console.log('\n库存差异报告:');
    console.log('='.repeat(80));
    console.log(`生成时间: ${report.generatedAtFormatted}`);
    console.log('='.repeat(80));

    if (report.diffs.length === 0) {
      console.log('✅ 所有规格库存无差异');
    } else {
      console.log(`发现 ${report.diffs.length} 个差异项:\n`);
      report.diffs.forEach((d, idx) => {
        const severityColor = d.severity === 'high' ? '🔴' : d.severity === 'medium' ? '🟡' : '🟢';
        console.log(`${idx + 1}. ${severityColor} [${d.specId}] ${d.specName}`);
        console.log(`   期望库存: ${d.expectedInventory}${d.unit}`);
        console.log(`   实际库存: ${d.actualInventory}${d.unit}`);
        console.log(`   差异: ${d.diff > 0 ? '+' : ''}${d.diff}${d.unit}`);
        console.log();
      });
    }
    console.log('='.repeat(80));
  }

  return report;
}

function exportDiffCsv(storeType, outputPath) {
  const report = generateDiffReport(storeType);

  let csv = '规格ID,规格名称,单位,期望库存,实际库存,差异,严重程度\n';
  report.diffs.forEach(d => {
    csv += `"${d.specId}","${d.specName}","${d.unit}",${d.expectedInventory},${d.actualInventory},${d.diff},"${d.severity}"\n`;
  });

  const finalPath = outputPath || path.join(process.cwd(), `inventory_diff_${Date.now()}.csv`);
  fs.writeFileSync(finalPath, csv, 'utf8');
  logSuccess(`差异报告CSV已导出: ${finalPath}`);

  return finalPath;
}

function studentReport(studentId, storeType = 'pending') {
  const transactions = store.getTransactionsByStudent(storeType, studentId);
  const specs = store.getSpecs(storeType);

  if (transactions.length === 0) {
    logInfo(`未找到学生[${studentId}]的交易记录`);
    return [];
  }

  const summary = {};
  transactions.forEach(t => {
    const spec = specs.find(s => s.id === t.specId);
    const name = spec ? spec.name : '未知';
    const unit = spec ? spec.unit : '';

    if (!summary[t.specId]) {
      summary[t.specId] = { name, unit, issue: 0, refund: 0, reissue: 0, net: 0 };
    }
    summary[t.specId].net += t.quantity;

    if (t.type === 'issue') summary[t.specId].issue += Math.abs(t.quantity);
    if (t.type === 'refund') summary[t.specId].refund += t.quantity;
    if (t.type === 'reissue') summary[t.specId].reissue += Math.abs(t.quantity);
  });

  console.log(`\n学生[${studentId}]用纸汇总:`);
  console.log('='.repeat(60));
  Object.values(summary).forEach(s => {
    console.log(`  ${s.name}:`);
    console.log(`    发放: ${s.issue}${s.unit}`);
    console.log(`    退费: ${s.refund}${s.unit}`);
    console.log(`    补发: ${s.reissue}${s.unit}`);
    console.log(`    净消耗: ${s.issue + s.reissue - s.refund}${s.unit}`);
  });
  console.log('='.repeat(60));

  return summary;
}

module.exports = {
  inventorySummary,
  transactionSummary,
  generateDiffReport,
  exportDiffCsv,
  studentReport
};
