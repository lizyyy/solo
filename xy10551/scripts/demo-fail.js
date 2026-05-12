const db = require('../src/database/init');
const service = require('../src/services/registrationService');

const ACTIVITY_ID = 'ACT-PARENTCHILD-001';

function printStep(step, title, details = '') {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`【失败场景 ${step}】${title}`);
  console.log(`${'─'.repeat(60)}`);
  if (details) console.log(details);
}

function printResult(result, label = '') {
  if (label) console.log(`\n${label}:`);
  console.log(JSON.stringify(result, null, 2));
}

async function runFailDemo() {
  await db.init();
  
  console.log('\n' + '═'.repeat(60));
  console.log('  社区活动报名系统 - 异常场景演示');
  console.log('═'.repeat(60));
  console.log('活动: 亲子手工制作活动');
  console.log('规则: 年龄6-12岁, 每户最多3人, 总名额10人');
  console.log('═'.repeat(60));

  printStep(1, '家庭人数超限 - 赵阳带3个家庭成员（共4人，超限制）');
  console.log('预期: 被拒绝，返回错误码 FAMILY_LIMIT_EXCEEDED');
  
  const result1 = service.registerForActivity({
    activityId: ACTIVITY_ID,
    residentId: 'RES-006',
    familyMemberIds: ['FM-009', 'FM-010', 'FM-011'],
    operator: '居民赵阳',
    requestId: 'fail-req-001'
  });
  printResult(result1, '实际结果');
  console.log('✓ 验证:', result1.code === 'FAMILY_LIMIT_EXCEEDED' ? '通过' : '失败');

  printStep(2, '年龄不符合 - 陈静的孩子陈浩（6岁以下，2020年生仅6岁以下）');
  console.log('预期: 被拒绝，返回错误码 AGE_RESTRICTION_VIOLATION');
  
  const result2 = service.registerForActivity({
    activityId: ACTIVITY_ID,
    residentId: 'RES-005',
    familyMemberIds: ['FM-008'],
    operator: '居民陈静',
    requestId: 'fail-req-002'
  });
  printResult(result2, '实际结果');
  console.log('✓ 验证:', result2.code === 'AGE_RESTRICTION_VIOLATION' ? '通过' : '失败');

  printStep(3, '活动未开放报名 - 尝试报名草稿状态的夏令营');
  console.log('预期: 被拒绝，返回错误码 ACTIVITY_NOT_ACTIVE');
  
  const result3 = service.registerForActivity({
    activityId: 'ACT-SUMMER-001',
    residentId: 'RES-001',
    familyMemberIds: ['FM-001'],
    operator: '居民张伟',
    requestId: 'fail-req-003'
  });
  printResult(result3, '实际结果');
  console.log('✓ 验证:', result3.code === 'ACTIVITY_NOT_ACTIVE' ? '通过' : '失败');

  printStep(4, '重复报名 - 张伟尝试再次报名同一活动');
  console.log('预期: 被拒绝，返回错误码 ALREADY_REGISTERED');
  
  const normalRegister = service.registerForActivity({
    activityId: ACTIVITY_ID,
    residentId: 'RES-001',
    familyMemberIds: ['FM-001'],
    operator: '居民张伟',
    requestId: 'fail-req-004'
  });
  console.log('先让张伟正常报名一次...');
  
  const result4 = service.registerForActivity({
    activityId: ACTIVITY_ID,
    residentId: 'RES-001',
    familyMemberIds: ['FM-002'],
    operator: '居民张伟',
    requestId: 'fail-req-005'
  });
  printResult(result4, '重复报名结果');
  console.log('✓ 验证:', result4.code === 'ALREADY_REGISTERED' ? '通过' : '失败');

  printStep(5, '居民不存在 - 使用无效的居民ID');
  console.log('预期: 被拒绝，返回错误码 RESIDENT_NOT_FOUND');
  
  const result5 = service.registerForActivity({
    activityId: ACTIVITY_ID,
    residentId: 'INVALID-RESIDENT-ID',
    familyMemberIds: [],
    operator: '未知用户',
    requestId: 'fail-req-006'
  });
  printResult(result5, '实际结果');
  console.log('✓ 验证:', result5.code === 'RESIDENT_NOT_FOUND' ? '通过' : '失败');

  printStep(6, '活动不存在 - 使用无效的活动ID');
  console.log('预期: 被拒绝，返回错误码 ACTIVITY_NOT_FOUND');
  
  const result6 = service.registerForActivity({
    activityId: 'INVALID-ACTIVITY-ID',
    residentId: 'RES-002',
    familyMemberIds: [],
    operator: '居民李娜',
    requestId: 'fail-req-007'
  });
  printResult(result6, '实际结果');
  console.log('✓ 验证:', result6.code === 'ACTIVITY_NOT_FOUND' ? '通过' : '失败');

  printStep(7, '已签到不能取消 - 先签到再尝试取消');
  console.log('预期: 被拒绝，返回错误码 CANNOT_CANCEL_CHECKED_IN');
  
  const zhangWeiRegistration = db.prepare(
    'SELECT * FROM registrations WHERE activity_id = ? AND resident_id = ?'
  ).get(ACTIVITY_ID, 'RES-001');
  
  const checkinResult = service.checkIn({
    registrationId: zhangWeiRegistration.id,
    operator: '工作人员',
    requestId: 'fail-req-008'
  });
  console.log('先让张伟签到...');
  
  const result7 = service.cancelRegistration({
    registrationId: zhangWeiRegistration.id,
    operator: '居民张伟',
    reason: '想取消',
    requestId: 'fail-req-009'
  });
  printResult(result7, '取消已签到报名结果');
  console.log('✓ 验证:', result7.code === 'CANNOT_CANCEL_CHECKED_IN' ? '通过' : '失败');

  printStep(8, '报名记录不存在 - 取消无效的报名ID');
  console.log('预期: 被拒绝，返回错误码 REGISTRATION_NOT_FOUND');
  
  const result8 = service.cancelRegistration({
    registrationId: 'INVALID-REG-ID',
    operator: '居民',
    reason: '测试',
    requestId: 'fail-req-010'
  });
  printResult(result8, '实际结果');
  console.log('✓ 验证:', result8.code === 'REGISTRATION_NOT_FOUND' ? '通过' : '失败');

  printStep(9, '人工修正缺少操作者和原因');
  console.log('预期: 被拒绝，返回错误码 OPERATOR_REASON_REQUIRED');
  
  const result9 = service.manualCorrection({
    entityType: 'registration',
    entityId: zhangWeiRegistration.id,
    updates: { status: 'cancelled' },
    operator: null,
    reason: null,
    requestId: 'fail-req-011'
  });
  printResult(result9, '实际结果');
  console.log('✓ 验证:', result9.code === 'OPERATOR_REASON_REQUIRED' ? '通过' : '失败');

  printStep(10, '幂等性 - 重复发送相同请求');
  console.log('预期: 返回第一次的结果，idempotent=true');
  
  const firstCall = service.registerForActivity({
    activityId: ACTIVITY_ID,
    residentId: 'RES-003',
    familyMemberIds: ['FM-005'],
    operator: '居民王芳',
    requestId: 'fail-req-012'
  });
  console.log('第一次调用结果:', firstCall.result);
  
  const secondCall = service.registerForActivity({
    activityId: ACTIVITY_ID,
    residentId: 'RES-003',
    familyMemberIds: ['FM-005'],
    operator: '居民王芳',
    requestId: 'fail-req-012'
  });
  printResult(secondCall, '第二次调用（相同requestId）');
  console.log('✓ 验证:', secondCall.idempotent === true ? '通过' : '失败');

  console.log('\n' + '═'.repeat(60));
  console.log('  异常场景演示完成！');
  console.log('═'.repeat(60));
  console.log('\n所有异常场景覆盖:');
  console.log('✓ 家庭人数超限');
  console.log('✓ 年龄不符合限制');
  console.log('✓ 活动未开放报名');
  console.log('✓ 重复报名');
  console.log('✓ 居民不存在');
  console.log('✓ 活动不存在');
  console.log('✓ 已签到不能取消');
  console.log('✓ 报名记录不存在');
  console.log('✓ 人工修正缺少操作者和原因');
  console.log('✓ 重复操作幂等性');
}

runFailDemo().catch(err => {
  console.error('异常场景演示执行失败:', err);
  process.exit(1);
});
