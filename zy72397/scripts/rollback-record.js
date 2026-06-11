const dataStore = require('../src/store/data-store');
const workflowEngine = require('../src/engine/workflow-engine');

const args = process.argv.slice(2);
function getArg(name, def) {
  const longIdx = args.findIndex(a => a.startsWith('--' + name + '='));
  if (longIdx >= 0) return args[longIdx].split('=')[1];
  const idx = args.findIndex(a => a === '--' + name);
  if (idx >= 0 && idx + 1 < args.length) return args[idx + 1];
  return def;
}

const recordId = getArg('record-id') || getArg('id');
const versionIdx = parseInt(getArg('version', '-1'), 10);
const operator = getArg('operator', 'system-cli');

// 命令行跑时，要么先在服务内跑过（服务有数据），要么加 --setup 预载测试样例
if (getArg('setup') === '1' || getArg('setup') === 'true' || getArg('setup') === 'demo') {
  require('./_testdata.js');
}

function printHelp() {
  console.log('用法: npm run rollback -- --record-id=REC-002 --version=1 [--operator=何工]');
  console.log('');
  console.log('  --record-id   要回滚的记录ID（必填）');
  console.log('  --version     status_history 的节点索引 (必填)');
  console.log('                   0=刚导入后的初始状态');
  console.log('                   1=第一条状态迁移后的状态...');
  console.log('                   -1=列出可选版本后退出（不执行）');
  console.log('  --operator    操作人，默认 system-cli');
  console.log('');
  console.log('重点: 会同步更新派生字段 qc_review_required 和 boundary_issues，不会出现页面OK接口不一致');
  console.log('');
}

if (!recordId) { printHelp(); process.exit(1); }

const rec = dataStore.getRecordById(recordId);
if (!rec) { console.log(`记录不存在: ${recordId}`); process.exit(2); }

console.log('='.repeat(70));
console.log(`⏪ 回滚记录 ${recordId}`);
console.log('='.repeat(70));
console.log(`操作人: ${operator}`);
console.log('');

console.log('当前状态快照:');
console.log(`   id:                ${rec.id}`);
console.log(`   current_status:    ${rec.current_status}`);
console.log(`   qc_review_required:${rec.qc_review_required}  (派生字段，会跟着状态同步)`);
console.log(`   boundary_issues:   ${rec.boundary_issues.map(i=>i.issueType).join(', ') || '(无)'}`);
console.log(`   superseded_by:     ${rec.superseded_by || '(空)'}`);
console.log(`   conclusion:        ${rec.conclusion || '(空)'}`);
console.log('');

console.log(`可用 status_history 节点数: ${rec.status_history.length}`);
rec.status_history.forEach((h, i) => {
  const snapshot = h.state_snapshot || {};
  console.log(`   [${i}] status=${h.status}`.padEnd(42)
    + `  qc=${snapshot.qc_review_required ?? '?'}  time=${h.timestamp.slice(0,19)}`
    + (h.note ? `  note=${h.note.slice(0, 28)}` : ''));
});
console.log('');

if (versionIdx < 0) {
  console.log('(仅打印可用版本，未执行回滚。传入 --version=<N> 执行)');
  process.exit(0);
}

if (versionIdx >= rec.status_history.length) {
  console.log(`--version=${versionIdx} 超出范围 [0, ${rec.status_history.length - 1}]`);
  process.exit(3);
}

console.log(`→ 执行回滚到索引 [${versionIdx}] (status=${rec.status_history[versionIdx].status})`);
console.log('');

const targetHist = rec.status_history[versionIdx];
const expectedQc = targetHist.state_snapshot && typeof targetHist.state_snapshot.qc_review_required !== 'undefined'
  ? targetHist.state_snapshot.qc_review_required : '(将按状态派生)';
const expectedStatus = targetHist.status;
console.log(`   预期回滚结果: status=${expectedStatus}  qc_review_required=${expectedQc}`);
console.log('');

const rb = workflowEngine.rollbackToVersion(recordId, versionIdx, operator);

console.log('回滚后的状态快照（核对同步字段）:');
console.log(`   current_status:    ${rb.current_status}   ${rb.current_status === expectedStatus ? '✅ 匹配' : '❌ 不一致, 期望=' + expectedStatus}`);
console.log(`   qc_review_required:${rb.qc_review_required}   ${typeof expectedQc === 'boolean'
    ? (rb.qc_review_required === expectedQc ? '✅ 同步' : '❌ 派生字段没同步！')
    : '(派生)'}  （⚠️ 不允许只改status不改这个字段）`);
console.log(`   boundary_issues:   ${rb.boundary_issues.map(i=>i.issueType).join(', ') || '(无)'}   ${rb.boundary_issues.length >= 1 ? '✅ 证据保留' : (rec.boundary_issues.length >= 1 ? '❌ 证据丢失！' : '')}`);
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
  console.log(`   ${k.padEnd(22)} API=${String(apiV).padEnd(30)} EXPORT=${String(expV).padEnd(30)} ${ok ? '✅' : '❌ 不一致!'}`);
});

console.log('');
console.log('完成。命令复现:');
console.log(`   npm run rollback -- --record-id=${recordId} --version=${versionIdx} --operator=${operator}`);
