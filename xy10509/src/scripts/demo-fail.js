const { initDatabase } = require('../database/db');
const { getSeedData, seed } = require('./seed');
const transferService = require('../services/transferService');
const exceptionService = require('../services/exceptionService');
const historyService = require('../services/historyService');
const reportService = require('../services/reportService');
const { SEVERITY_LEVELS, REQUEST_STATUS } = require('../utils/constants');
const config = require('../config/config');

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${title}`);
  console.log('='.repeat(60) + '\n');
}

function logError(step, error) {
  console.log(`❌ ${step}:`);
  console.log(`   错误信息: ${error.message}`);
  console.log('');
}

function logException(e) {
  console.log(`   异常类型: ${e.exception_type}`);
  console.log(`   异常消息: ${e.message}`);
  console.log(`   创建时间: ${e.created_at}`);
  console.log('');
}

async function runFailDemo() {
  await initDatabase();
  
  const { hospitals, departments } = getSeedData();
  const today = new Date().toISOString().split('T')[0];

  console.log('========================================');
  console.log('   医院转诊床位协调 API - 失败路径');
  console.log('========================================\n');

  logSection('【失败场景1】向已暂停的科室申请');
  
  try {
    console.log('尝试向急诊科（已暂停）提交申请...');
    transferService.createTransferRequest({
      idempotencyKey: 'fail-dept-inactive-' + Date.now(),
      patientId: 'pat-001',
      toHospitalId: hospitals.HOSPITAL_A,
      toDepartmentId: departments.DEPT_EMERG,
      severityLevel: SEVERITY_LEVELS.URGENT,
      diagnosis: '腹痛'
    });
    console.log('⚠  未触发错误（预期失败）');
  } catch (e) {
    logError('向暂停科室申请', e);
  }

  console.log('查看异常记录:');
  let exceptions = exceptionService.getExceptions({ 
    entityType: 'transfer_request', 
    resolved: false 
  });
  exceptions.forEach(logException);

  logSection('【失败场景2】同一患者重复申请');
  
  console.log('步骤1: 先创建一个有效的申请');
  const activeReq = transferService.createTransferRequest({
    idempotencyKey: 'active-1-' + Date.now(),
    patientId: 'pat-001',
    toHospitalId: hospitals.HOSPITAL_A,
    toDepartmentId: departments.DEPT_CARDIO,
    severityLevel: SEVERITY_LEVELS.NORMAL,
    diagnosis: '体检'
  });
  transferService.scheduleRequest(activeReq.request.id, today);
  console.log('✓ 申请已创建并预约\n');

  console.log('步骤2: 同一患者再次申请...');
  const duplicateResult = transferService.createTransferRequest({
    idempotencyKey: 'duplicate-1-' + Date.now(),
    patientId: 'pat-001',
    toHospitalId: hospitals.HOSPITAL_A,
    toDepartmentId: departments.DEPT_NEURO,
    severityLevel: SEVERITY_LEVELS.NORMAL,
    diagnosis: '头痛'
  });
  
  console.log(`❌ 重复申请拦截:`);
  console.log(`   结果: ${duplicateResult.message}`);
  console.log(`   已存在申请ID: ${duplicateResult.existingRequest?.id}`);
  console.log(`   已存在状态: ${duplicateResult.existingRequest?.current_status}`);
  console.log('');

  exceptions = exceptionService.getExceptions({ 
    entityType: 'transfer_request', 
    resolved: false 
  });
  const dupException = exceptions.find(e => e.exception_type === 'duplicate_request');
  if (dupException) {
    console.log('异常记录:');
    logException(dupException);
  }

  logSection('【失败场景3】无效的病情等级');
  
  try {
    console.log('尝试使用无效的病情等级...');
    transferService.createTransferRequest({
      idempotencyKey: 'invalid-sev-' + Date.now(),
      patientId: 'pat-002',
      toHospitalId: hospitals.HOSPITAL_A,
      toDepartmentId: departments.DEPT_CARDIO,
      severityLevel: 'EXTREME_CRITICAL',
      diagnosis: '测试'
    });
  } catch (e) {
    logError('无效病情等级', e);
  }

  logSection('【失败场景4】状态流转错误');
  
  console.log('步骤1: 创建一个已取消的申请');
  const cancelledReq = transferService.createTransferRequest({
    idempotencyKey: 'cancelled-' + Date.now(),
    patientId: 'pat-003',
    toHospitalId: hospitals.HOSPITAL_A,
    toDepartmentId: departments.DEPT_CARDIO,
    severityLevel: SEVERITY_LEVELS.NORMAL,
    diagnosis: '测试'
  });
  transferService.scheduleRequest(cancelledReq.request.id, today);
  transferService.cancelRequest(cancelledReq.request.id, '测试取消');
  console.log('✓ 申请已取消\n');

  try {
    console.log('步骤2: 尝试确认已取消的申请...');
    transferService.confirmRequest(cancelledReq.request.id);
  } catch (e) {
    logError('确认已取消申请', e);
  }

  logSection('【失败场景5】超时未确认（模拟）');
  
  console.log('创建预约但不确认的申请...');
  const timeoutReq = transferService.createTransferRequest({
    idempotencyKey: 'timeout-test-' + Date.now(),
    patientId: 'pat-004',
    toHospitalId: hospitals.HOSPITAL_A,
    toDepartmentId: departments.DEPT_NEURO,
    severityLevel: SEVERITY_LEVELS.NORMAL,
    diagnosis: '头痛'
  });
  const timeoutSchedule = transferService.scheduleRequest(timeoutReq.request.id, today);
  console.log('✓ 申请已预约（状态: scheduled）\n');

  console.log(`超时时间设置: ${config.business.confirmTimeoutMinutes} 分钟`);
  console.log('模拟时间流逝（直接查看数据库中未确认的预约）:\n');

  const { db } = require('../database/db');
  const pendingConfirms = db.prepare(`
    SELECT id, current_status, requested_at
    FROM transfer_requests 
    WHERE current_status = 'scheduled'
  `).all();
  
  console.log('当前 pending 确认的申请:');
  pendingConfirms.forEach(r => {
    console.log(`   ID: ${r.id}`);
    console.log(`   状态: ${r.current_status}`);
    console.log(`   创建时间: ${r.requested_at}`);
    console.log('');
  });

  logSection('【失败场景6】目标科室不存在');
  
  try {
    console.log('尝试向不存在的科室提交申请...');
    transferService.createTransferRequest({
      idempotencyKey: 'no-dept-' + Date.now(),
      patientId: 'pat-005',
      toHospitalId: hospitals.HOSPITAL_A,
      toDepartmentId: 'dept-nonexistent-123',
      severityLevel: SEVERITY_LEVELS.NORMAL,
      diagnosis: '测试'
    });
  } catch (e) {
    logError('科室不存在', e);
  }

  logSection('【失败场景汇总与验证】');
  
  const report = reportService.getDashboardSummary();
  console.log('📊 当前系统状态:');
  console.log(`   总申请数: ${report.summary.totalRequests}`);
  console.log(`   进行中: ${report.summary.pendingRequests}`);
  console.log(`   已完成: ${report.summary.completedRequests}`);
  console.log(`   已取消: ${report.summary.cancelledRequests}`);
  console.log(`   未解决异常: ${report.exceptions.unresolved}`);
  
  console.log('\n🔍 异常记录详情:');
  const allExceptions = exceptionService.getExceptions({ resolved: false });
  if (allExceptions.length === 0) {
    console.log('   (无未解决异常)');
  } else {
    allExceptions.forEach((e, i) => {
      console.log(`\n   异常 #${i + 1}:`);
      console.log(`      类型: ${e.exception_type}`);
      console.log(`      消息: ${e.message}`);
      console.log(`      时间: ${e.created_at}`);
    });
  }

  console.log('\n📝 状态历史（失败相关操作）:');
  const history = historyService.getAllHistory();
  const failureReasons = ['取消', '异常', '科室', '暂停', '超时'];
  history
    .filter(h => failureReasons.some(r => (h.reason || '').includes(r)))
    .slice(0, 10)
    .forEach(h => {
      console.log(`   [${h.created_at}] ${h.entity_type}: ` +
        `${h.old_status || '初始'} → ${h.new_status}` +
        (h.reason ? ` (${h.reason})` : ''));
    });

  console.log('\n========================================');
  console.log('   ✅ 失败路径演示完成');
  console.log('========================================');
  console.log('');
  console.log('💡 要点说明:');
  console.log('   • 所有失败都有异常记录');
  console.log('   • 状态转换严格受限');
  console.log('   • 重复/无效请求被拦截');
  console.log('   • 人工操作需留痕');
  console.log('');
}

if (require.main === module) {
  const fs = require('fs');
  
  if (!fs.existsSync('./data')) {
    fs.mkdirSync('./data', { recursive: true });
  }
  
  console.log('为失败路径初始化新数据库...\n');
  try {
    fs.unlinkSync('./data/hospital.db');
  } catch (e) {}
  
  (async () => {
    await initDatabase();
    seed();
    await runFailDemo();
  })();
}

module.exports = { runFailDemo };
