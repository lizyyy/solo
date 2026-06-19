const { cliBootstrap } = require('../src/cli-bootstrap');
const workflowEngine = require('../src/engine/workflow-engine');

const { dataFile, loadResult, getArg, dataStore } = cliBootstrap();

const recordId = getArg('record-id') || getArg('id') || 'REC-002';

const S = '='.repeat(72);
const D = '-'.repeat(72);

console.log(S);
console.log('⏱️  审计日志重放');
console.log(S);
console.log(`数据文件: ${dataFile}`);
if (loadResult && loadResult.loaded) {
  console.log(`已加载: ${loadResult.records} 条记录，${loadResult.audit_logs} 条审计日志`);
} else {
  console.log(`加载状态: ${loadResult ? loadResult.reason : '未知'}（从空开始）`);
}
console.log('');
console.log(`目标记录: ${recordId}`);
console.log('');

try {
  const audit = workflowEngine.replayAuditLog(recordId);

  console.log('📋 状态流转历史:');
  console.log(D);
  audit.status_history.forEach((s, i) => {
    const snap = s.state_snapshot || {};
    console.log(`[${String(i).padStart(2, '0')}] ${s.timestamp ? s.timestamp.slice(0, 19) : ''}`);
    console.log(`      状态: ${s.status}`);
    console.log(`      操作人: ${s.operator || '-'}`);
    console.log(`      备注: ${s.remark || '-'}`);
    console.log(`      快照: qc_review_required=${typeof snap.qc_review_required === 'boolean' ? snap.qc_review_required : '?'}  boundary_issues=${(snap.boundary_issues || []).length}项`);
    if (s.rollback_from) console.log(`      回滚来源: ${s.rollback_from} (索引 ${s.rollback_index})`);
    if (s.boundary_issues && Array.isArray(s.boundary_issues) && s.boundary_issues.length > 0) {
      console.log(`      触发边界问题:`);
      s.boundary_issues.forEach(bi => console.log(`        - [${bi.issueType}] ${bi.message}`));
    }
    console.log('');
  });

  const record = dataStore.getRecordById(recordId);

  if (record && record.manual_changes && record.manual_changes.length > 0) {
    console.log('✏️  人工改动记录:');
    console.log(D);
    record.manual_changes.forEach((c, i) => {
      console.log(`[${String(i).padStart(2, '0')}] ${c.timestamp ? c.timestamp.slice(0, 19) : ''}`);
      console.log(`      字段: ${c.field}`);
      console.log(`      旧值: ${c.old_value || '(空)'}`);
      console.log(`      新值: ${c.new_value}`);
      console.log(`      操作人: ${c.operator}`);
      console.log(`      原因: ${c.reason || '-'}`);
      console.log('');
    });
  }

  if (record && record.previous_versions && record.previous_versions.length > 0) {
    console.log('📜 历史结论版本（返工证据链）:');
    console.log(D);
    record.previous_versions.forEach((v, i) => {
      console.log(`版本 V${v.conclusion_version || (i + 1)}:`);
      console.log(`      来源: ${v.superseded_from || v.from_record_id || '（来自旧版本）'}`);
      console.log(`      结论: ${v.conclusion || '(空)'}`);
      console.log(`      时间: ${v.timestamp || '-'}`);
      console.log('');
    });
  }

  console.log(S);
  console.log('🎯 回滚入口（实际可用，不是演示脚本）:');
  console.log('');
  console.log(`   列出 ${recordId} 的所有可回滚版本:`);
  console.log(`     npm run rollback -- --record-id=${recordId} --version=-1`);
  console.log('');
  console.log(`   回滚到指定版本 (将 <idx> 替换为上面的索引数字):`);
  console.log(`     npm run rollback -- --record-id=${recordId} --version=<idx> --operator=<你的名字>`);
  console.log('');
  console.log('   例如 —— 回滚到 NEED_QC_REVIEW 状态（假设索引为 1）:');
  console.log(`     npm run rollback -- --record-id=${recordId} --version=1 --operator=质检员-撤销`);
  console.log('');
  console.log('📤 导出明细（与回滚后状态保持一致）:');
  console.log(`     npm run export -- --record-id=${recordId} --format=json`);
  console.log(`     npm run export -- --format=csv --needs-qc-review=true`);
  console.log('');
  console.log('🔧 重建样例（如果数据丢了/想重来）:');
  console.log('     npm run prepare-demo     ← 构建完整返工场景（推荐）');
  console.log('     npm run import           ← 只导入传感器数据，从头走流程');
  console.log('');

} catch (e) {
  console.log(`❌ 错误: ${e.message}`);
  console.log('');

  const all = dataStore.getUnifiedView();
  if (all.length > 0) {
    console.log('当前数据文件中存在的记录:');
    all.forEach(r => {
      const issues = (r.boundary_issues || []).map(i => i.issueType).join('+') || '—';
      console.log(`   ${r.id.padEnd(14)} ${r.sensor_id.padEnd(20)} status=${r.current_status.padEnd(20)} qc=${String(r.qc_review_required).padEnd(5)} boundary=[${issues}]`);
    });
  } else {
    console.log('当前数据文件为空。');
  }

  console.log('');
  console.log('💡 请先运行以下命令之一来构建数据:');
  console.log('   npm run prepare-demo       ← 一次性构建完整返工场景（推荐，含 REC-002 采样缺半小时 + 返工）');
  console.log('   npm run import             ← 只导入传感器数据，后续自己走流程');
  console.log('');
  process.exit(1);
}
