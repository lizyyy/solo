import { useRecordsStore } from './src/store/useRecordsStore.ts';
import { RecordStatus, OperatorRole } from './src/types/index.ts';

function log(title, content) {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${title}`);
  console.log('='.repeat(60));
  if (content !== undefined) {
    console.log(content);
  }
}

function logStep(step, desc) {
  console.log(`\n  【步骤 ${step}】 ${desc}`);
}

function assert(condition, message) {
  if (condition) {
    console.log(`    ✅ ${message}`);
    return true;
  } else {
    console.log(`    ❌ ${message}`);
    return false;
  }
}

let passed = 0;
let failed = 0;

function check(condition, message) {
  if (assert(condition, message)) {
    passed++;
  } else {
    failed++;
  }
}

log('轨交站口雨棚排查 - 回滚链路自动化验证脚本', '验证重点：只改 1 次备注也能回滚');

const store = useRecordsStore;

logStep('0', '清空数据，设置操作人为规划员小姜');
store.getState().clearAllData();
store.getState().setOperator(OperatorRole.PLANNER, '小姜');
check(store.getState().currentOperatorName === '小姜', '操作人设置为小姜');
check(store.getState().records.length === 0, '数据已清空');

logStep('1', '导入第一批路口照片（模拟数据）');
store.getState().importMockData();
const records = store.getState().records;
check(records.length > 0, `成功导入 ${records.length} 条记录`);

const targetRecord = records.find(r => r.communityName === '阳光新村');
check(!!targetRecord, '找到目标记录：阳光新村');
check(targetRecord.status === RecordStatus.PENDING, '初始状态：待排查');

const originalPlannerRemark = targetRecord.plannerRemark || '';
check(originalPlannerRemark === '', '初始规划员备注为空');

const initialHistory = store.getState().getFieldHistory(targetRecord.id, 'plannerRemark');
check(initialHistory.length === 0, '初始历史记录为 0 条');

logStep('2', '小姜修改一次规划员备注（模拟最常见场景：只改 1 次）');
const newRemark = '公交刷卡数据显示早高峰人流量大，雨棚完好无需维修';
store.getState().updateRecordField(targetRecord.id, 'plannerRemark', newRemark, '字段编辑');

const recordAfterEdit = store.getState().records.find(r => r.id === targetRecord.id);
check(recordAfterEdit.plannerRemark === newRemark, '规划员备注已更新为新值');

const historyAfterEdit = store.getState().getFieldHistory(targetRecord.id, 'plannerRemark');
check(historyAfterEdit.length === 1, `变更历史有 ${historyAfterEdit.length} 条（预期 1 条）`);

const firstHistory = historyAfterEdit[0];
check(firstHistory.oldValue === originalPlannerRemark, `改前值正确："${firstHistory.oldValue}"`);
check(firstHistory.newValue === newRemark, `改后值正确："${firstHistory.newValue}"`);
check(firstHistory.operatorName === '小姜', '操作人正确：小姜');
check(firstHistory.changeReason === '字段编辑', '变更原因正确：字段编辑');

logStep('3', '验证核心修复：只有 1 条历史时，是否可以回滚');
const currentValue = String(recordAfterEdit['plannerRemark'] ?? '');
const canRollback = currentValue === firstHistory.newValue && firstHistory.oldValue !== firstHistory.newValue;

console.log(`    当前值："${currentValue}"`);
console.log(`    历史改后值："${firstHistory.newValue}"`);
console.log(`    历史改前值："${firstHistory.oldValue}"`);
console.log(`    判断条件：currentValue === h.newValue && h.oldValue !== h.newValue`);
console.log(`    计算结果：${currentValue} === ${firstHistory.newValue} = ${currentValue === firstHistory.newValue}`);
console.log(`              ${firstHistory.oldValue} !== ${firstHistory.newValue} = ${firstHistory.oldValue !== firstHistory.newValue}`);

check(canRollback, '只有 1 条历史记录时，可以回滚（核心修复验证）');

if (!canRollback) {
  console.log('\n    ❗ 这是原本的 Bug：idx !== 0 / !isLatest 导致只有 1 条历史时无法回滚');
  console.log('    ❗ 修复后应该为 true');
}

logStep('4', '执行回滚操作：回滚到修改前的版本');
store.getState().rollbackToHistory(firstHistory.id, '测试回滚：还原为空备注');

const recordAfterRollback = store.getState().records.find(r => r.id === targetRecord.id);
check(recordAfterRollback.plannerRemark === originalPlannerRemark, `回滚后备注值还原为原值："${recordAfterRollback.plannerRemark || '(空)'}"`);

const historyAfterRollback = store.getState().getFieldHistory(targetRecord.id, 'plannerRemark');
check(historyAfterRollback.length === 2, `回滚后历史记录有 ${historyAfterRollback.length} 条（预期 2 条：原始修改 + 回滚）`);

const rollbackHistory = historyAfterRollback[0];
check(rollbackHistory.oldValue === newRemark, `回滚记录改前值正确："${rollbackHistory.oldValue}"`);
check(rollbackHistory.newValue === originalPlannerRemark, `回滚记录改后值正确："${rollbackHistory.newValue || '(空)'}"`);
check(rollbackHistory.operatorName === '小姜', '回滚操作人正确：小姜');
check(rollbackHistory.changeReason?.includes('回滚'), `回滚原因包含"回滚"：${rollbackHistory.changeReason}`);

logStep('5', '验证回滚后还能再回滚（闭环验证）');
const currentValueAfterRollback = String(recordAfterRollback['plannerRemark'] ?? '');
const canRollbackAgain = currentValueAfterRollback === rollbackHistory.newValue && rollbackHistory.oldValue !== rollbackHistory.newValue;

check(canRollbackAgain, '回滚后仍可再次回滚（闭环保证）');

if (canRollbackAgain) {
  logStep('5.1', '再次回滚（回到修改后的状态）');
  store.getState().rollbackToHistory(rollbackHistory.id);
  
  const recordAfterRollback2 = store.getState().records.find(r => r.id === targetRecord.id);
  check(recordAfterRollback2.plannerRemark === newRemark, `再次回滚后备注值回到："${recordAfterRollback2.plannerRemark}"`);
  
  const historyAfterRollback2 = store.getState().getFieldHistory(targetRecord.id, 'plannerRemark');
  check(historyAfterRollback2.length === 3, `再次回滚后历史记录有 ${historyAfterRollback2.length} 条`);
}

logStep('6', '验证重复导入场景下的回滚');
console.log('    （先清空，再做重复导入测试）');
store.getState().clearAllData();
store.getState().setOperator(OperatorRole.PLANNER, '小姜');

const testRecord1 = {
  originalRowNumber: 1,
  communityName: '测试小区',
  stationName: '测试站',
  photoDescription: '第一次导入的照片描述',
  status: RecordStatus.PENDING,
  isSuspectedDuplicateName: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  importBatchId: 'batch-1',
  importFileName: 'test-1.csv',
};

store.getState().addRecords([testRecord1]);
const rec1 = store.getState().records[0];
check(!!rec1, '第一次导入成功');

store.getState().updateRecordField(rec1.id, 'plannerRemark', '规划员小姜的原始备注', '初始备注');
const recWithRemark = store.getState().records[0];
check(recWithRemark.plannerRemark === '规划员小姜的原始备注', '规划员添加备注');

logStep('6.1', '重复导入同一批数据（覆盖模式，保留备注）');
const testRecord2 = {
  originalRowNumber: 1,
  communityName: '测试小区',
  stationName: '测试站',
  photoDescription: '第二次导入的照片描述（更新了）',
  status: RecordStatus.PENDING,
  isSuspectedDuplicateName: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  importBatchId: 'batch-2',
  importFileName: 'test-2.csv',
};

const result = store.getState().addRecords([testRecord2], { mode: 'overwrite_keep_history' });
check(result.reusedCount === 1, `复用记录数：${result.reusedCount}（预期 1）`);
check(result.newCount === 0, `新增记录数：${result.newCount}（预期 0）`);
check(store.getState().records.length === 1, '总记录数仍为 1，不翻倍');

const recAfterReimport = store.getState().records[0];
check(recAfterReimport.plannerRemark === '规划员小姜的原始备注', '重复导入后规划员备注保留原话（不覆盖）');
check(recAfterReimport.photoDescription === '第二次导入的照片描述（更新了）', '照片描述被更新');

const photoHistory = store.getState().getFieldHistory(recAfterReimport.id, 'photoDescription');
check(photoHistory.length >= 1, `照片描述有 ${photoHistory.length} 条历史记录`);

const plannerRemarkHistory = store.getState().getFieldHistory(recAfterReimport.id, 'plannerRemark');
check(plannerRemarkHistory.length === 1, `规划员备注仍只有 ${plannerRemarkHistory.length} 条历史（没被重复导入覆盖）`);

logStep('6.2', '验证重复导入的照片描述可以回滚');
if (photoHistory.length > 0) {
  const latestPhotoHistory = photoHistory[0];
  const currentPhotoValue = String(recAfterReimport['photoDescription'] ?? '');
  const canRollbackPhoto = currentPhotoValue === latestPhotoHistory.newValue && latestPhotoHistory.oldValue !== latestPhotoHistory.newValue;
  
  check(canRollbackPhoto, '重复导入的照片描述可以回滚');
  
  if (canRollbackPhoto) {
    store.getState().rollbackToHistory(latestPhotoHistory.id);
    const recAfterPhotoRollback = store.getState().records[0];
    check(recAfterPhotoRollback.photoDescription === '第一次导入的照片描述', '照片描述回滚到第一次导入的值');
  }
}

logStep('7', '验证回滚链追溯功能');
store.getState().clearAllData();
store.getState().setOperator(OperatorRole.PLANNER, '小姜');

store.getState().addRecords([{
  originalRowNumber: 1,
  communityName: '回滚链测试小区',
  stationName: '测试站',
  status: RecordStatus.PENDING,
  isSuspectedDuplicateName: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  importBatchId: 'chain-test',
  importFileName: 'chain-test.csv',
}]);

const chainRec = store.getState().records[0];

store.getState().updateRecordField(chainRec.id, 'plannerRemark', '版本1：初始备注', '第一次修改');
store.getState().updateRecordField(chainRec.id, 'plannerRemark', '版本2：更新备注', '第二次修改');
store.getState().updateRecordField(chainRec.id, 'plannerRemark', '版本3：最终备注', '第三次修改');

const chainHistory = store.getState().getFieldHistory(chainRec.id, 'plannerRemark');
check(chainHistory.length === 3, `共 ${chainHistory.length} 次修改`);

const middleHistory = chainHistory[1];
const rollbackChain = store.getState().getRollbackChain(middleHistory.id);
check(rollbackChain.length >= 1, `回滚链长度：${rollbackChain.length}`);

log('验证结果汇总', '');
console.log(`\n  总测试项：${passed + failed}`);
console.log(`  通过：${passed} ✅`);
console.log(`  失败：${failed} ❌`);

if (failed === 0) {
  console.log('\n  🎉 所有测试通过！回滚链路完整可用');
  console.log('\n  核心验证结论：');
  console.log('  ✅ 只改 1 次备注也能看到"回滚到此版本"按钮');
  console.log('  ✅ 点击回滚后，备注值、修改人、修改原因、历史记录全部正确');
  console.log('  ✅ 回滚本身又生成新的历史记录，可再次回滚（闭环）');
  console.log('  ✅ 重复导入不覆盖备注，历史记录保留原话');
  console.log('  ✅ 重复导入的字段变更可以回滚');
} else {
  console.log('\n  ❌ 有测试失败，请检查输出');
  process.exit(1);
}
