const { cliBootstrap } = require('../src/cli-bootstrap');
const workflowEngine = require('../src/engine/workflow-engine');
const { STATUS } = require('../src/models/boundary-rules');

const { dataFile, loadResult, getArg, dataStore } = cliBootstrap({ forceReset: true });

const S = '='.repeat(72);
const D = '-'.repeat(72);

console.log(S);
console.log('🏭 构建完整演示场景（持久化到数据文件）');
console.log(S);
console.log(`数据文件: ${dataFile}`);
console.log(`模式: 重置后新建 (--reset)`);
console.log('');
console.log('场景: 3条传感器记录 + REC-002 采样时间缺半小时 + 返工链');
console.log('');

const demoData = [
  { sensor_id: 'SEN-2024-001', sensor_name: '1号水轮机进口压力传感器', turbine_id: 'TURBINE-A-01',
    sampling_time: '2024-06-15T08:00:00.000Z', sampling_start_time: '2024-06-15T08:00:00.000Z', sampling_end_time: '2024-06-15T09:00:00.000Z',
    efficiency: 92.5, flow_rate: 45.2, head: 38.6, power: 15800 },
  { sensor_id: 'SEN-2024-002', sensor_name: '1号水轮机出口压力传感器【采样缺半小时】', turbine_id: 'TURBINE-A-01',
    sampling_time: '2024-06-15T10:35:00.000Z', sampling_start_time: '2024-06-15T10:35:00.000Z', sampling_end_time: '2024-06-15T10:55:00.000Z',
    efficiency: 91.8, flow_rate: 44.8, head: 38.2, power: 15600 },
  { sensor_id: 'SEN-2024-003', sensor_name: '2号水轮机进口压力传感器', turbine_id: 'TURBINE-A-02',
    sampling_time: '2024-06-15T11:00:00.000Z', sampling_start_time: '2024-06-15T11:00:00.000Z', sampling_end_time: '2024-06-15T12:00:00.000Z',
    efficiency: 93.1, flow_rate: 46.5, head: 39.1, power: 16200 }
];

function phase(title) {
  console.log(D);
  console.log(title);
  console.log(D);
}

let assertions = [];
function assert(label, condition, ok, fail) {
  if (condition) { assertions.push({ pass: true, label, detail: ok }); console.log(`   ✅ ${label}${ok ? ' — ' + ok : ''}`); }
  else { assertions.push({ pass: false, label, detail: fail }); console.log(`   ❌ ${label}${fail ? ' — ' + fail : ''}`); }
}

// Phase 1: Import
phase('📥 Phase 1: 导入传感器数据（自动跑边界规则）');
const importResult = workflowEngine.importSensorData(demoData, 'prepare-demo');
console.log(`批次 ${importResult.batch_id} | ${importResult.record_count} 条记录`);

const rec002 = dataStore.getRecordById('REC-002');
assert('REC-002 原始行号=2', rec002.original_line_no === 2, '', `值=${rec002.original_line_no}`);
assert('REC-002 边界问题数=2（间隔95min + 时长20min）',
  rec002.boundary_issues && rec002.boundary_issues.length === 2,
  rec002.boundary_issues.map(i => i.issueType).join(','), `数=${rec002.boundary_issues && rec002.boundary_issues.length}`);
assert('REC-002 自动 NEED_QC_REVIEW + qc_review_required=true',
  rec002.current_status === STATUS.NEED_QC_REVIEW && rec002.qc_review_required === true,
  `status=${rec002.current_status} qc=${rec002.qc_review_required}`, '');
console.log('');

// Phase 2: Engineer review
phase('👨‍🔧 Phase 2: 何工评审（补工况照片 + 备注）');
['REC-001', 'REC-002', 'REC-003'].forEach(id => {
  const notes = id === 'REC-002'
    ? '翻传感器编号发现采样缺半小时，等现场照片确认，暂不发结论'
    : '工况正常，校准记录完整';
  workflowEngine.engineerReview(id, '何工', notes, [`${id}-photo1.jpg`, `${id}-photo2.jpg`]);
});
assert('REC-002 工程师评审后仍保持 NEED_QC_REVIEW（有边界问题强制停）',
  dataStore.getRecordById('REC-002').current_status === STATUS.NEED_QC_REVIEW,
  '', `status=${dataStore.getRecordById('REC-002').current_status}`);
assert('REC-002 工况照片已上传',
  dataStore.getRecordById('REC-002').work_condition_photos.length >= 2,
  `照片数=${dataStore.getRecordById('REC-002').work_condition_photos.length}`, '');
console.log('');

// Phase 3: 正常记录终态 + QC催促
phase('📐 Phase 3: 正常记录终态，质检员晚上催 REC-002');
['REC-001', 'REC-003'].forEach(id => {
  workflowEngine.finalizeConclusion(id, '何工', `${id} 效率测试合格，数据对应无误，复盘图已更新。`);
});
console.log('质检员: REC-002 怎么没结论？');
console.log('何工: 采样缺半小时，不敢直接发，等你复核。');
console.log('');

// Phase 4: QC
phase('✅ Phase 4: 质检员复核 REC-002（采样缺半小时这条）');
workflowEngine.qcApprove('REC-002', '质检员',
  '现场确认调试中断35分钟，采样点虽少但稳定，工况照片对应得上，通过。');
const afterQC = dataStore.getRecordById('REC-002');
assert('REC-002 QC后 qc_review_required=false（派生同步）',
  afterQC.qc_review_required === false, '', `值=${afterQC.qc_review_required}`);

workflowEngine.finalizeConclusion('REC-002', '何工',
  '1号水轮机出口效率测试合格。虽采样中断35分钟，但QC已确认数据有效，效率91.8%在正常范围。');
const OLD_CONCLUSION = dataStore.getRecordById('REC-002').conclusion;
const OLD_VERSION = dataStore.getRecordById('REC-002').conclusion_version;
assert('REC-002 已终态 FINALIZED',
  dataStore.getRecordById('REC-002').current_status === STATUS.STATUS_FINALIZED,
  `version=V${OLD_VERSION}`, '');
console.log(`   旧结论: ${OLD_CONCLUSION}`);
console.log('');

// Phase 5: Rework
phase('🔄 Phase 5: 返工 —— 补到阀门开度照片，原结论被推翻');
console.log('第二天现场补到阀门开度照片: 出口阀门仅开65%（原误报100%）');
const reworkResult = workflowEngine.createRework(
  'REC-002', '何工',
  '补充阀门开度照片证据: 出口阀门实际仅开65%，原结论低估损失。',
  ['rework-valve-65pct.jpg', 'rework-valve-plate.png', 'rework-scene-photo.jpg']
);
const OLD_ID = reworkResult.old_record_id;
const NEW_ID = reworkResult.new_record_id;
console.log(`旧记录: ${OLD_ID}  →  新记录: ${NEW_ID}`);

const OLD_REC = dataStore.getRecordById(OLD_ID);
const NEW_REC = dataStore.getRecordById(NEW_ID);
assert('旧记录状态 SUPERSEDED', OLD_REC.current_status === STATUS.SUPERSEDED,
  '', `status=${OLD_REC.current_status}`);
assert('旧记录 superseded_by 指向新记录', OLD_REC.superseded_by === NEW_ID,
  `superseded_by=${OLD_REC.superseded_by}`, '');
assert('旧结论内容保留（不被覆盖）', OLD_REC.conclusion === OLD_CONCLUSION,
  `仍为 V${OLD_REC.conclusion_version}: "${OLD_REC.conclusion.slice(0, 20)}..."`,
  '旧结论被覆盖了!');
assert('新记录 previous_versions 含旧结论关联',
  NEW_REC.previous_versions && NEW_REC.previous_versions.some(p => p.superseded_from === OLD_ID),
  `历史版本数=${NEW_REC.previous_versions.length}`, '');
assert('统计: superseded_records=1', dataStore.getStatistics().superseded_records === 1,
  `值=${dataStore.getStatistics().superseded_records}`, '');

// 新记录走完流程
workflowEngine.submitForQcReview(NEW_ID, '何工', '返工新结论需QC复核');
workflowEngine.qcApprove(NEW_ID, '质检员', '阀门照片证据充分，返工合理，同意修正。');
workflowEngine.finalizeConclusion(NEW_ID, '何工',
  `${NEW_ID} 修正结论：阀门实际仅65%开度导致出口效率91.8%低于预期，需调至全开后复测；旧结论 ${OLD_ID} 已标记被替代。`);
console.log(`新结论 V${dataStore.getRecordById(NEW_ID).conclusion_version}: ${dataStore.getRecordById(NEW_ID).conclusion.slice(0, 40)}...`);
console.log('');

// Phase 6: Consistency
phase('🔗 Phase 6: 三方一致性自检');
const c = dataStore.verifyConsistency();
assert('verifyConsistency() 通过', c.passed === true, c.summary, c.issues.join('; '));

const apiLen = dataStore.getUnifiedView().length;
const expLen = JSON.parse(dataStore.getExportData('json')).length;
assert('API长度 == JSON导出长度', apiLen === expLen, `${apiLen}条`, `API=${apiLen} vs EXPORT=${expLen}`);

const csv = dataStore.getExportData('csv');
assert('CSV包含旧记录ID', csv.includes(OLD_ID), '', '缺失');
assert('CSV包含新记录ID', csv.includes(NEW_ID), '', '缺失');
assert('CSV包含 SUPERSEDED 状态', csv.includes('SUPERSEDED'), '', '缺失');
console.log('');

// 总结
const passCount = assertions.filter(a => a.pass).length;
const failCount = assertions.filter(a => !a.pass).length;

console.log(S);
console.log(`🏁 场景构建完成 —— ${passCount}/${assertions.length} 项断言通过`);
console.log(S);
console.log('');

const stats = dataStore.getStatistics();
console.log('📊 数据文件内容统计:');
console.log(`   总记录数:         ${stats.total_records}`);
console.log(`   需QC复核:         ${stats.needs_qc_review}`);
console.log(`   含边界问题:       ${stats.has_boundary_issues}`);
console.log(`   已终态:           ${stats.finalized_records}`);
console.log(`   被返工替代:       ${stats.superseded_records}`);
console.log(`   返工链中记录:     ${stats.records_in_rework_chain}`);
console.log('');

console.log(`💾 数据已持久化到: ${dataFile}`);
console.log('');
console.log('🎯 何工后续可独立执行的命令（同一份数据）:');
console.log('');
console.log('   ① 审计重放 REC-002 的完整证据链:');
console.log(`      npm run replay -- --record-id=${OLD_ID}`);
console.log('');
console.log('   ② 列出版本后回滚 REC-002 到 NEED_QC_REVIEW:');
console.log(`      npm run rollback -- --record-id=${OLD_ID} --version=-1`);
console.log(`      npm run rollback -- --record-id=${OLD_ID} --version=1 --operator=质检员-撤销`);
console.log('');
console.log('   ③ 导出全部/筛选明细:');
console.log('      npm run export -- --format=csv --output=out/all.csv');
console.log('      npm run export -- --format=csv --needs-qc-review=true  ← 采样缺半小时这类');
console.log('      npm run export -- --format=csv --status=SUPERSEDED     ← 被返工替代的旧结论');
console.log('');
console.log('   ④ 启动Web UI查看（自动加载同一份数据）:');
console.log('      npm start');
console.log('');
console.log('🔄 想重新构建？直接再跑一次本命令（会 --reset 清空重建）:');
console.log('      npm run prepare-demo');
console.log('');
console.log('📁 备用样例入口（不依赖已删除材料）:');
console.log('      data/sample-sensors.json   ← 原始传感器数据，随时可重建');
console.log('      npm run import             ← 只导入数据，从头走流程');
console.log('');

if (failCount > 0) {
  console.log('⚠️  有断言失败，请检查以上红色项');
  process.exit(1);
}
