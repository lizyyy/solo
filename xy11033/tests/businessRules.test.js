const { checkInventoryConflict, checkDailyReportConsistency, checkDuplicateChangeRequest, detectAllConflicts, classifyRecord } = require('../src/services/businessRules');
const { runAsync, getAsync } = require('../src/db');
const { v4: uuidv4 } = require('uuid');

function test(description, fn) {
  return fn().then(() => {
    console.log(`✅ ${description}`);
  }).catch(error => {
    console.log(`❌ ${description}`);
    console.error(`   错误: ${error.message}`);
    process.exitCode = 1;
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || '断言失败');
  }
}

async function runTests() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 业务规则单元测试');
  console.log('='.repeat(60) + '\n');

  await test('库存充足时检测不出冲突', async () => {
    const result = await checkInventoryConflict('皇家', '成犬粮', 1);
    assert(result.hasConflict === false, '库存充足应该没有冲突');
  });

  await test('库存不存在时检测到冲突', async () => {
    const result = await checkInventoryConflict('不存在的品牌', '未知类型', 1);
    assert(result.hasConflict === true, '库存不存在应该有冲突');
    assert(result.type === 'inventory_shortage', '冲突类型应该是 inventory_shortage');
  });

  await test('库存不足时检测到冲突', async () => {
    const result = await checkInventoryConflict('比瑞吉', '小型成犬粮', 1);
    assert(result.hasConflict === true, '库存不足应该有冲突');
  });

  await test('库存低于预警线但充足时返回警告', async () => {
    const result = await checkInventoryConflict('比瑞吉', '小型成犬粮', 0.3);
    assert(result.hasConflict === false, '库存够用应该没有冲突');
    assert(result.warning === true, '低于预警线应该有警告');
  });

  await test('护理日报不一致时检测到冲突', async () => {
    const testFosterId = uuidv4();
    const reportDate = new Date().toISOString().split('T')[0];
    
    await runAsync('INSERT INTO daily_care_reports (id, foster_order_id, report_date, food_brand, food_type, food_amount, feeding_time, appetite_status, health_status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      uuidv4(), testFosterId, reportDate, '皇家', '成犬粮', 0.3, '08:30', 'good', 'normal', '张护理', new Date().toISOString()
    ]);

    const result = await checkDailyReportConsistency(testFosterId, reportDate, '渴望', '室内猫粮');
    assert(result.hasConflict === true, '品牌不一致应该检测到冲突');
    assert(result.type === 'daily_report_inconsistency', '冲突类型应该是 daily_report_inconsistency');
  });

  await test('24小时内重复提交同类请求检测到冲突', async () => {
    const testFosterId = uuidv4();
    const now = new Date().toISOString();
    
    await runAsync('INSERT INTO feeding_changes (id, foster_order_id, change_type, change_reason, status, submit_source, submitted_by, submitted_at, is_abnormal, conflict_detected, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      uuidv4(), testFosterId, 'owner_temporary_food_change', '测试原因', 'pending_review', 'staff_system', '张护理', now, 0, 0, now, now
    ]);

    const result = await checkDuplicateChangeRequest(testFosterId, 'owner_temporary_food_change');
    assert(result.hasConflict === true, '24小时内重复应该检测到冲突');
    assert(result.type === 'duplicate_change_request', '冲突类型应该是 duplicate_change_request');
  });

  await test('detectAllConflicts 能检测多种冲突', async () => {
    const testFosterId = uuidv4();
    const now = new Date().toISOString();
    
    await runAsync('INSERT INTO feeding_changes (id, foster_order_id, change_type, change_reason, status, submit_source, submitted_by, submitted_at, is_abnormal, conflict_detected, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      uuidv4(), testFosterId, 'owner_temporary_food_change', '测试原因', 'pending_review', 'staff_system', '张护理', now, 0, 0, now, now
    ]);

    const changeData = {
      foster_order_id: testFosterId,
      change_type: 'owner_temporary_food_change',
      new_food_brand: '不存在的品牌',
      new_food_type: '未知类型',
      new_daily_amount: 1
    };

    const result = await detectAllConflicts(changeData);
    assert(result.conflicts.length >= 1, '应该检测到至少一种冲突');
  });

  await test('classifyRecord 能正确分类正常和异常记录', async () => {
    const normalChange = {
      foster_order_id: uuidv4(),
      change_type: 'feeding_time_adjustment'
    };
    const normalResult = await classifyRecord(normalChange);
    assert(normalResult.recordType === 'normal', '无冲突应该分类为正常记录');

    const abnormalChange = {
      foster_order_id: uuidv4(),
      change_type: 'owner_temporary_food_change',
      new_food_brand: '不存在的品牌',
      new_food_type: '未知类型'
    };
    const abnormalResult = await classifyRecord(abnormalChange);
    assert(abnormalResult.recordType === 'abnormal', '有冲突应该分类为异常记录');
  });

  console.log('\n' + '='.repeat(60));
  console.log('✅ 业务规则测试完成');
  console.log('='.repeat(60) + '\n');
}

runTests();
