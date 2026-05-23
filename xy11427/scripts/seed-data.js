const { receiveAppointment, receiveGateRecord, receiveScreenshot } = require('../src/services/dataReceiver');

console.log('开始导入样例数据...\n');

const today = new Date().toISOString().split('T')[0];
const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

const sampleAppointments = [
  {
    appointment_no: 'APT20240520001',
    visitor_name: '张三',
    visitor_phone: '13800138001',
    id_card: '310101199001010001',
    license_plate: '沪A12345',
    visit_date: today,
    visit_time_start: '09:00:00',
    visit_time_end: '17:00:00',
    visit_reason: '商务洽谈',
    visitor_company: 'ABC科技有限公司',
    host_department: '市场部',
    host_name: '李四',
    source: 'manual'
  },
  {
    appointment_no: 'APT20240520002',
    visitor_name: '王五',
    visitor_phone: '13800138002',
    id_card: '310101199002020002',
    license_plate: '沪B67890',
    visit_date: today,
    visit_time_start: '10:00:00',
    visit_time_end: '15:00:00',
    visit_reason: '设备维修',
    visitor_company: 'XYZ维修服务',
    host_department: '运维部',
    host_name: '赵六',
    source: 'api'
  },
  {
    appointment_no: 'APT20240519001',
    visitor_name: '陈七',
    visitor_phone: '13800138003',
    license_plate: '沪C11111',
    visit_date: yesterday,
    visit_time_start: '14:00:00',
    visit_time_end: '18:00:00',
    visit_reason: '面试',
    host_department: '人力资源部',
    host_name: '周八',
    source: 'web'
  }
];

const sampleGateRecords = [
  {
    record_no: 'GATE20240520001',
    gate_no: 'G01',
    gate_name: '东门',
    visitor_name: '张三',
    license_plate: '沪A12345',
    pass_time: `${today} 09:15:00`,
    pass_direction: 'in',
    pass_type: 'vehicle',
    temperature: 36.5,
    health_code_status: 'green',
    appointment_no: 'APT20240520001'
  },
  {
    record_no: 'GATE20240520002',
    gate_no: 'G02',
    gate_name: '南门',
    visitor_name: '王五',
    license_plate: '沪B67890',
    pass_time: `${today} 10:20:00`,
    pass_direction: 'in',
    pass_type: 'walkin',
    temperature: 36.8,
    health_code_status: 'green',
    appointment_no: 'APT20240520002'
  }
];

const sampleScreenshots = [
  {
    screenshot_no: 'SCR20240520001',
    license_plate: '沪A12345',
    recognized_plate: '沪A12345',
    confidence: 0.98,
    capture_time: `${today} 09:15:02`,
    capture_gate: '东门',
    image_url: '/images/gate/g01_20240520_091502.jpg',
    ocr_result: '沪A12345',
    appointment_no: 'APT20240520001',
    gate_record_no: 'GATE20240520001'
  }
];

async function seedData() {
  console.log('📋 导入访客预约...');
  for (const apt of sampleAppointments) {
    try {
      const result = receiveAppointment(apt);
      console.log(`  ✅ ${apt.appointment_no} - ${apt.visitor_name} (fact_id: ${result.fact_id})`);
    } catch (e) {
      console.log(`  ⚠️  ${apt.appointment_no} - 已存在`);
    }
  }
  
  console.log('\n🚪 导入闸机记录...');
  for (const gate of sampleGateRecords) {
    try {
      const result = receiveGateRecord(gate);
      console.log(`  ✅ ${gate.record_no} - ${gate.visitor_name} (fact_id: ${result.fact_id})`);
    } catch (e) {
      console.log(`  ⚠️  ${gate.record_no} - 已存在`);
    }
  }
  
  console.log('\n📷 导入车牌截图...');
  for (const scr of sampleScreenshots) {
    try {
      const result = receiveScreenshot(scr);
      console.log(`  ✅ ${scr.screenshot_no} - ${scr.license_plate} (fact_id: ${result.fact_id})`);
    } catch (e) {
      console.log(`  ⚠️  ${scr.screenshot_no} - 已存在`);
    }
  }
  
  console.log('\n✅ 样例数据导入完成！');
}

seedData().catch(console.error);
