import { PerformanceAttributionService } from '../services/PerformanceAttributionService';
import { RawTradeRecord } from '../core/TradeRecordFactory';
import { DataStore } from '../data/DataStore';

DataStore.getInstance().clearAll();

console.log('=== 交易员绩效归因报表 - 状态校验修复验证 ===\n');

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

console.log('===========================================');
console.log('第一部分：验证非法路径被拦截');
console.log('===========================================\n');

const importResult = PerformanceAttributionService.importRecords(testRecords, '风控值班-老秦');
console.log(`[导入] 成功: ${importResult.importedCount} 条, 金额为0待冲正: ${importResult.zeroWithReversalCount} 条`);

const zeroRecords = PerformanceAttributionService.getZeroWithReversalRecords('2024-06-03');
const moutai = zeroRecords.find(r => r.instrumentName === '贵州茅台')!;
const pingan = zeroRecords.find(r => r.instrumentName === '中国平安')!;

console.log(`[当前状态] 贵州茅台: ${moutai.status}, 中国平安: ${pingan.status}`);

console.log('\n--- 非法路径1: ZERO_WITH_REVERSAL 直接 reviewAsNormal ---');
const illegal1 = PerformanceAttributionService.reviewAsNormal(moutai.id, '风控复核-小张', '直接标正常');
console.log(`  结果: success=${illegal1.success}, error="${illegal1.error}"`);

const moutaiAfter1 = PerformanceAttributionService.getRecordDetail(moutai.id);
console.log(`  验证状态未变: ${moutaiAfter1?.status === 'ZERO_WITH_REVERSAL' ? '✓ 仍然是 ZERO_WITH_REVERSAL' : '✗ 状态已被篡改!'}`);

console.log('\n--- 非法路径2: ZERO_WITH_REVERSAL 直接 markAsSummarized ---');
const illegal2 = PerformanceAttributionService.markAsSummarized(moutai.id, '风控复核-小张');
console.log(`  结果: success=${illegal2.success}, error="${illegal2.error}"`);

const moutaiAfter2 = PerformanceAttributionService.getRecordDetail(moutai.id);
console.log(`  验证状态未变: ${moutaiAfter2?.status === 'ZERO_WITH_REVERSAL' ? '✓ 仍然是 ZERO_WITH_REVERSAL' : '✗ 状态已被篡改!'}`);

console.log('\n--- 非法路径3: ZERO_WITH_REVERSAL 直接 reviewWithAdjustment ---');
const illegal3 = PerformanceAttributionService.reviewWithAdjustment(moutai.id, '风控复核-小张', 999, '直接调整');
console.log(`  结果: success=${illegal3.success}, error="${illegal3.error}"`);

const moutaiAfter3 = PerformanceAttributionService.getRecordDetail(moutai.id);
console.log(`  验证状态未变: ${moutaiAfter3?.status === 'ZERO_WITH_REVERSAL' ? '✓ 仍然是 ZERO_WITH_REVERSAL' : '✗ 状态已被篡改!'}`);
console.log(`  验证金额未变: ${moutaiAfter3?.amount === 0 ? '✓ 金额仍为0' : '✗ 金额已被篡改!'}`);

console.log('\n===========================================');
console.log('第二部分：走完整证据闭环（贵州茅台）');
console.log('===========================================\n');

console.log('[闭环步骤1] 老秦补看托管确认页 → 提交复核');
const step1 = PerformanceAttributionService.submitForReview(moutai.id, '风控值班-老秦', 'C-20240603-042');
console.log(`  结果: success=${step1.success}`);
const moutaiStep1 = PerformanceAttributionService.getRecordDetail(moutai.id);
console.log(`  状态: ${moutaiStep1?.status}`);
console.log(`  托管页参考: ${moutaiStep1?.tailDiffAdjustment?.custodianPageReference}`);

console.log('\n[闭环步骤2] 风控同事小张复核 → 调整金额');
const step2 = PerformanceAttributionService.reviewWithAdjustment(
  moutai.id,
  '风控复核-小张',
  1250.35,
  '核对托管确认页C-20240603-042，确认应为1250.35'
);
console.log(`  结果: success=${step2.success}`);
const moutaiStep2 = PerformanceAttributionService.getRecordDetail(moutai.id);
console.log(`  状态: ${moutaiStep2?.status}`);
console.log(`  当前金额: ${moutaiStep2?.amount}`);
console.log(`  人工改动: ${moutaiStep2?.tailDiffAdjustment?.manualChange}`);
console.log(`  原始行号: ${moutaiStep2?.tailDiffAdjustment?.originalLineNumber}`);

console.log('\n[闭环步骤3] 纳入负责人摘要');
const step3 = PerformanceAttributionService.markAsSummarized(moutai.id, '风控复核-小张');
console.log(`  结果: success=${step3.success}`);
const moutaiStep3 = PerformanceAttributionService.getRecordDetail(moutai.id);
console.log(`  状态: ${moutaiStep3?.status}`);

console.log('\n--- 非法路径4: SUMMARIZED 终态不能再操作 ---');
const illegal4 = PerformanceAttributionService.markAsSummarized(moutai.id, '风控复核-小张');
console.log(`  再次纳入摘要: success=${illegal4.success}, error="${illegal4.error}"`);
const illegal5 = PerformanceAttributionService.reviewAsNormal(moutai.id, '风控复核-小张');
console.log(`  从终态复核: success=${illegal5.success}, error="${illegal5.error}"`);

console.log('\n===========================================');
console.log('第三部分：走正常记录的合法捷径（平安银行）');
console.log('===========================================\n');

const bankRecord = PerformanceAttributionService.getRecordDetail(
  importResult.records.find(r => r.instrumentName === '平安银行')!.id
)!;
console.log(`[当前状态] 平安银行: ${bankRecord.status} (IMPORTED，正常交易)`);
const bankSummarize = PerformanceAttributionService.markAsSummarized(bankRecord.id, '风控值班-老秦');
console.log(`直接纳入摘要: success=${bankSummarize.success}`);
const bankAfter = PerformanceAttributionService.getRecordDetail(bankRecord.id);
console.log(`状态: ${bankAfter?.status}`);

console.log('\n===========================================');
console.log('第四部分：核对页面/接口/导出数据一致性');
console.log('===========================================\n');

const pageData = PerformanceAttributionService.getPageData('2024-06-03');
const apiData = PerformanceAttributionService.getReport('2024-06-03');
const exportData = PerformanceAttributionService.getExportData('2024-06-03');

console.log(`页面记录数: ${pageData.report.records.length}`);
console.log(`接口记录数: ${apiData.records.length}`);
console.log(`导出记录数: ${exportData.length}`);
const countMatch = pageData.report.records.length === apiData.records.length && apiData.records.length === exportData.length;
console.log(`三者一致: ${countMatch ? '✓' : '✗ 不一致!'}`);

console.log('\n逐条核对页面状态 vs 导出内容:');
const pageRecords = pageData.report.records;
exportData.forEach((row, i) => {
  const pageRec = pageRecords.find(r => r.instrumentName === row.证券名称);
  const match = pageRec && pageRec.status === apiData.records[i].status;
  console.log(`  ${row.证券名称}: 页面状态=${pageRec?.status}, 接口状态=${apiData.records[i]?.status}, 导出状态=${row.状态}, 风险标记=${row.风险标记} ${match ? '✓' : '✗'}`);
});

console.log('\n导出明细（含尾差调整证据）:');
exportData.forEach(row => {
  console.log(`  ${row.证券名称}: 金额${row.当前金额}, 状态=${row.状态}, 原始行号=${row.原始行号 ?? '-'}, 人工调整=${row.人工调整 ?? '-'}, 托管页=${row.托管页参考 ?? '-'}`);
});

console.log('\n===========================================');
console.log('第五部分：审计日志完整性');
console.log('===========================================\n');

const auditTrail = PerformanceAttributionService.getAuditTrail(moutai.id);
console.log(`贵州茅台审计日志 (${auditTrail.length}条):`);
auditTrail.forEach((log, i) => {
  console.log(`  ${i + 1}. ${log.操作人} → ${log.动作}${log.备注 ? ' | ' + log.备注 : ''}`);
});

const expectedActions = ['导入记录', '提交复核', '复核通过-调整', '纳入摘要'];
const actualActions = auditTrail.map(l => l.动作);
const actionsMatch = expectedActions.every((a, i) => actualActions[i] === a);
console.log(`闭环完整性: ${actionsMatch ? '✓ 导入→提交复核→调整→纳入摘要 四步齐全' : '✗ 步骤缺失!'}`);

console.log('\n===========================================');
console.log('第六部分：负责人摘要核对');
console.log('===========================================\n');

const summary = PerformanceAttributionService.getManagerSummary('2024-06-03');
console.log(`总金额: ${summary.totalAmount.toFixed(2)}`);
console.log(`总记录: ${summary.totalRecords}`);
console.log(`待复核: ${summary.pendingReviewCount}`);
console.log('交易员明细:');
summary.traders.forEach(t => {
  console.log(`  ${t.traderId}: ${t.totalAmount.toFixed(2)} (${t.recordCount}条)`);
});

const pinganRecord = PerformanceAttributionService.getRecordDetail(pingan.id);
console.log(`\n中国平安仍在待冲正复核: ${pinganRecord?.status === 'ZERO_WITH_REVERSAL' ? '✓ 未被意外纳入摘要' : '✗ 状态异常!'}`);

console.log('\n=== 验证全部完成 ===');
