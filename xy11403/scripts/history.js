const { BatchService } = require('../src/services/batchService');
const { HistoryService } = require('../src/services/exportService');

const command = process.argv[2];
const batchId = process.argv[3] ? parseInt(process.argv[3]) : null;

console.log('========================================');
console.log('冷链中转验收 - 历史查询工具');
console.log('========================================\n');

const printBatch = (batch) => {
  console.log(`批次号: ${batch.batch_no}`);
  console.log(`  状态: ${batch.status}`);
  console.log(`  司机: ${batch.driver_name}`);
  console.log(`  提交时间: ${batch.created_at}`);
  console.log(`  提交人: ${batch.submit_by}`);
  console.log(`  冻结状态: ${batch.frozen ? '已冻结' : '未冻结'}`);
  console.log();
};

const printHistory = (history) => {
  console.log(`\n操作历史记录 (共 ${history.length} 条):`);
  console.log('-'.repeat(80));
  history.forEach((h, i) => {
    console.log(`${i + 1}. [${h.created_at}] ${h.operation_type}${h.operation_subtype ? '/' + h.operation_subtype : ''} - ${h.operator}`);
    console.log(`   备注: ${h.remark || '-'}`);
    if (h.before_data && Object.keys(h.before_data).length) {
      console.log(`   变更前: ${JSON.stringify(h.before_data)}`);
    }
    if (h.after_data && Object.keys(h.after_data).length) {
      console.log(`   变更后: ${JSON.stringify(h.after_data)}`);
    }
    console.log();
  });
};

const showAllBatches = () => {
  const batches = BatchService.getAllBatches();
  console.log(`\n所有批次列表 (共 ${batches.length} 个):`);
  console.log('-'.repeat(80));
  batches.forEach(batch => printBatch(batch));
};

const showBatchDetail = (batchId) => {
  const detail = BatchService.getBatchDetail(batchId);
  if (!detail) {
    console.log('批次不存在！');
    return;
  }

  console.log('批次详情:');
  console.log('-'.repeat(80));
  printBatch(detail.batch);

  console.log(`箱号列表 (共 ${detail.boxes.length} 个):`);
  detail.boxes.forEach(box => {
    const flags = [];
    if (box.is_renamed) flags.push('改名');
    if (box.is_cross_day) flags.push('跨日');
    if (box.temperature_abnormal) flags.push('温度异常');
    console.log(`  ${box.box_no}: 赔付¥${box.compensation_amount} ${flags.join('|') || '正常'}`);
  });

  if (detail.reconciliation) {
    console.log(`\n对账结果:`);
    console.log(`  总箱数: ${detail.reconciliation.total_boxes}`);
    console.log(`  正常箱数: ${detail.reconciliation.normal_boxes}`);
    console.log(`  改名箱数: ${detail.reconciliation.renamed_boxes}`);
    console.log(`  跨日箱数: ${detail.reconciliation.cross_day_boxes}`);
    console.log(`  温度异常: ${detail.reconciliation.temperature_abnormal_boxes}`);
    console.log(`  总赔付: ¥${detail.reconciliation.total_compensation}`);
  }

  printHistory(detail.operation_history);
};

const showAllHistory = () => {
  const history = HistoryService.getAllHistory();
  printHistory(history);
};

if (!command || command === 'list') {
  showAllBatches();
} else if (command === 'detail' && batchId) {
  showBatchDetail(batchId);
} else if (command === 'history') {
  if (batchId) {
    const history = HistoryService.getOperationHistory(batchId);
    printHistory(history);
  } else {
    showAllHistory();
  }
} else if (command === 'summary' && batchId) {
  const summary = HistoryService.getHistorySummary(batchId);
  console.log('操作汇总:');
  summary.forEach(s => {
    console.log(`  ${s.operation_type}: ${s.count}次 (最后: ${s.last_time})`);
    console.log(`    操作人: ${s.operators.join(', ')}`);
  });
} else {
  console.log('使用方法:');
  console.log('  node scripts/history.js list           - 列出所有批次');
  console.log('  node scripts/history.js detail <id>    - 查看批次详情');
  console.log('  node scripts/history.js history        - 查看全部操作历史');
  console.log('  node scripts/history.js history <id>   - 查看指定批次历史');
  console.log('  node scripts/history.js summary <id>   - 查看操作汇总');
}

console.log('========================================\n');
