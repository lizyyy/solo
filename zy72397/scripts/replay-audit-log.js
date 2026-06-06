const dataStore = require('../src/store/data-store');
const workflowEngine = require('../src/engine/workflow-engine');
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

workflowEngine.importSensorData(demoData, 'demo-loader');

const args = process.argv.slice(2);
let recordId = 'REC-002';

args.forEach((arg, i) => {
  if (arg === '--record-id' && args[i + 1]) {
    recordId = args[i + 1];
  }
});

console.log('='.repeat(60));
console.log(`⏱️  审计日志重放 - 记录 ${recordId}`);
console.log('='.repeat(60));
console.log('');

try {
  const audit = workflowEngine.replayAuditLog(recordId);
  
  console.log('📋 状态流转历史:');
  console.log('-'.repeat(60));
  audit.status_history.forEach((s, i) => {
    console.log(`[${String(i).padStart(2, '0')}] ${s.timestamp}`);
    console.log(`      状态: ${s.status}`);
    console.log(`      操作人: ${s.operator}`);
    console.log(`      备注: ${s.remark || '-'}`);
    if (s.rejectReason) console.log(`      驳回原因: ${s.rejectReason}`);
    if (s.boundary_issues) console.log(`      触发边界问题: ${s.boundary_issues.length}项`);
    console.log('');
  });
  
  const record = dataStore.getRecordById(recordId);
  if (record && record.manual_changes.length > 0) {
    console.log('✏️  人工改动记录:');
    console.log('-'.repeat(60));
    record.manual_changes.forEach((c, i) => {
      console.log(`[${String(i).padStart(2, '0')}] ${c.timestamp}`);
      console.log(`      字段: ${c.field}`);
      console.log(`      旧值: ${c.old_value || '(空)'}`);
      console.log(`      新值: ${c.new_value}`);
      console.log(`      操作人: ${c.operator}`);
      console.log(`      原因: ${c.reason || '-'}`);
      console.log('');
    });
  }
  
  if (record && record.previous_versions.length > 0) {
    console.log('📜 历史结论版本:');
    console.log('-'.repeat(60));
    record.previous_versions.forEach((v, i) => {
      console.log(`版本 ${v.conclusion_version}:`);
      console.log(`      结论: ${v.conclusion}`);
      console.log(`      时间: ${v.timestamp}`);
      console.log('');
    });
  }
  
  console.log('='.repeat(60));
  console.log('💡 可执行回滚命令:');
  console.log(`   node scripts/rollback.js --record-id=${recordId} --version=0`);
  console.log('');
  
} catch (e) {
  console.log(`❌ 错误: ${e.message}`);
  console.log('');
  console.log('可用记录ID:');
  dataStore.getUnifiedView().forEach(r => {
    console.log(`   ${r.id} - ${r.sensor_id} - ${r.current_status}`);
  });
}
