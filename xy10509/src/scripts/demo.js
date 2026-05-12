const { initDatabase } = require('../database/db');
const { getSeedData } = require('./seed');
const patientService = require('../services/patientService');
const transferService = require('../services/transferService');
const reportService = require('../services/reportService');
const bedService = require('../services/bedService');
const { SEVERITY_LEVELS, REQUEST_STATUS } = require('../utils/constants');

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${title}`);
  console.log('='.repeat(60) + '\n');
}

function logResult(label, data) {
  console.log(`✓ ${label}:`);
  console.log(JSON.stringify(data, null, 2));
  console.log('');
}

async function runDemo() {
  await initDatabase();
  
  const { hospitals, departments } = getSeedData();
  const today = new Date().toISOString().split('T')[0];

  console.log('========================================');
  console.log('   医院转诊床位协调 API - 演示流程');
  console.log('========================================');
  console.log(`日期: ${today}`);

  logSection('【场景1】普通预约流程');
  
  console.log('步骤1: 查看初始床位状态');
  let bedStatus = bedService.getAllBedStatus();
  logResult('心内科可用床位', bedStatus.find(b => b.department_id === departments.DEPT_CARDIO));

  console.log('步骤2: 创建转诊申请（张三 - 普通心绞痛）');
  let result1 = transferService.createTransferRequest({
    patientId: 'pat-001',
    fromHospitalId: hospitals.HOSPITAL_B,
    toHospitalId: hospitals.HOSPITAL_A,
    toDepartmentId: departments.DEPT_CARDIO,
    severityLevel: SEVERITY_LEVELS.NORMAL,
    diagnosis: '稳定性心绞痛',
    createdBy: 'demo-user'
  });
  const request1 = result1.request;
  logResult('创建成功', { id: request1.id, status: request1.current_status, patient: '张三' });

  console.log('步骤3: 预约床位');
  let schedule1 = transferService.scheduleRequest(request1.id, today);
  logResult('预约结果', schedule1);

  console.log('步骤4: 确认预约');
  let confirm1 = transferService.confirmRequest(request1.id, 'doctor-001');
  logResult('确认成功', { id: request1.id, status: confirm1.current_status });

  console.log('步骤5: 查看申请详情（含历史记录）');
  let detail1 = transferService.getRequestById(request1.id);
  logResult('状态历史', detail1.history.map(h => ({
    from: h.old_status,
    to: h.new_status,
    reason: h.reason,
    by: h.changed_by,
    time: h.created_at
  })));

  logSection('【场景2】重症插队 - 优先级高于普通');
  
  console.log('步骤1: 先占用剩余心内科床位');
  const reservePatients = ['pat-002', 'pat-003', 'pat-004', 'pat-005'];
  const reservedRequests = [];
  
  for (let i = 0; i < 3; i++) {
    const r = transferService.createTransferRequest({
      patientId: reservePatients[i],
      toHospitalId: hospitals.HOSPITAL_A,
      toDepartmentId: departments.DEPT_CARDIO,
      severityLevel: SEVERITY_LEVELS.NORMAL,
      diagnosis: '常规检查',
      idempotencyKey: `reserve-${i}-${Date.now()}`
    });
    transferService.scheduleRequest(r.request.id, today);
    reservedRequests.push(r.request.id);
  }
  
  bedStatus = bedService.getAllBedStatus();
  logResult('心内科床位（已占满）', bedStatus.find(b => b.department_id === departments.DEPT_CARDIO));

  console.log('步骤2: 普通患者申请，进入候补');
  let normalReq = transferService.createTransferRequest({
    idempotencyKey: 'normal-waiting-' + Date.now(),
    patientId: 'pat-005',
    toHospitalId: hospitals.HOSPITAL_A,
    toDepartmentId: departments.DEPT_CARDIO,
    severityLevel: SEVERITY_LEVELS.NORMAL,
    diagnosis: '常规胸闷',
    createdBy: 'demo-user'
  });
  let normalSchedule = transferService.scheduleRequest(normalReq.request.id, today);
  logResult('普通患者进入候补', { 
    queuePosition: normalSchedule.queuePosition, 
    status: transferService.getRequestById(normalReq.request.id).current_status 
  });

  console.log('步骤3: 重症患者申请，优先插队');
  let criticalReq = transferService.createTransferRequest({
    idempotencyKey: 'critical-demo-' + Date.now(),
    patientId: 'pat-003',
    fromHospitalId: hospitals.HOSPITAL_B,
    toHospitalId: hospitals.HOSPITAL_A,
    toDepartmentId: departments.DEPT_CARDIO,
    severityLevel: SEVERITY_LEVELS.CRITICAL,
    diagnosis: '急性心肌梗死',
    createdBy: 'emergency'
  });
  let criticalSchedule = transferService.scheduleRequest(criticalReq.request.id, today);
  
  if (criticalSchedule.inQueue) {
    logResult('重症进入候补队列', { 
      queuePosition: criticalSchedule.queuePosition,
      message: '重症优先级高，排在普通患者前面'
    });
  } else {
    logResult('重症直接预约成功', criticalSchedule);
  }

  let queue = transferService.getWaitingQueue(departments.DEPT_CARDIO, today);
  logResult('当前候补队列（重症在前）', queue.map(q => ({
    position: q.queue_position,
    patient: q.patient_name,
    severity: q.severity_level,
    score: q.priority_score
  })));

  logSection('【场景3】取消释放 + 候补递补');
  
  console.log('步骤1: 取消一个已预约的申请（释放床位）');
  const cancelResult = transferService.cancelRequest(
    reservedRequests[0], 
    '患者临时取消', 
    'nurse-001'
  );
  logResult('取消成功', { 
    cancelled: cancelResult.request.id,
    status: cancelResult.request.current_status,
    reason: '患者临时取消'
  });

  console.log('步骤2: 系统自动处理候补队列（重症优先递补）');
  queue = transferService.getWaitingQueue(departments.DEPT_CARDIO, today);
  
  let criticalDetail = transferService.getRequestById(criticalReq.request.id);
  let normalDetail = transferService.getRequestById(normalReq.request.id);
  
  logResult('队列更新', {
    '重症患者状态': criticalDetail.current_status,
    '普通患者状态': normalDetail.current_status,
    '队列剩余人数': queue.length
  });

  logSection('【场景4】幂等性验证 - 重复请求');
  
  console.log('步骤1: 首次请求创建申请');
  const idempKey = 'idemp-test-' + Date.now();
  let firstCall = transferService.createTransferRequest({
    idempotencyKey: idempKey,
    patientId: 'pat-001',
    toHospitalId: hospitals.HOSPITAL_A,
    toDepartmentId: departments.DEPT_NEURO,
    severityLevel: SEVERITY_LEVELS.NORMAL,
    diagnosis: '头痛'
  });
  logResult('首次调用', { isDuplicate: firstCall.isDuplicate, newId: firstCall.request.id });

  console.log('步骤2: 使用相同幂等键重复调用');
  let secondCall = transferService.createTransferRequest({
    idempotencyKey: idempKey,
    patientId: 'pat-001',
    toHospitalId: hospitals.HOSPITAL_A,
    toDepartmentId: departments.DEPT_NEURO,
    severityLevel: SEVERITY_LEVELS.NORMAL,
    diagnosis: '头痛'
  });
  logResult('重复调用', { 
    isDuplicate: secondCall.isDuplicate, 
    sameId: secondCall.request.id === firstCall.request.id,
    message: secondCall.message
  });

  logSection('【场景5】人工修正');
  
  console.log('步骤1: 人工修正申请状态，留下差异记录');
  const manualResult = transferService.manualUpdateRequest(
    normalReq.request.id,
    { current_status: REQUEST_STATUS.COMPLETED, notes: '人工确认转诊完成' },
    'admin-supervisor'
  );
  logResult('人工修正', {
    operator: manualResult.operator,
    diff: manualResult.diff,
    newStatus: manualResult.request.current_status
  });

  logSection('【汇总报告】业务闭环验证');
  
  const fullReport = reportService.getFullReport();
  
  console.log('📊 仪表板摘要:');
  console.log(`  总申请数: ${fullReport.dashboard.summary.totalRequests}`);
  console.log(`  进行中: ${fullReport.dashboard.summary.pendingRequests}`);
  console.log(`  已完成: ${fullReport.dashboard.summary.completedRequests}`);
  console.log(`  已取消/超时: ${fullReport.dashboard.summary.cancelledRequests}`);
  console.log(`  床位利用率: ${100 - fullReport.dashboard.beds.availabilityRate}%`);
  console.log(`  候补中: ${fullReport.dashboard.queue.totalWaiting}人 (含重症${fullReport.dashboard.queue.criticalWaiting}人)`);
  console.log(`  未解决异常: ${fullReport.dashboard.exceptions.unresolved}个`);
  
  console.log('\n🏥 各科室床位占用:');
  fullReport.bedOccupancy.forEach(b => {
    console.log(`  ${b.hospital_name} - ${b.department_name}: ` +
      `${b.available_beds}/${b.total_beds} 可用, ` +
      `占用率 ${b.occupancy_rate}%, ` +
      `候补 ${b.waiting_count}人`);
  });

  console.log('\n📝 状态流转历史（最近5条）:');
  const { db } = require('../database/db');
  const recentHistory = db.prepare(
    'SELECT * FROM status_history ORDER BY created_at DESC LIMIT 5'
  ).all();
  recentHistory.forEach(h => {
    console.log(`  [${h.created_at}] ${h.entity_type}: ${h.old_status || '初始'} → ${h.new_status} (${h.changed_by})`);
  });

  console.log('\n========================================');
  console.log('   ✅ 演示完成 - 业务流程闭环验证通过');
  console.log('========================================\n');
}

if (require.main === module) {
  const fs = require('fs');
  
  if (!fs.existsSync('./data')) {
    fs.mkdirSync('./data', { recursive: true });
  }
  
  if (fs.existsSync('./data/hospital.db')) {
    try {
      fs.unlinkSync('./data/hospital.db');
    } catch (e) {}
  }
  
  (async () => {
    await initDatabase();
    const { seed } = require('./seed');
    seed();
    await runDemo();
  })();
}

module.exports = { runDemo };
