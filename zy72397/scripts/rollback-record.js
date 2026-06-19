const { cliBootstrap } = require('../src/cli-bootstrap');
const workflowEngine = require('../src/engine/workflow-engine');
const { STATUS } = require('../src/models/boundary-rules');

const { args, dataFile, loadResult, getArg, dataStore } = cliBootstrap();

const recordId = getArg('record-id') || getArg('id');
const versionIdxStr = getArg('version', '-1');
const versionIdx = parseInt(versionIdxStr, 10);
const operator = getArg('operator', 'system-cli');

const S = '='.repeat(70);
const D = '-'.repeat(70);

function printHelp() {
  console.log('用法: npm run rollback -- --record-id=REC-002 --version=1 [--operator=何工]');
  console.log('');
  console.log('  数据文件 (所有命令共享同一份证据链):');
  console.log('    --data=<path>       指定数据文件，默认 data/runtime.json');
  console.log('    --reset             清空现有数据（不推荐）');
  console.log('    --no-save           只演示，不写入文件');
  console.log('');
  console.log('  回滚参数:');
  console.log('    --record-id         要回滚的记录ID（必填）');
  console.log('    --version           status_history 的节点索引 (必填)');
  console.log('                           0=刚导入后的初始状态');
  console.log('                           1=第一条状态迁移后的状态...');
  console.log('                           -1=列出可选版本后退出（不执行）');
  console.log('    --operator          操作人，默认 system-cli');
  console.log('');
  console.log('  重要保证:');
  console.log('    - 同步更新 qc_review_required / boundary_issues 派生字段');
  console.log('    - 不会出现"页面说成功、接口还读不到"的情况');
  console.log('    - 与导出/页面/API 读取的是同一份数据文件');
  console.log('');
  console.log(`  当前数据文件: ${dataFile}`);
  console.log(`  加载状态: ${loadResult && loadResult.loaded ? `已加载 ${loadResult.records} 条记录` : (loadResult ? loadResult.reason : '未知')}`);
  console.log('');
}

console.log(S);
console.log('⏪ 回滚记录');
console.log(S);
console.log(`数据文件: ${dataFile}`);
if (loadResult && loadResult.loaded) {
  console.log(`已加载: ${loadResult.records} 条记录，${loadResult.audit_logs} 条审计日志`);
} else {
  console.log(`加载状态: ${loadResult ? loadResult.reason : '未知'}（从空开始）`);
}
console.log('');

if (!recordId) { printHelp(); process.exit(1); }

const rec = dataStore.getRecordById(recordId);
if (!rec) {
  console.log(`❌ 记录不存在: ${recordId}`);
  console.log('');
  console.log('可能原因:');
  console.log('   1. 这条记录还没被导入 —— 先跑 npm run prepare-demo 或 npm run import');
  console.log('   2. 用了另一个数据文件 —— 确认 --data 参数一致');
  console.log('   3. 数据被清空了 —-- 重新 npm run prepare-demo 构建样例');
  console.log('');
  const all = dataStore.getUnifiedView();
  if (all.length > 0) {
    console.log('当前数据文件中存在的记录:');
    all.forEach(r => console.log(`   ${r.id.padEnd(14)} ${r.sensor_id.padEnd(18)} status=${r.current_status.padEnd(18)} qc=${r.qc_review_required}`));
  } else {
    console.log('当前数据文件为空。运行以下命令构建完整样例:');
    console.log('   npm run prepare-demo');
    console.log('   → 然后再执行本回滚命令');
  }
  console.log('');
  process.exit(2);
}

console.log(D);
console.log(`记录 ${recordId} 当前状态快照:`);
console.log(`   id:                ${rec.id}`);
console.log(`   sensor_id:         ${rec.sensor_id}`);
console.log(`   original_line_no:  ${rec.original_line_no}`);
console.log(`   current_status:    ${rec.current_status}`);
console.log(`   qc_review_required:${rec.qc_review_required}  (派生字段，会跟着状态同步)`);
console.log(`   boundary_issues:   ${(rec.boundary_issues || []).map(i => i.issueType).join(', ') || '(无)'}`);
console.log(`   superseded_by:     ${rec.superseded_by || '(空)'}`);
console.log(`   conclusion:        ${rec.conclusion || '(空)'}`);
console.log('');

console.log(`可用 status_history 节点数: ${rec.status_history.length}`);
rec.status_history.forEach((h, i) => {
  const snap = h.state_snapshot || {};
  console.log(`   [${String(i).padStart(2)}] ${h.status.padEnd(22)}`
    + ` qc=${typeof snap.qc_review_required === 'boolean' ? (snap.qc_review_required ? 'true ' : 'false') : '?  '}`
    + ` boundary=${(snap.boundary_issues || []).length}`
    + `  time=${(h.timestamp || '').slice(0, 19)}`
    + (h.remark ? `  note=${h.remark.slice(0, 26)}` : ''));
});
console.log('');

if (versionIdx < 0) {
  console.log('(仅打印可用版本，未执行回滚。传入 --version=<N> 执行)');
  console.log('');
  console.log('例如 —— 回滚到 NEED_QC_REVIEW 那一刻（假设它在索引 1）:');
  console.log(`   npm run rollback -- --record-id=${recordId} --version=1 --operator=质检员-撤销`);
  console.log('');
  process.exit(0);
}

if (isNaN(versionIdx) || versionIdx >= rec.status_history.length) {
  console.log(`❌ --version=${versionIdxStr} 超出范围 [0, ${rec.status_history.length - 1}]`);
  process.exit(3);
}

console.log(D);
console.log(`→ 执行回滚到索引 [${versionIdx}] (status=${rec.status_history[versionIdx].status})`);
console.log(`   操作人: ${operator}`);
console.log('');

const targetHist = rec.status_history[versionIdx];
const expectedQc = targetHist.state_snapshot && typeof targetHist.state_snapshot.qc_review_required !== 'undefined'
  ? targetHist.state_snapshot.qc_review_required : '(将按状态派生)';
const expectedStatus = targetHist.status;
console.log(`   预期回滚结果: status=${expectedStatus}  qc_review_required=${expectedQc}`);
console.log('');

const rb = workflowEngine.rollbackToVersion(recordId, versionIdx, operator);

console.log('回滚后的状态快照（核对同步字段）:');
console.log(`   current_status:    ${rb.current_status}`.padEnd(50) + (rb.current_status === expectedStatus ? '✅ 匹配' : '❌ 不一致, 期望=' + expectedStatus));
console.log(`   qc_review_required:${rb.qc_review_required}`.padEnd(50)
  + (typeof expectedQc === 'boolean'
    ? (rb.qc_review_required === expectedQc ? '✅ 同步' : '❌ 派生字段没同步！')
    : '(派生)'));
console.log(`   boundary_issues:   ${(rb.boundary_issues || []).map(i => i.issueType).join(', ') || '(无)'}`);
console.log(`   superseded_by:     ${rb.superseded_by || '(空)'}`);
console.log(`   conclusion:        ${rb.conclusion || '(空)'}`);
console.log('');

// 一致性检查
console.log('三方一致性自检 (verifyConsistency):');
const v = dataStore.verifyConsistency();
console.log(`   结果: ${v.passed ? '✅ 通过' : '❌ 失败: ' + v.issues.join('; ')}`);
console.log(`   汇总: ${v.summary}`);
console.log('');

// 对比 API vs 导出
const api = dataStore.getUnifiedView().find(r => r.id === recordId);
const exp = JSON.parse(dataStore.getExportData('json')).find(r => r.id === recordId);
console.log('API vs 导出 (三方同一份数据源核对):');
['id', 'current_status', 'qc_review_required', 'superseded_by'].forEach(k => {
  const apiV = typeof api[k] === 'object' ? JSON.stringify(api[k]) : api[k];
  const expV = typeof exp[k] === 'object' ? JSON.stringify(exp[k]) : exp[k];
  const ok = apiV === expV;
  console.log(`   ${k.padEnd(22)} API=${String(apiV).padEnd(28)} EXPORT=${String(expV).padEnd(28)} ${ok ? '✅' : '❌ 不一致!'}`);
});
console.log('');

if (loadResult && loadResult.loaded) {
  console.log(`💾 数据已持久化到: ${dataFile}`);
  console.log('   后续所有命令（replay / export / web服务）都能读到这次回滚后的结果');
}

console.log('');
console.log('完成。命令复现:');
console.log(`   npm run rollback -- --record-id=${recordId} --version=${versionIdx} --operator=${operator}`);
console.log('');
console.log('相关命令:');
console.log(`   npm run replay -- --record-id=${recordId}   ← 重放审计日志，核对每步变更`);
console.log(`   npm run export -- --record-id=${recordId}   ← 导出该条记录的明细`);
console.log('   npm run export -- --format=csv              ← 导出全部明细');
console.log('');
