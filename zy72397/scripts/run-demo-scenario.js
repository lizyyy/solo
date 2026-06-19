const { cliBootstrap } = require('../src/cli-bootstrap');
const workflowEngine = require('../src/engine/workflow-engine');
const { STATUS, BOUNDARY_RULES } = require('../src/models/boundary-rules');

const { dataFile, autoSave, dataStore } = cliBootstrap({ forceReset: true });

const S = '='.repeat(72);
const D = '-'.repeat(72);
let assertions = [];
function assert(label, condition, detailOk, detailFail) {
  if (condition) {
    assertions.push({ pass: true, label, detail: detailOk });
    console.log(`✅  ASSERT-PASS: ${label}${detailOk ? ' | ' + detailOk : ''}`);
  } else {
    assertions.push({ pass: false, label, detail: detailFail });
    console.log(`❌  ASSERT-FAIL: ${label}${detailFail ? ' | ' + detailFail : ''}`);
  }
}

console.log(S);
console.log('🚀 水轮机效率回放 - 完整场景演示（含端到端断言）');
console.log(S);
console.log('');
console.log('边界规则（代码与README同步）:');
console.log(`   间隔阈值: ${BOUNDARY_RULES.MAX_SAMPLING_GAP_MINUTES} 分钟`);
console.log(`   时长阈值: ${BOUNDARY_RULES.THEORETICAL_SAMPLING_MINUTES * BOUNDARY_RULES.MIN_SAMPLING_DURATION_RATIO} 分钟 (理论值 × ${BOUNDARY_RULES.MIN_SAMPLING_DURATION_RATIO})`);
console.log('');

const demoData = [
  { sensor_id:'SEN-2024-001', sensor_name:'1号水轮机进口压力传感器', turbine_id:'TURBINE-A-01',
    sampling_time:'2024-06-15T08:00:00.000Z', sampling_start_time:'2024-06-15T08:00:00.000Z', sampling_end_time:'2024-06-15T09:00:00.000Z',
    efficiency:92.5, flow_rate:45.2, head:38.6, power:15800 },
  { sensor_id:'SEN-2024-002', sensor_name:'1号水轮机出口压力传感器【采样缺半小时】', turbine_id:'TURBINE-A-01',
    sampling_time:'2024-06-15T10:35:00.000Z', sampling_start_time:'2024-06-15T10:35:00.000Z', sampling_end_time:'2024-06-15T10:55:00.000Z',
    efficiency:91.8, flow_rate:44.8, head:38.2, power:15600 },
  { sensor_id:'SEN-2024-003', sensor_name:'2号水轮机进口压力传感器', turbine_id:'TURBINE-A-02',
    sampling_time:'2024-06-15T11:00:00.000Z', sampling_start_time:'2024-06-15T11:00:00.000Z', sampling_end_time:'2024-06-15T12:00:00.000Z',
    efficiency:93.1, flow_rate:46.5, head:39.1, power:16200 }
];

// ============ Phase 1: Import ============
console.log('📥 Phase 1: 传感器编号第一次导入（自动跑边界规则）');
console.log(D);
const importResult = workflowEngine.importSensorData(demoData, '数据录入员');
console.log(`批次: ${importResult.batch_id} | 记录数: ${importResult.record_count} | IDs: ${importResult.records.join(', ')}`);

const rec002 = dataStore.getRecordById('REC-002');
assert('REC-002 原始行号保留 (original_line_no=2)',
  rec002.original_line_no === 2,
  `值=${rec002.original_line_no}`,
  `值=${rec002.original_line_no}, 期望值=2`);

assert('REC-002 导入批次保留 (import_batch_id=BATCH-001)',
  rec002.import_batch_id === 'BATCH-001',
  `值=${rec002.import_batch_id}`,
  `值=${rec002.import_batch_id}`);

assert('REC-002 边界规则命中: 采样间隔95分钟 + 时长20分钟 → 2个问题',
  Array.isArray(rec002.boundary_issues) && rec002.boundary_issues.length === 2,
  `问题=${rec002.boundary_issues.map(i => i.issueType).join(', ')}`,
  `问题数=${rec002.boundary_issues.length}`);

assert('REC-002 自动标记 NEED_QC_REVIEW（不自动归正常）',
  rec002.current_status === STATUS.NEED_QC_REVIEW,
  `status=${rec002.current_status}`,
  `status=${rec002.current_status}, 期望=${STATUS.NEED_QC_REVIEW}`);

assert('REC-002 qc_review_required=true (派生字段同步)',
  rec002.qc_review_required === true,
  `值=${rec002.qc_review_required}`,
  `值=${rec002.qc_review_required}`);

const stats1 = dataStore.getStatistics();
assert('统计: needs_qc_review 至少 1（REC-002）',
  stats1.needs_qc_review >= 1,
  `needs_qc_review=${stats1.needs_qc_review}`,
  `needs_qc_review=${stats1.needs_qc_review}`);

console.log('');

// ============ Phase 2: Engineer Review ============
console.log('👨‍🔧 Phase 2: 设备工程师何工补看工况照片（三步工作流第2步）');
console.log(D);
['REC-001', 'REC-002', 'REC-003'].forEach(id => {
  const notes = id === 'REC-002'
    ? '翻到传感器编号发现采样间隔缺，时长只有20分钟，等现场照片确认'
    : '工况正常，传感器校准记录完整';
  workflowEngine.engineerReview(id, '何工', notes, [`${id}-photo1.jpg`, `${id}-photo2.jpg`]);
  console.log(`   ${id} 何工已评审，工况照片已补充`);
});

const rec002AfterEng = dataStore.getRecordById('REC-002');
assert('REC-002 工程师评审后仍保持 NEED_QC_REVIEW（有边界问题强制停）',
  rec002AfterEng.current_status === STATUS.NEED_QC_REVIEW,
  `status=${rec002AfterEng.current_status}`,
  `status=${rec002AfterEng.current_status}, 不能跳到 ENGINEER_REVIEWED`);

assert('REC-002 manual_changes 有 engineer_notes 改动记录（质检员可查）',
  rec002AfterEng.manual_changes.some(c => c.field === 'engineer_notes'),
  `改动数=${rec002AfterEng.manual_changes.length}`,
  `未找到 engineer_notes 改动，改动列表=${rec002AfterEng.manual_changes.map(c=>c.field).join(',')}`);

assert('REC-002 work_condition_photos 已上传 (何工补看)',
  Array.isArray(rec002AfterEng.work_condition_photos) && rec002AfterEng.work_condition_photos.length >= 2,
  `照片数=${rec002AfterEng.work_condition_photos.length}`,
  `照片数=${rec002AfterEng.work_condition_photos.length}`);

console.log('');

// ============ Phase 3: 正常记录先终态，质检员晚上催 REC-002 ============
console.log('📐 Phase 3: 正常记录终态，质检员晚上催 REC-002');
console.log(D);
['REC-001', 'REC-003'].forEach(id => {
  workflowEngine.finalizeConclusion(id, '何工', `${id} 效率测试合格，数据对应无误`);
});
console.log('   REC-001 / REC-003 → 终态，实验复盘图已更新');
console.log('');
console.log('质检员（晚上催结果）: REC-002 怎么没结论？');
console.log('何工: 我翻传感器编号发现那条采样间隔缺半小时，不敢直接发');
console.log(`系统显示 REC-002 当前状态: ${dataStore.getRecordById('REC-002').current_status}`);
console.log(`系统显示 REC-002 边界问题: ${dataStore.getRecordById('REC-002').boundary_issues.map(i=>i.message).join(' | ')}`);
console.log('质检员: 好，我来复核');
console.log('');

// ============ Phase 4: QC ============
console.log('✅ Phase 4: 质检员复核 REC-002（采样时间缺半小时这条）');
console.log(D);
workflowEngine.qcApprove('REC-002', '质检员',
  '现场确认：当时设备调试中断35分钟，采样点虽少但稳定；工况照片对应得上；通过。');
const rec002AfterQC = dataStore.getRecordById('REC-002');
assert('REC-002 QC通过后状态=QC_APPROVED',
  rec002AfterQC.current_status === STATUS.QC_APPROVED,
  `status=${rec002AfterQC.current_status}`,
  `status=${rec002AfterQC.current_status}`);
assert('REC-002 QC通过后 qc_review_required=false（派生字段同步）',
  rec002AfterQC.qc_review_required === false,
  `值=${rec002AfterQC.qc_review_required}`,
  `值=${rec002AfterQC.qc_review_required}，应同步改为false`);
console.log('');

workflowEngine.finalizeConclusion('REC-002', '何工',
  '1号水轮机出口效率测试合格，虽采样中断35分钟但QC已确认数据有效，效率91.8%在正常范围。');
const rec002Final = dataStore.getRecordById('REC-002');
const OLD_CONCLUSION = rec002Final.conclusion;
const OLD_CONCLUSION_VERSION = rec002Final.conclusion_version;
assert('REC-002 已终态 FINALIZED',
  rec002Final.current_status === STATUS.STATUS_FINALIZED,
  `status=${rec002Final.current_status}, 结论版本=v${OLD_CONCLUSION_VERSION}`,
  `status=${rec002Final.current_status}`);
console.log(`   旧结论 V${OLD_CONCLUSION_VERSION}: ${OLD_CONCLUSION}`);
console.log('');

// ============ Phase 5: Rework ============
console.log('🔄 Phase 5: 返工场景 - 补到工况照片，原结论被推翻');
console.log(D);
console.log('第二天现场补到阀门开度照片，发现原结论低估损失...');
console.log('');

const reworkResult = workflowEngine.createRework(
  'REC-002',
  '何工',
  '补充现场阀门开度照片显示出口阀门仅开了65%（原误报为100%），导致出口效率表面正常，实际存在显著偏低。',
  ['rework-valve-openness-65pct.jpg', 'rework-valve-plate-evidence.png']
);

const OLD_REC_ID = reworkResult.old_record_id;
const NEW_REC_ID = reworkResult.new_record_id;
console.log(`返工结果: 旧记录=${OLD_REC_ID}  新记录=${NEW_REC_ID}`);
console.log('');

const OLD_REC = dataStore.getRecordById(OLD_REC_ID);
const NEW_REC = dataStore.getRecordById(NEW_REC_ID);

// -- assertions on old record (most important per user requirements) --
assert('返工: 旧记录状态 SUPERSEDED（不能再被当作现行结论）',
  OLD_REC.current_status === STATUS.SUPERSEDED,
  `status=${OLD_REC.current_status}`,
  `status=${OLD_REC.current_status}, 期望=${STATUS.SUPERSEDED}`);

assert('返工: 旧记录 superseded_by 写入新记录ID（证据链不能断）',
  OLD_REC.superseded_by === NEW_REC_ID,
  `superseded_by=${OLD_REC.superseded_by}`,
  `superseded_by=${OLD_REC.superseded_by}, 期望=${NEW_REC_ID} （质检员查看时能追到哪条记录替代了它）`);

assert('返工: 旧结论内容保留（不删除/不覆盖）',
  OLD_REC.conclusion === OLD_CONCLUSION,
  `结论仍为 V${OLD_REC.conclusion_version}: "${OLD_REC.conclusion ? OLD_REC.conclusion.slice(0, 24) + '...' : ''}"`,
  `旧结论被覆盖或丢失! 当前="${OLD_REC.conclusion}", 原="${OLD_CONCLUSION}"`);

assert('返工: 旧记录 status_history 写入 SUPERSEDED + 旧结论快照',
  OLD_REC.status_history.length >= 2 &&
  OLD_REC.status_history[OLD_REC.status_history.length - 1].status === STATUS.SUPERSEDED &&
  OLD_REC.status_history[OLD_REC.status_history.length - 1].old_conclusion,
  `SUPERSEDED节点存在，记录了旧结论`,
  `status_history末尾=${OLD_REC.status_history[OLD_REC.status_history.length-1].status}`);

assert('返工: 旧记录 previous_versions 包含原结论（便于对比复盘图变化）',
  Array.isArray(OLD_REC.previous_versions) && OLD_REC.previous_versions.length >= 1,
  `历史版本数=${OLD_REC.previous_versions.length}`,
  `历史版本数=${OLD_REC.previous_versions.length}`);

// -- assertions on new record --
assert('返工: 新记录 previous_versions 包含被替代记录的旧结论（何工能看到复盘图为啥变）',
  Array.isArray(NEW_REC.previous_versions) && NEW_REC.previous_versions.length >= 1
  && NEW_REC.previous_versions[0].superseded_from === OLD_REC_ID,
  `new.previous_versions[0].superseded_from=${NEW_REC.previous_versions[0] && NEW_REC.previous_versions[0].superseded_from}`,
  `新记录没把旧结论当历史版本带过来！数=${NEW_REC.previous_versions.length}`);

assert('返工: 新记录 manual_changes 有 rework_from 字段（证据链）',
  NEW_REC.manual_changes.some(c => c.field === 'rework_from' && c.new_value === NEW_REC_ID),
  `找到 rework_from 改动`,
  `改动字段列表=${NEW_REC.manual_changes.map(c=>c.field).join(',')}`);

assert('统计: superseded_records ≥ 1',
  dataStore.getStatistics().superseded_records >= 1,
  `superceded=${dataStore.getStatistics().superseded_records}`,
  `统计没把 SUPERSEDED 算进去！`);

assert('统计: records_in_rework_chain ≥ 2（旧+新都在返工链中）',
  dataStore.getStatistics().records_in_rework_chain >= 2,
  `chain_count=${dataStore.getStatistics().records_in_rework_chain}`,
  `返工链统计异常`);

console.log('');
console.log('何工在新记录上补QC与终态...');
workflowEngine.submitForQcReview(NEW_REC_ID, '何工', '返工新结论需复核');
workflowEngine.qcApprove(NEW_REC_ID, '质检员',
  '阀门照片证据充分，返工理由合理，同意修正。');
workflowEngine.finalizeConclusion(NEW_REC_ID, '何工',
  `${NEW_REC_ID} 修正结论：阀门仅65%开度导致出口效率91.8%低于预期，需调至全开后复测；旧结论 ${OLD_REC_ID} 已标记被替代。`);
const NEW_REC_FINAL = dataStore.getRecordById(NEW_REC_ID);
console.log(`   新结论 V${NEW_REC_FINAL.conclusion_version}: ${NEW_REC_FINAL.conclusion}`);
console.log('');

// ============ Phase 6: Tripartite Consistency ============
console.log('� Phase 6: 三方一致性核对（页面/API/导出同一份数据源）');
console.log(D);

const consistency = dataStore.verifyConsistency();
assert('三方一致性自检全部通过 (verifyConsistency())',
  consistency.passed === true,
  consistency.summary,
  `问题: ${consistency.issues.join('; ')}`);

const API_VIEW = dataStore.getUnifiedView();
const EXPORT_JSON = JSON.parse(dataStore.getExportData('json'));
assert('API getUnifiedView 长度 = JSON导出长度',
  API_VIEW.length === EXPORT_JSON.length,
  `双方长度=${API_VIEW.length}`,
  `API=${API_VIEW.length} vs EXPORT=${EXPORT_JSON.length}`);

API_VIEW.forEach((apiRec, idx) => {
  const expRec = EXPORT_JSON[idx];
  ['id','current_status','qc_review_required','superseded_by','conclusion_version'].forEach(k => {
    assert(`字段对齐 [${apiRec.id}].${k}`,
      JSON.stringify(apiRec[k]) === JSON.stringify(expRec[k]),
      `API=${JSON.stringify(apiRec[k])} == EXPORT=${JSON.stringify(expRec[k])}`,
      `API=${JSON.stringify(apiRec[k])} vs EXPORT=${JSON.stringify(expRec[k])}`);
  });
});

// REC-002 (old) 在导出中必须仍然存在 + SUPERSEDED + 带边界问题 (绝不隐藏)
const rec002InExport = EXPORT_JSON.find(r => r.id === OLD_REC_ID);
assert(`旧记录 ${OLD_REC_ID} 在导出文件中仍然存在（不隐藏有问题的记录）`,
  !!rec002InExport,
  `存在于导出`,
  `缺失！质检员找不到证据链`);
if (rec002InExport) {
  assert(`旧记录 ${OLD_REC_ID} 导出: current_status=SUPERSEDED`,
    rec002InExport.current_status === STATUS.SUPERSEDED,
    `导出status=${rec002InExport.current_status}`,
    `导出status=${rec002InExport.current_status}`);
  assert(`旧记录 ${OLD_REC_ID} 导出: 仍带边界问题（采样缺半小时的证据不丢）`,
    Array.isArray(rec002InExport.boundary_issues) && rec002InExport.boundary_issues.length >= 1,
    `导出边界问题数=${rec002InExport.boundary_issues.length}`,
    `导出边界问题丢失！数=${rec002InExport.boundary_issues && rec002InExport.boundary_issues.length}`);
  assert(`旧记录 ${OLD_REC_ID} 导出: superseded_by=${NEW_REC_ID}`,
    rec002InExport.superseded_by === NEW_REC_ID,
    `导出superseded_by=${rec002InExport.superseded_by}`,
    `导出superseded_by=${rec002InExport.superseded_by}, 应=${NEW_REC_ID}`);
}

// 导出 CSV 也必须包含这些字段
const csvText = dataStore.getExportData('csv');
assert('CSV导出包含旧记录ID列', csvText.includes(OLD_REC_ID),
  `CSV中找到 ${OLD_REC_ID}`,
  `CSV中缺失 ${OLD_REC_ID}`);
assert('CSV导出包含新记录ID列', csvText.includes(NEW_REC_ID),
  `CSV中找到 ${NEW_REC_ID}`,
  `CSV中缺失 ${NEW_REC_ID}`);
assert('CSV导出包含 SUPERSEDED (不能丢掉状态)',
  csvText.includes('SUPERSEDED'),
  '找到SUPERSEDED状态',
  'CSV状态列把SUPERSEDED弄丢了');
assert('CSV导出包含 "返工后被哪条新记录替代" 这一证据链列',
  csvText.includes(NEW_REC_ID) && csvText.includes(OLD_REC_ID),
  '返工替代关系可追溯',
  '缺失返工证据链');

console.log('');

// ============ Phase 7: Rollback ============
console.log('⏪ Phase 7: 回滚演示 - 重点核对派生字段(qc_review_required / boundary_issues)同步');
console.log(D);

const newRecBefore = dataStore.getRecordById(NEW_REC_ID);
const newRecStatusHistBeforeLength = newRecBefore.status_history.length;
console.log(`   将 ${NEW_REC_ID} 回滚到 status_history 索引 0 (回到刚创建的 ENGINEER_REVIEWED 那一刻)`);

const newRecRollback = workflowEngine.rollbackToVersion(NEW_REC_ID, 0, 'system');
assert(`回滚后 ${NEW_REC_ID} 状态 = ENGINEER_REVIEWED`,
  newRecRollback.current_status === STATUS.STATUS_ENGINEER_REVIEWED,
  `status=${newRecRollback.current_status}`,
  `status=${newRecRollback.current_status}`);

assert(`回滚后 ${NEW_REC_ID} qc_review_required=false（按派生规则同步）`,
  newRecRollback.qc_review_required === false,
  `qc_review_required=${newRecRollback.qc_review_required}`,
  `qc_review_required=${newRecRollback.qc_review_required}（只改了current_status没同步派生字段！）`);

assert(`回滚后 ${NEW_REC_ID} status_history 多了一条 rollback 追踪`,
  newRecRollback.status_history.length >= newRecStatusHistBeforeLength + 1,
  `新增长度=${newRecRollback.status_history.length - newRecStatusHistBeforeLength}`,
  `没把回滚动作写入审计追踪`);

// 再滚一次，专门针对 "采样缺半小时 → NEED_QC_REVIEW" 这条（核心）
console.log('');
console.log(`   将 ${OLD_REC_ID} 回滚到 status_history 索引 1 (回到 NEED_QC_REVIEW 那一刻，模拟质检员撤销通过)`);
const oldRecIdx1 = 1; // NEED_QC_REVIEW 节点
const oldRecRollback = workflowEngine.rollbackToVersion(OLD_REC_ID, oldRecIdx1, '质检员-撤销');
assert(`回滚 ${OLD_REC_ID} 到 NEED_QC_REVIEW → status=NEED_QC_REVIEW`,
  oldRecRollback.current_status === STATUS.NEED_QC_REVIEW,
  `status=${oldRecRollback.current_status}`,
  `status=${oldRecRollback.current_status}`);

assert(`回滚 ${OLD_REC_ID} 到 NEED_QC_REVIEW → qc_review_required=true（派生字段同步是核心要求）`,
  oldRecRollback.qc_review_required === true,
  `qc_review_required=${oldRecRollback.qc_review_required}`,
  `qc_review_required=${oldRecRollback.qc_review_required}，没同步！页面会说成功但接口仍读false`);

assert(`回滚 ${OLD_REC_ID} 后，边界问题数组仍在（证据不丢）`,
  Array.isArray(oldRecRollback.boundary_issues) && oldRecRollback.boundary_issues.length >= 1,
  `边界问题数=${oldRecRollback.boundary_issues.length}`,
  `边界问题在回滚后丢了！`);

console.log('');

// ============ Phase 8: Consistency after rollback ============
console.log('🔗 Phase 8: 回滚后的三方一致性（尤其要防止页面OK/接口不一致）');
console.log(D);
const consistency2 = dataStore.verifyConsistency();
assert('回滚后三方一致性自检仍然通过',
  consistency2.passed === true,
  consistency2.summary,
  `问题: ${consistency2.issues.join('; ')}`);

const apiViewAfterRb = dataStore.getUnifiedView();
const exportAfterRb = JSON.parse(dataStore.getExportData('json'));
assert('回滚后 API长度 == JSON导出长度',
  apiViewAfterRb.length === exportAfterRb.length,
  `长度=${apiViewAfterRb.length}`,
  `API=${apiViewAfterRb.length} vs EXPORT=${exportAfterRb.length}`);

const oldRecAfterInApi = apiViewAfterRb.find(r => r.id === OLD_REC_ID);
const oldRecAfterInExp = exportAfterRb.find(r => r.id === OLD_REC_ID);
['current_status','qc_review_required','superseded_by','conclusion_version'].forEach(k => {
  assert(`回滚后旧记录 ${OLD_REC_ID}.${k} 三方一致`,
    JSON.stringify(oldRecAfterInApi[k]) === JSON.stringify(oldRecAfterInExp[k]),
    `API=${JSON.stringify(oldRecAfterInApi[k])} == EXPORT=${JSON.stringify(oldRecAfterInExp[k])}`,
    `API=${JSON.stringify(oldRecAfterInApi[k])} vs EXPORT=${JSON.stringify(oldRecAfterInExp[k])} （回滚导致不一致！）`);
});

console.log('');

// ============ Summary ============
const passCount = assertions.filter(a => a.pass).length;
const failCount = assertions.filter(a => !a.pass).length;
console.log(S);
console.log(`🏁 演示完成 - 断言汇总: ${passCount} 通过 / ${failCount} 失败 / ${assertions.length} 总计`);
console.log(S);
console.log('');
console.log('📊 最终统计:');
const fs = dataStore.getStatistics();
console.log(JSON.stringify(fs, null, 2).replace(/\n/g, '\n   '));
console.log('');
console.log('💡 可复现命令（能跑出以上完全同样的步骤与断言）:');
console.log('   npm run demo              ← 你现在看到的这份');
console.log('   npm run verify            ← 只跑断言，不打印步骤');
console.log('   npm start                 ← 启动 Web UI，点"一键跑导入→三步→返工"');
console.log('   npm run rollback -- --record-id=REC-002 --version=1  ← 命令行回滚');
console.log('   npm run export -- --format=csv --needs-qc-review=true  ← 导出需QC复核的（采样缺半小时）');
console.log('');

process.exit(failCount > 0 ? 1 : 0);
