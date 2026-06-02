import { PerformanceAttributionService } from '../services/PerformanceAttributionService';
import { RawTradeRecord } from '../core/TradeRecordFactory';

console.log('=== 交易员绩效归因报表 - 风控系统 演示 ===\n');

const testRecords: RawTradeRecord[] = [
  {
    tradeDate: '2024-06-03',
    traderId: 'TRADER001',
    instrumentId: '600519',
    instrumentName: '贵州茅台',
    quantity: 1000,
    amount: 0,
    remark: '已冲正-尾差调整',
    originalLineNumber: 15
  },
  {
    tradeDate: '2024-06-03',
    traderId: 'TRADER001',
    instrumentId: '000001',
    instrumentName: '平安银行',
    quantity: 5000,
    amount: 52300.50,
    remark: '正常交易',
    originalLineNumber: 16
  },
  {
    tradeDate: '2024-06-03',
    traderId: 'TRADER002',
    instrumentId: '601318',
    instrumentName: '中国平安',
    quantity: 2000,
    amount: 0,
    remark: '冲销-系统原因',
    originalLineNumber: 23
  }
];

console.log('第一步：老秦导入交易记录...');
const importResult = PerformanceAttributionService.importRecords(testRecords, '风控值班-老秦');
console.log(`  导入成功: ${importResult.importedCount} 条`);
console.log(`  检测到金额为0待冲正: ${importResult.zeroWithReversalCount} 条`);

const zeroRecords = PerformanceAttributionService.getZeroWithReversalRecords('2024-06-03');
console.log(`  待冲正记录列表:`);
zeroRecords.forEach(r => {
  console.log(`    - ${r.instrumentName}: 金额${r.amount}, 状态: ${r.status}, 原始行号: ${r.tailDiffAdjustment?.originalLineNumber}`);
});

console.log('\n第二步：老秦补看托管确认页，提交复核...');
const firstZeroRecord = zeroRecords[0];
console.log(`  对记录 ${firstZeroRecord.instrumentName} 提交复核，托管页: C-20240603-042`);
PerformanceAttributionService.submitForReview(firstZeroRecord.id, '风控值班-老秦', 'C-20240603-042');

const pendingReview = PerformanceAttributionService.getPendingReviewRecords('2024-06-03');
console.log(`  当前待复核: ${pendingReview.length} 条`);

console.log('\n第三步：风控同事小张复核...');
console.log(`  调整 ${firstZeroRecord.instrumentName} 金额为 1250.35`);
PerformanceAttributionService.reviewWithAdjustment(
  firstZeroRecord.id,
  '风控复核-小张',
  1250.35,
  '核对托管确认页C-20240603-042，确认应为1250.35'
);

const updatedRecord = PerformanceAttributionService.getRecordDetail(firstZeroRecord.id);
console.log(`  调整后金额: ${updatedRecord?.amount}`);
console.log(`  人工改动: ${updatedRecord?.tailDiffAdjustment?.manualChange}`);
console.log(`  当前状态: ${updatedRecord?.status}`);

console.log('\n查看审计日志:');
const auditTrail = PerformanceAttributionService.getAuditTrail(firstZeroRecord.id);
auditTrail.forEach((log, i) => {
  console.log(`  ${i + 1}. [${log.时间}] ${log.操作人}: ${log.动作} - ${log.备注}`);
});

console.log('\n纳入负责人摘要...');
PerformanceAttributionService.markAsSummarized(firstZeroRecord.id, '风控复核-小张');

const managerSummary = PerformanceAttributionService.getManagerSummary('2024-06-03');
console.log(`\n负责人摘要:`);
console.log(`  总金额: ${managerSummary.totalAmount.toFixed(2)}`);
console.log(`  总记录: ${managerSummary.totalRecords}`);
console.log(`  待复核: ${managerSummary.pendingReviewCount}`);
console.log(`  交易员明细:`);
managerSummary.traders.forEach(t => {
  console.log(`    - ${t.traderId}: ${t.totalAmount.toFixed(2)} (${t.recordCount}条)`);
});

console.log('\n=== 演示完成 ===');
console.log('\n导出报表数据（页面/接口/导出 同源）:');
const exportData = PerformanceAttributionService.getExportData('2024-06-03');
exportData.forEach(row => {
  console.log(`  ${row.证券名称}: ${row.当前金额}, 状态: ${row.状态}, 风险标记: ${row.风险标记}`);
});
