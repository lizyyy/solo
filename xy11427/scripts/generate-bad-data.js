const { receiveAppointment, receiveGateRecord, receiveScreenshot } = require('../src/services/dataReceiver');
const { getDatabase } = require('../src/config/database');

console.log('生成各种类型的坏数据...\n');

const today = new Date().toISOString().split('T')[0];
const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

async function generateBadData() {
  console.log('❌ 1. 缺少必填字段的预约记录...');
  const badAppt1 = receiveAppointment({
    appointment_no: 'BAD_APT_MISSING_001',
    visitor_name: '缺字段访客',
    source: 'test'
  });
  console.log(`   结果: ${badAppt1.has_dirty_issues ? '检测到脏数据 ✓' : '未检测 ✗'}`);
  console.log(`   问题: ${badAppt1.dirty_issues.map(i => i.reason).join(', ')}`);
  
  console.log('\n❌ 2. 跨日期不一致的闸机记录...');
  const badGate1 = receiveGateRecord({
    record_no: 'BAD_GATE_CROSSDATE_001',
    visitor_name: '张三',
    license_plate: '沪A12345',
    pass_time: `${tomorrow} 09:15:00`,
    appointment_no: 'APT20240520001'
  });
  console.log(`   结果: ${badGate1.has_dirty_issues ? '检测到脏数据 ✓' : '未检测 ✗'}`);
  if (badGate1.dirty_issues.length > 0) {
    console.log(`   问题: ${badGate1.dirty_issues.map(i => i.reason).join(', ')}`);
  }
  
  console.log('\n❌ 3. 姓名不一致的闸机记录...');
  const badGate2 = receiveGateRecord({
    record_no: 'BAD_GATE_NAME_001',
    visitor_name: '张三四',
    license_plate: '沪A12345',
    pass_time: `${today} 10:00:00`,
    appointment_no: 'APT20240520001'
  });
  console.log(`   结果: ${badGate2.has_dirty_issues ? '检测到脏数据 ✓' : '未检测 ✗'}`);
  if (badGate2.dirty_issues.length > 0) {
    console.log(`   问题: ${badGate2.dirty_issues.map(i => i.reason).join(', ')}`);
  }
  
  console.log('\n❌ 4. 车牌识别不匹配的截图...');
  const badScreen1 = receiveScreenshot({
    screenshot_no: 'BAD_SCR_PLATE_001',
    license_plate: '沪A12345',
    recognized_plate: '沪A12346',
    confidence: 0.85,
    capture_time: `${today} 09:15:05`,
    capture_gate: '东门',
    appointment_no: 'APT20240520001',
    gate_record_no: 'GATE20240520001'
  });
  console.log(`   结果: ${badScreen1.has_dirty_issues ? '检测到脏数据 ✓' : '未检测 ✗'}`);
  if (badScreen1.dirty_issues.length > 0) {
    console.log(`   问题: ${badScreen1.dirty_issues.map(i => i.reason).join(', ')}`);
  }
  
  console.log('\n❌ 5. 字段冲突（车牌不一致）...');
  const badGate3 = receiveGateRecord({
    record_no: 'BAD_GATE_CONFLICT_001',
    visitor_name: '王五',
    license_plate: '沪B99999',
    pass_time: `${today} 10:30:00`,
    appointment_no: 'APT20240520002'
  });
  console.log(`   结果: ${badGate3.has_dirty_issues ? '检测到脏数据 ✓' : '未检测 ✗'}`);
  if (badGate3.dirty_issues.length > 0) {
    console.log(`   问题: ${badGate3.dirty_issues.map(i => i.reason).join(', ')}`);
  }
  
  console.log('\n📊 生成统计:');
  const db = getDatabase();
  const dirtyCount = db.prepare('SELECT COUNT(*) as count FROM dirty_records').get().count;
  const queueCount = db.prepare('SELECT COUNT(*) as count FROM compensation_queue').get().count;
  console.log(`   脏记录总数: ${dirtyCount}`);
  console.log(`   补偿队列数: ${queueCount}`);
  
  console.log('\n✅ 坏数据生成完成！可通过以下API查看:');
  console.log('   GET /api/dirty?status=pending');
  console.log('   GET /api/dirty/stats');
  console.log('   GET /api/queue/stats');
}

generateBadData().catch(console.error);
