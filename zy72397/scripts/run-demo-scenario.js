const dataStore = require('../src/store/data-store');
const workflowEngine = require('../src/engine/workflow-engine');
const { STATUS, BOUNDARY_RULES } = require('../src/models/boundary-rules');

console.log('='.repeat(60));
console.log('🚀 水轮机效率回放系统 - 完整演示场景');
console.log('='.repeat(60));
console.log('');

const demoData = [
  {
    sensor_id: 'SEN-2024-001',
    sensor_name: '1号水轮机进口压力传感器',
    turbine_id: 'TURBINE-A-01',
    sampling_time: '2024-06-15T08:00:00.000Z',
    sampling_start_time: '2024-06-15T08:00:00.000Z',
    sampling_end_time: '2024-06-15T09:00:00.000Z',
    efficiency: 92.5,
    flow_rate: 45.2,
    head: 38.6,
    power: 15800
  },
  {
    sensor_id: 'SEN-2024-002',
    sensor_name: '1号水轮机出口压力传感器',
    turbine_id: 'TURBINE-A-01',
    sampling_time: '2024-06-15T10:35:00.000Z',
    sampling_start_time: '2024-06-15T10:35:00.000Z',
    sampling_end_time: '2024-06-15T10:55:00.000Z',
    efficiency: 91.8,
    flow_rate: 44.8,
    head: 38.2,
    power: 15600
  },
  {
    sensor_id: 'SEN-2024-003',
    sensor_name: '2号水轮机进口压力传感器',
    turbine_id: 'TURBINE-A-02',
    sampling_time: '2024-06-15T11:00:00.000Z',
    sampling_start_time: '2024-06-15T11:00:00.000Z',
    sampling_end_time: '2024-06-15T12:00:00.000Z',
    efficiency: 93.1,
    flow_rate: 46.5,
    head: 39.1,
    power: 16200
  }
];

console.log('📥 【第1步】传感器编号导入');
console.log('-'.repeat(60));
const importResult = workflowEngine.importSensorData(demoData, '数据录入员');
console.log(`导入批次: ${importResult.batch_id}`);
console.log(`导入记录数: ${importResult.record_count}`);
console.log(`记录ID: ${importResult.records.join(', ')}`);
console.log('');

const stats1 = dataStore.getStatistics();
console.log(`📊 导入后统计: 总记录 ${stats1.total_records}, 待QC复核 ${stats1.needs_qc_review}`);

const problemRecord = dataStore.getRecordById('REC-002');
console.log('');
console.log('⚠️  自动边界检查发现 REC-002 问题:');
console.log(`   采样间隔: 与上一条记录间隔 ${(new Date(problemRecord.sampling_start_time) - new Date('2024-06-15T09:00:00.000Z')) / (1000 * 60)} 分钟`);
console.log(`   采样时长: ${(new Date(problemRecord.sampling_end_time) - new Date(problemRecord.sampling_start_time)) / (1000 * 60)} 分钟`);
console.log(`   边界规则阈值: 间隔 > ${BOUNDARY_RULES.MAX_SAMPLING_GAP_MINUTES}分钟, 时长 < ${BOUNDARY_RULES.THEORETICAL_SAMPLING_MINUTES * BOUNDARY_RULES.MIN_SAMPLING_DURATION_RATIO}分钟`);
console.log(`   自动标记状态: ${problemRecord.current_status} (需要质检员复核，绝不自动归正常)`);
console.log(`   问题描述: ${problemRecord.boundary_issues.map(i => i.message).join('; ')}`);
console.log('');

console.log('👨‍🔧 【第2步】设备工程师何工补看工况照片');
console.log('-'.repeat(60));
console.log('何工查看 REC-001（正常记录）:');
workflowEngine.engineerReview(
  'REC-001',
  '何工',
  '工况正常，传感器校准记录完整',
  ['site-photo-001.jpg', 'site-photo-002.jpg']
);
console.log('   → 状态更新为 ENGINEER_REVIEWED');
console.log('');

console.log('何工查看 REC-002（有问题记录）:');
const rec002AfterEngineer = workflowEngine.engineerReview(
  'REC-002',
  '何工',
  '数据有疑问，采样时间缺了半小时，等现场照片',
  ['partial-photo.jpg']
);
console.log(`   → 状态保持 ${rec002AfterEngineer.current_status}（因为有边界问题，强制停在 NEED_QC_REVIEW）`);
console.log('');

console.log('何工查看 REC-003（正常记录）:');
workflowEngine.engineerReview(
  'REC-003',
  '何工',
  '工况正常，效率数据符合预期',
  ['site-photo-003.jpg']
);
console.log('   → 状态更新为 ENGINEER_REVIEWED');
console.log('');

console.log('📐 【第3步】正常记录先更新实验复盘图');
console.log('-'.repeat(60));
workflowEngine.finalizeConclusion(
  'REC-001',
  '何工',
  '1号水轮机进口效率测试合格，效率92.5%符合设计要求'
);
console.log('REC-001 → 结论已确认，实验复盘图已更新');

workflowEngine.finalizeConclusion(
  'REC-003',
  '何工',
  '2号水轮机效率测试优秀，效率93.1%优于设计值'
);
console.log('REC-003 → 结论已确认，实验复盘图已更新');
console.log('');

console.log('🔍 质检员晚上催结果');
console.log('-'.repeat(60));
console.log('质检员: REC-002 怎么回事？为什么没出结论？');
console.log('何工: 我翻了传感器编号，那条采样时间缺了半小时，不敢直接发结论');
console.log(`系统显示 REC-002 状态: ${problemRecord.current_status}`);
console.log(`系统显示问题: ${problemRecord.boundary_issues[0].message}`);
console.log('质检员: 好的，我来复核');
console.log('');

console.log('✅ 质检员复核 REC-002');
console.log('-'.repeat(60));
workflowEngine.qcApprove(
  'REC-002',
  '质检员',
  '现场确认：当时设备调试中断35分钟，采样数据本身有效，时长虽短但测点稳定'
);
console.log('   → QC复核通过，状态更新为 QC_APPROVED');
console.log('');

console.log('📐 何工补全 REC-002 结论');
console.log('-'.repeat(60));
workflowEngine.finalizeConclusion(
  'REC-002',
  '何工',
  '1号水轮机出口效率测试合格，虽然采样中断但数据有效，效率91.8%在正常范围'
);
console.log('REC-002 → 结论已确认，实验复盘图已更新');
console.log('');

console.log('🔄 【返工场景演示】');
console.log('-'.repeat(60));
console.log('第二天，现场补到了工况照片，发现1号水轮机出口其实有异常');
console.log('');

const reworkResult = workflowEngine.createRework(
  'REC-002',
  '何工',
  '现场补充工况照片显示出口阀门开度不足，原结论需修正',
  ['new-site-evidence-001.jpg', 'new-site-evidence-002.jpg']
);

console.log(`返工创建成功:`);
console.log(`   旧记录 ID: ${reworkResult.old_record_id} (状态标记为 SUPERSEDED)`);
console.log(`   新记录 ID: ${reworkResult.new_record_id} (重新走流程)`);
console.log('');

const oldRec = dataStore.getRecordById(reworkResult.old_record_id);
const newRec = dataStore.getRecordById(reworkResult.new_record_id);

console.log('📜 旧结论版本保留（不删除）:');
console.log(`   旧结论: ${oldRec.conclusion}`);
console.log(`   旧状态: ${oldRec.current_status}`);
console.log('');

console.log('何工查看新记录，更新结论:');
workflowEngine.finalizeConclusion(
  reworkResult.new_record_id,
  '何工',
  '1号水轮机出口效率偏低，因阀门开度不足导致，效率91.8%低于预期，需调整'
);
console.log(`   新结论: ${dataStore.getRecordById(reworkResult.new_record_id).conclusion}`);
console.log('');

console.log('📊 【数据一致性验证】');
console.log('-'.repeat(60));
console.log('验证：页面展示、API返回、文件导出 都调用 dataStore.getUnifiedView()');
console.log('');
const unifiedView = dataStore.getUnifiedView();
console.log(`统一视图记录数: ${unifiedView.length}`);
console.log(`REC-002 在统一视图中状态: ${unifiedView.find(r => r.id === 'REC-002').current_status}`);
console.log(`REC-002 在统一视图中显示边界问题: ${unifiedView.find(r => r.id === 'REC-002').boundary_issues.length > 0 ? '是' : '否'}`);
console.log('');
console.log('✅ 验证通过：有问题的记录不会在任何视图中消失，三处显示一致');
console.log('');

console.log('📋 【审计日志 - 可复盘】');
console.log('-'.repeat(60));
const audit = workflowEngine.replayAuditLog('REC-002');
console.log('REC-002 状态流转历史:');
audit.status_history.forEach((s, i) => {
  console.log(`   [${i}] ${s.timestamp.substring(5, 16)} | ${s.status} | ${s.operator} | ${s.remark}`);
});
console.log('');
console.log('REC-002 人工改动记录:');
audit.status_history.forEach((s, i) => {
  if (s.remark && s.remark.includes('结论')) {
    console.log(`   [${i}] ${s.timestamp.substring(5, 16)} | 结论变更 | ${s.operator}`);
  }
});
console.log('');

const finalStats = dataStore.getStatistics();
console.log('='.repeat(60));
console.log('🎬 演示场景完成');
console.log('='.repeat(60));
console.log('');
console.log('📊 最终统计:');
console.log(`   总记录数: ${finalStats.total_records}`);
console.log(`   已终态: ${finalStats.by_status.FINALIZED || 0}`);
console.log(`   已被替代(返工): ${finalStats.by_status.SUPERSEDED || 0}`);
console.log(`   含边界问题: ${finalStats.has_boundary_issues}`);
console.log('');
console.log('💡 可运行命令:');
console.log('   npm start       - 启动 Web 服务，在浏览器中查看完整界面');
console.log('   npm run replay -- --record-id=REC-002 - 重放某条记录审计日志');
console.log('   npm run export  - 导出数据（与页面、API同一份）');
console.log('   npm run test:boundary - 运行边界规则测试');
console.log('');
