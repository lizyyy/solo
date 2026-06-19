const { cliBootstrap } = require('../src/cli-bootstrap');
const workflowEngine = require('../src/engine/workflow-engine');
const { STATUS, BOUNDARY_RULES } = require('../src/models/boundary-rules');

const { dataStore } = cliBootstrap({ forceReset: true });

let passed = 0, failed = 0;
const issues = [];

function assert(label, condition, ok, fail) {
  if (condition) { passed++; console.log(`  ✔ ${label}${ok ? ': ' + ok : ''}`); }
  else { failed++; issues.push(label + ' - ' + (fail || '')); console.log(`  ✘ ${label}${fail ? ': ' + fail : ''}`); }
}

const demoData = [
  { sensor_id:'SEN-2024-001', sensor_name:'1号水轮机进口', turbine_id:'TURBINE-A-01',
    sampling_time:'2024-06-15T08:00:00.000Z', sampling_start_time:'2024-06-15T08:00:00.000Z', sampling_end_time:'2024-06-15T09:00:00.000Z',
    efficiency:92.5, flow_rate:45.2, head:38.6, power:15800 },
  { sensor_id:'SEN-2024-002', sensor_name:'1号水轮机出口【采样缺半小时】', turbine_id:'TURBINE-A-01',
    sampling_time:'2024-06-15T10:35:00.000Z', sampling_start_time:'2024-06-15T10:35:00.000Z', sampling_end_time:'2024-06-15T10:55:00.000Z',
    efficiency:91.8, flow_rate:44.8, head:38.2, power:15600 },
  { sensor_id:'SEN-2024-003', sensor_name:'2号水轮机进口', turbine_id:'TURBINE-A-02',
    sampling_time:'2024-06-15T11:00:00.000Z', sampling_start_time:'2024-06-15T11:00:00.000Z', sampling_end_time:'2024-06-15T12:00:00.000Z',
    efficiency:93.1, flow_rate:46.5, head:39.1, power:16200 }
];

console.log('===========================================================');
console.log('🔬 水轮机效率回放 - 端到端核对 (npm run verify)');
console.log('===========================================================');

// 1. Import
console.log('\n[1/6] 导入 → 自动判定边界规则 → 强制 NEED_QC_REVIEW:');
const r = workflowEngine.importSensorData(demoData, 'input');
const rec002 = dataStore.getRecordById('REC-002');

assert('REC-002 原始行号=2', rec002.original_line_no === 2, '', `值=${rec002.original_line_no}`);
assert('REC-002 采样间隔95分钟 + 时长20分钟 → 2个边界问题',
  rec002.boundary_issues.length === 2,
  rec002.boundary_issues.map(x => x.issueType).join(','),
  `数=${rec002.boundary_issues.length}`);
assert('REC-002 状态 NEED_QC_REVIEW（不自动归正常）',
  rec002.current_status === STATUS.NEED_QC_REVIEW,
  '', `status=${rec002.current_status}`);
assert('REC-002 qc_review_required=true（派生同步）',
  rec002.qc_review_required === true,
  '', `值=${rec002.qc_review_required}`);
assert('API统一视图含REC-002的qc_review_required=true',
  dataStore.getUnifiedView().find(x => x.id === 'REC-002').qc_review_required === true,
  '', '');
assert('JSON导出含REC-002且qc_review_required=true',
  JSON.parse(dataStore.getExportData('json')).find(x => x.id === 'REC-002').qc_review_required === true,
  '', '');

// 2. Engineer review
console.log('\n[2/6] 何工评审（REC-002有边界问题，状态不跳ENGINEER_REVIEWED）:');
['REC-001','REC-002','REC-003'].forEach(id =>
  workflowEngine.engineerReview(id, '何工', '备注', [`${id}-1.jpg`, `${id}-2.jpg`])
);
assert('REC-002 NEED_QC_REVIEW仍保留（强制停）',
  dataStore.getRecordById('REC-002').current_status === STATUS.NEED_QC_REVIEW,
  '', `status=${dataStore.getRecordById('REC-002').current_status}`);
assert('REC-002 manual_changes有engineer_notes改动',
  dataStore.getRecordById('REC-002').manual_changes.some(c => c.field === 'engineer_notes'),
  '', '');

// 3. QC → Finalize
console.log('\n[3/6] 质检员复核 → 终态:');
workflowEngine.qcApprove('REC-002', '质检员', '通过');
const afterQC = dataStore.getRecordById('REC-002');
assert('REC-002 QC通过后 qc_review_required=false',
  afterQC.qc_review_required === false, '', `值=${afterQC.qc_review_required}`);

['REC-001','REC-002','REC-003'].forEach(id =>
  workflowEngine.finalizeConclusion(id, '何工', `结论-${id}`)
);
const rec002OldBeforeRework = dataStore.getRecordById('REC-002');
const OLD_CONCLUSION = rec002OldBeforeRework.conclusion;
assert('REC-002 FINALIZED', rec002OldBeforeRework.current_status === STATUS.STATUS_FINALIZED, '', '');

// 4. Rework (核心)
console.log('\n[4/6] 返工（关键：旧记录SUPERSEDED + superseded_by + 旧结论保留）:');
const reworkRes = workflowEngine.createRework('REC-002', '何工', '返工理由', ['e1.jpg', 'e2.jpg']);
const OLD_ID = reworkRes.old_record_id;
const NEW_ID = reworkRes.new_record_id;
const OLD_REC = dataStore.getRecordById(OLD_ID);
const NEW_REC = dataStore.getRecordById(NEW_ID);

assert('旧记录状态 SUPERSEDED', OLD_REC.current_status === STATUS.SUPERSEDED,
  '', `status=${OLD_REC.current_status}`);
assert(`旧记录 superseded_by=${NEW_ID}`, OLD_REC.superseded_by === NEW_ID,
  `值=${OLD_REC.superseded_by}`, `值=${OLD_REC.superseded_by}`);
assert('旧结论内容不被覆盖', OLD_REC.conclusion === OLD_CONCLUSION,
  '', `原="${OLD_CONCLUSION}" 现="${OLD_REC.conclusion}"`);
assert('旧记录 status_history 存 SUPERSEDED + 旧结论快照',
  OLD_REC.status_history[OLD_REC.status_history.length-1].status === STATUS.SUPERSEDED
  && !!OLD_REC.status_history[OLD_REC.status_history.length-1].old_conclusion,
  '', '');
assert('新记录 previous_versions 包含旧结论关联 superseded_from',
  NEW_REC.previous_versions.some(p => p.superseded_from === OLD_ID),
  '', `历史=${JSON.stringify(NEW_REC.previous_versions)}`);
assert('新记录 manual_changes 存 rework_from',
  NEW_REC.manual_changes.some(c => c.field === 'rework_from'),
  '', `字段=${NEW_REC.manual_changes.map(c=>c.field).join(',')}`);
assert('统计 superseded_records=1', dataStore.getStatistics().superseded_records === 1,
  `值=${dataStore.getStatistics().superseded_records}`, '');
assert('统计 records_in_rework_chain≥2', dataStore.getStatistics().records_in_rework_chain >= 2,
  `值=${dataStore.getStatistics().records_in_rework_chain}`, '');

// 新记录走完流程
// 返工创建的新记录默认是 ENGINEER_REVIEWED；如含边界问题或要重新提交QC，按实际业务流转
workflowEngine.submitForQcReview(NEW_ID, '何工', '返工记录需QC复核新结论');
// 如 submitForQcReview 没触发（新记录无边界问题会直接 ENGINEER_REVIEWED 提交到 NEED_QC_REVIEW），确保处于 NEED_QC_REVIEW
const newBeforeQC = dataStore.getRecordById(NEW_ID);
if (newBeforeQC.current_status !== STATUS.NEED_QC_REVIEW && newBeforeQC.current_status === STATUS.STATUS_ENGINEER_REVIEWED) {
  // 直接走QC_APPROVED前先确保 NEED_QC_REVIEW 可流转（正常逻辑会自动通过 submitForQcReview 转到 NEED_QC_REVIEW）
}
workflowEngine.qcApprove(NEW_ID, '质检员', '通过返工');
workflowEngine.finalizeConclusion(NEW_ID, '何工', '修正结论');

// 5. 三方一致性
console.log('\n[5/6] 三方一致性核对（页面/API/导出 同一份字段）:');
const c1 = dataStore.verifyConsistency();
assert('verifyConsistency() 通过', c1.passed, c1.summary, c1.issues.join('; '));

const apiView = dataStore.getUnifiedView();
const expView = JSON.parse(dataStore.getExportData('json'));
assert('API长度 == JSON导出长度', apiView.length === expView.length,
  `=${apiView.length}`, `API=${apiView.length} vs EXPORT=${expView.length}`);

// 重点: 采样缺半小时的旧记录在导出中必须可追溯
const oldInApi = apiView.find(x => x.id === OLD_ID);
const oldInExp = expView.find(x => x.id === OLD_ID);
assert(`旧记录 ${OLD_ID} 在API视图中仍然存在`, !!oldInApi, '', '缺失！');
assert(`旧记录 ${OLD_ID} 在JSON导出中仍然存在`, !!oldInExp, '', '缺失！');
if (oldInApi && oldInExp) {
  assert(`旧记录 API: status=SUPERSEDED`, oldInApi.current_status === STATUS.SUPERSEDED, '', oldInApi.current_status);
  assert(`旧记录 EXPORT: status=SUPERSEDED`, oldInExp.current_status === STATUS.SUPERSEDED, '', oldInExp.current_status);
  assert(`旧记录 API.superseded_by = EXPORT.superseded_by = ${NEW_ID}`,
    oldInApi.superseded_by === NEW_ID && oldInExp.superseded_by === NEW_ID,
    `API=${oldInApi.superseded_by}  EXPORT=${oldInExp.superseded_by}`, '');
  assert(`旧记录 API边界问题数 = EXPORT边界问题数（采样缺半小时证据）`,
    (oldInApi.boundary_issues ? oldInApi.boundary_issues.length : 0) ===
    (oldInExp.boundary_issues ? oldInExp.boundary_issues.length : 0),
    `双方=${oldInApi.boundary_issues && oldInApi.boundary_issues.length}`,
    `API=${oldInApi.boundary_issues && oldInApi.boundary_issues.length} EXPORT=${oldInExp.boundary_issues && oldInExp.boundary_issues.length}`);
}

const csvTxt = dataStore.getExportData('csv');
assert('CSV导出含旧记录ID', csvTxt.includes(OLD_ID), '', '缺失');
assert('CSV导出含新记录ID', csvTxt.includes(NEW_ID), '', '缺失');
assert('CSV导出含 SUPERSEDED', csvTxt.includes('SUPERSEDED'), '', '缺失');
assert('CSV导出含需QC复核字段（可筛选采样缺半小时）', csvTxt.includes('需QC复核'), '', '缺失');

// needs-qc-review filter 导出（重点！）
const exportOnlyQC = dataStore.getExportData('json', { needsQcReview: true });
const expQC = JSON.parse(exportOnlyQC);
assert('筛选 needsQcReview=true 的导出应只含当前处于需QC的记录',
  Array.isArray(expQC) && expQC.every(r => r.qc_review_required === true),
  `实际数=${expQC.length}`, `有不属于needsQcReview的记录混入`);

// 6. Rollback (核心：派生字段同步)
console.log('\n[6/6] 回滚（核心：qc_review_required / boundary_issues 派生同步）:');

// 先把旧记录从 SUPERSEDED 滚回 NEED_QC_REVIEW (质检撤销)
// SUPERSEDED 的 status_history 最后是 SUPERSEDED，前一个是 STATUS_FINALIZED，再前一个 QC_APPROVED，再前一个 NEED_QC_REVIEW → 索引 1
const oldRecHist = dataStore.getRecordById(OLD_ID).status_history;
console.log(`    ${OLD_ID} status_history = ${oldRecHist.map((h,i)=>`${i}:${h.status}`).join(' → ')}`);
const needQcIdx = oldRecHist.findIndex(h => h.status === STATUS.NEED_QC_REVIEW);

const rbResult = workflowEngine.rollbackToVersion(OLD_ID, needQcIdx, '质检员-撤销');
assert(`回滚 ${OLD_ID} 到 NEED_QC_REVIEW → status=NEED_QC_REVIEW`,
  rbResult.current_status === STATUS.NEED_QC_REVIEW,
  `status=${rbResult.current_status}`,
  `status=${rbResult.current_status}`);
assert(`回滚 ${OLD_ID} 后 qc_review_required=true（派生字段同步）`,
  rbResult.qc_review_required === true,
  `值=${rbResult.qc_review_required}`,
  `值=${rbResult.qc_review_required}（只改了status没同步派生字段！页面成功接口读不到）`);
assert(`回滚 ${OLD_ID} 后 boundary_issues 仍保留（采样缺半小时证据）`,
  Array.isArray(rbResult.boundary_issues) && rbResult.boundary_issues.length >= 1,
  `边界问题数=${rbResult.boundary_issues.length}`,
  `边界问题丢失！`);

// 回滚之后三方仍一致
const c2 = dataStore.verifyConsistency();
assert('回滚后三方一致性仍通过', c2.passed, c2.summary, c2.issues.join('; '));

const apiAfterRb = dataStore.getUnifiedView().find(x => x.id === OLD_ID);
const expAfterRb = JSON.parse(dataStore.getExportData('json')).find(x => x.id === OLD_ID);
assert('回滚后 API vs EXPORT: current_status 一致',
  apiAfterRb.current_status === expAfterRb.current_status,
  `双方=${apiAfterRb.current_status}`,
  `API=${apiAfterRb.current_status} vs EXPORT=${expAfterRb.current_status}`);
assert('回滚后 API vs EXPORT: qc_review_required 一致',
  JSON.stringify(apiAfterRb.qc_review_required) === JSON.stringify(expAfterRb.qc_review_required),
  `双方=${apiAfterRb.qc_review_required}`,
  `API=${apiAfterRb.qc_review_required} vs EXPORT=${expAfterRb.qc_review_required}`);
assert('回滚后 API vs EXPORT: boundary_issues 长度一致',
  (apiAfterRb.boundary_issues ? apiAfterRb.boundary_issues.length : 0) ===
  (expAfterRb.boundary_issues ? expAfterRb.boundary_issues.length : 0),
  `双方=${apiAfterRb.boundary_issues && apiAfterRb.boundary_issues.length}`,
  '不一致');

console.log('\n===========================================================');
console.log(`✅ 通过: ${passed}   ❌ 失败: ${failed}   总计: ${passed + failed}`);
console.log('===========================================================');

if (failed > 0) {
  console.log('\n失败项:');
  issues.forEach(i => console.log(`  - ${i}`));
  process.exit(1);
} else {
  console.log('\n🎉 端到端核对全部通过。尤其是:');
  console.log('   - 返工旧结论SUPERSEDED + superseded_by写入 + 旧结论内容保留');
  console.log('   - 回滚 qc_review_required=true (派生同步，不会页面成功接口false)');
  console.log('   - 导出/API/页面都能追溯 REC-002 采样缺半小时那条记录');
  console.log('   - 返工链中旧记录边界问题（采样间隔/时长）永不丢失');
  process.exit(0);
}
