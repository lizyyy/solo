const { getDatabase } = require('../src/config/database');
const { receiveAppointment, receiveGateRecord, receiveScreenshot } = require('../src/services/dataReceiver');
const { getFactById, handleDirtyRecord } = require('../src/services/factService');
const { processRetry, markCompleted, recoverFromDeadLetter } = require('../src/services/compensationQueue');
const { addManualNote } = require('../src/services/operationHistory');
const { generateSecuritySupervisorReport } = require('../src/services/exportService');

console.log('='.repeat(70));
console.log('           园区访客通行重试补偿队列 - 功能测试');
console.log('='.repeat(70) + '\n');

const today = new Date().toISOString().split('T')[0];
let testFactId = null;
let testDirtyId = null;
let testQueueId = null;

async function runTests() {
  let passed = 0;
  let failed = 0;
  
  console.log('🧪 测试 1: 幂等性测试 - 重复请求只更新同一条事实');
  try {
    const result1 = receiveAppointment({
      appointment_no: 'TEST_APT_001',
      visitor_name: '测试用户1',
      visit_date: today,
      source: 'test'
    });
    
    const result2 = receiveAppointment({
      appointment_no: 'TEST_APT_001',
      visitor_phone: '13900139000',
      source: 'test'
    });
    
    if (result1.fact_id === result2.fact_id && !result2.is_new) {
      console.log('   ✅ 幂等性测试通过 - 重复请求更新同一条事实');
      testFactId = result1.fact_id;
      passed++;
    } else {
      console.log('   ❌ 幂等性测试失败');
      failed++;
    }
  } catch (e) {
    console.log('   ❌ 幂等性测试失败:', e.message);
    failed++;
  }
  
  console.log('\n🧪 测试 2: 脏记录检测 - 缺字段自动分类');
  try {
    const result = receiveAppointment({
      appointment_no: 'TEST_APT_DIRTY_001',
      visitor_name: '缺字段测试',
      source: 'test'
    });
    
    const db = getDatabase();
    const dirtyRecord = db.prepare(`
      SELECT * FROM dirty_records WHERE record_no = ?
    `).get('TEST_APT_DIRTY_001');
    
    if (result.has_dirty_issues && dirtyRecord) {
      console.log('   ✅ 脏记录检测通过 - 缺字段已分类');
      console.log(`      类型: ${dirtyRecord.dirty_type}`);
      console.log(`      原因: ${dirtyRecord.dirty_reason}`);
      testDirtyId = dirtyRecord.record_id;
      passed++;
    } else {
      console.log('   ❌ 脏记录检测失败');
      failed++;
    }
  } catch (e) {
    console.log('   ❌ 脏记录检测失败:', e.message);
    failed++;
  }
  
  console.log('\n🧪 测试 3: 跨源数据关联 - 预约+闸机+截图关联同一事实');
  try {
    const aptResult = receiveAppointment({
      appointment_no: 'TEST_APT_CROSS_001',
      visitor_name: '跨源测试',
      license_plate: 'TEST001',
      visit_date: today,
      source: 'test'
    });
    
    const gateResult = receiveGateRecord({
      record_no: 'TEST_GATE_CROSS_001',
      visitor_name: '跨源测试',
      license_plate: 'TEST001',
      pass_time: `${today} 10:00:00`,
      appointment_no: 'TEST_APT_CROSS_001'
    });
    
    const scrResult = receiveScreenshot({
      screenshot_no: 'TEST_SCR_CROSS_001',
      license_plate: 'TEST001',
      recognized_plate: 'TEST001',
      capture_time: `${today} 10:00:01`,
      appointment_no: 'TEST_APT_CROSS_001',
      gate_record_no: 'TEST_GATE_CROSS_001'
    });
    
    const factId = aptResult.fact_id;
    if (gateResult.fact_id === factId && scrResult.fact_id === factId) {
      console.log('   ✅ 跨源关联测试通过 - 三条记录关联同一事实');
      console.log(`      事实ID: ${factId}`);
      passed++;
    } else {
      console.log('   ❌ 跨源关联测试失败');
      failed++;
    }
  } catch (e) {
    console.log('   ❌ 跨源关联测试失败:', e.message);
    failed++;
  }
  
  console.log('\n🧪 测试 4: 事实详情查询 - 包含完整关联数据');
  try {
    const fact = getFactById(testFactId);
    if (fact && fact.appointment && fact.operation_history && fact.manual_notes) {
      console.log('   ✅ 事实详情查询通过');
      console.log(`      包含: 预约记录、操作历史、人工备注字段`);
      passed++;
    } else {
      console.log('   ❌ 事实详情查询失败');
      failed++;
    }
  } catch (e) {
    console.log('   ❌ 事实详情查询失败:', e.message);
    failed++;
  }
  
  console.log('\n🧪 测试 5: 补偿队列 - 重试流程');
  try {
    const db = getDatabase();
    const queueItem = db.prepare(`
      SELECT * FROM compensation_queue WHERE fact_id = ?
    `).get(testFactId);
    
    if (queueItem) {
      testQueueId = queueItem.queue_id;
      const retryResult = processRetry(testQueueId);
      
      if (retryResult.newStatus && retryResult.retryCount > 0) {
        console.log('   ✅ 队列重试测试通过');
        console.log(`      重试后状态: ${retryResult.newStatus}, 次数: ${retryResult.retryCount}`);
        passed++;
      } else {
        console.log('   ❌ 队列重试失败');
        failed++;
      }
    } else {
      console.log('   ⚠️  无队列项，跳过');
    }
  } catch (e) {
    console.log('   ❌ 队列重试测试失败:', e.message);
    failed++;
  }
  
  console.log('\n🧪 测试 6: 人工备注 - 添加客服备注');
  try {
    const noteId = addManualNote(
      testFactId,
      '客服小王',
      'customer_service',
      '已联系访客，确认来访目的为商务洽谈',
      ['chat_log_001.pdf']
    );
    
    if (noteId) {
      console.log('   ✅ 人工备注测试通过');
      console.log(`      备注ID: ${noteId}`);
      passed++;
    } else {
      console.log('   ❌ 人工备注测试失败');
      failed++;
    }
  } catch (e) {
    console.log('   ❌ 人工备注测试失败:', e.message);
    failed++;
  }
  
  console.log('\n🧪 测试 7: 脏记录处理 - 人工修正后更新状态');
  try {
    if (testDirtyId) {
      handleDirtyRecord(testDirtyId, 'fixed', '安保主管', '已补充缺失的visit_date字段');
      
      const db = getDatabase();
      const dirty = db.prepare(`
        SELECT * FROM dirty_records WHERE record_id = ?
      `).get(testDirtyId);
      
      if (dirty.status === 'fixed') {
        console.log('   ✅ 脏记录处理测试通过');
        console.log(`      状态: ${dirty.status}, 处理人: ${dirty.handled_by}`);
        passed++;
      } else {
        console.log('   ❌ 脏记录处理失败');
        failed++;
      }
    } else {
      console.log('   ⚠️  无脏记录ID，跳过');
    }
  } catch (e) {
    console.log('   ❌ 脏记录处理测试失败:', e.message);
    failed++;
  }
  
  console.log('\n🧪 测试 8: 安保报告生成');
  try {
    const report = generateSecuritySupervisorReport();
    if (report.report && report.report.generated_at) {
      console.log('   ✅ 安保报告生成通过');
      console.log(`      JSON文件: ${report.json_file.split('/').pop()}`);
      console.log(`      文本文件: ${report.text_file.split('/').pop()}`);
      passed++;
    } else {
      console.log('   ❌ 安保报告生成失败');
      failed++;
    }
  } catch (e) {
    console.log('   ❌ 安保报告生成失败:', e.message);
    failed++;
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('                      测试结果汇总');
  console.log('='.repeat(70));
  console.log(`   ✅ 通过: ${passed}`);
  console.log(`   ❌ 失败: ${failed}`);
  console.log(`   📊 通过率: ${Math.round(passed/(passed+failed)*100)}%`);
  console.log('='.repeat(70));
  
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);
