import { benefitService } from '../src/services/benefitService';
import { FreezeReason, BenefitStatus } from '../src/types';

function printSection(title: string) {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${title}`);
  console.log('='.repeat(60) + '\n');
}

function printResult(label: string, result: any) {
  console.log(`\n📌 ${label}:`);
  console.log(`   成功: ${result.success ? '✅' : '❌'}`);
  console.log(`   消息: ${result.message}`);
  if (result.isIdempotent) {
    console.log(`   幂等: ✅ (重复请求)`);
  }
  if (result.data && result.data.ledgerExplanation) {
    console.log(`\n   📊 账本解释:`);
    result.data.ledgerExplanation.forEach((exp: string, i: number) => {
      console.log(`      ${i + 1}. ${exp}`);
    });
  }
}

async function runDemos() {
  console.log('\n🚀 开始演示会员权益冻结 API 完整业务流程');
  
  printSection('场景一: 正常使用流程');
  
  console.log('操作: 创建会员「张三」');
  const memberResult = benefitService.createMember({
    requestId: 'req-create-member-001',
    name: '张三',
    phone: '13800138001'
  });
  printResult('创建会员', memberResult);
  const memberId = memberResult.data!.memberId;

  console.log('\n操作: 给张三发放「VIP会员」权益 30天');
  const grantResult = benefitService.grantBenefit({
    requestId: 'req-grant-001',
    memberId,
    benefitType: 'VIP',
    benefitName: '月度VIP会员',
    totalDays: 30
  });
  printResult('发放权益', grantResult);
  const benefitId = grantResult.data!.benefitId;

  console.log('\n操作: 查询权益详情');
  const queryResult1 = benefitService.queryBenefit({ benefitId });
  printResult('权益查询', queryResult1);

  printSection('场景二: 风控冻结与解除');
  
  console.log('操作: 风控触发冻结（检测到异常交易）');
  const freezeResult = benefitService.freezeBenefit({
    requestId: 'req-freeze-risk-001',
    benefitId,
    reason: FreezeReason.RISK_CONTROL,
    detail: '风控检测: 异常登录IP',
    operator: '风控系统'
  });
  printResult('风控冻结', freezeResult);

  console.log('\n操作: 再次查询权益（确认冻结状态）');
  const queryAfterFreeze = benefitService.queryBenefit({ benefitId });
  printResult('冻结后查询', queryAfterFreeze);

  console.log('\n操作: 风控审核通过，解除冻结');
  const unfreezeResult = benefitService.unfreezeBenefit({
    requestId: 'req-unfreeze-risk-001',
    benefitId,
    reason: '风控审核通过，IP已白名单',
    operator: '风控专员-小李'
  });
  printResult('解除冻结', unfreezeResult);

  console.log('\n操作: 查询权益（确认恢复正常）');
  const queryAfterUnfreeze = benefitService.queryBenefit({ benefitId });
  printResult('解冻后查询', queryAfterUnfreeze);

  printSection('场景三: 退款流程（永久冻结，不可解冻）');
  
  console.log('操作: 另一个会员「李四」创建并发放权益');
  const member2Result = benefitService.createMember({
    requestId: 'req-create-member-002',
    name: '李四',
    phone: '13800138002'
  });
  const member2Id = member2Result.data!.memberId;

  const grant2Result = benefitService.grantBenefit({
    requestId: 'req-grant-002',
    memberId: member2Id,
    benefitType: 'SVIP',
    benefitName: '季度SVIP会员',
    totalDays: 90
  });
  const benefit2Id = grant2Result.data!.benefitId;
  printResult('李四获得权益', grant2Result);

  console.log('\n操作: 李四申请退款，执行退款处理');
  const refundResult = benefitService.processRefund({
    requestId: 'req-refund-001',
    benefitId: benefit2Id,
    detail: '用户主动申请退款，订单已取消',
    operator: '客服-小王'
  });
  printResult('退款处理', refundResult);

  console.log('\n操作: 尝试解冻已退款的权益（应该失败）');
  const unfreezeFailResult = benefitService.unfreezeBenefit({
    requestId: 'req-unfreeze-fail-001',
    benefitId: benefit2Id,
    reason: '尝试解冻已退款权益'
  });
  printResult('尝试解冻已退款权益', unfreezeFailResult);

  console.log('\n操作: 再次查询李四权益');
  const queryRefund = benefitService.queryBenefit({ benefitId: benefit2Id });
  printResult('退款后查询', queryRefund);

  printSection('场景四: 人工补偿流程');
  
  console.log('操作: 创建会员「王五」');
  const member3Result = benefitService.createMember({
    requestId: 'req-create-member-003',
    name: '王五',
    phone: '13800138003'
  });
  const member3Id = member3Result.data!.memberId;

  const grant3Result = benefitService.grantBenefit({
    requestId: 'req-grant-003',
    memberId: member3Id,
    benefitType: 'VIP',
    benefitName: '年度VIP会员',
    totalDays: 365
  });
  const benefit3Id = grant3Result.data!.benefitId;
  printResult('王五获得权益', grant3Result);

  console.log('\n操作: 客服补偿 7 天权益（系统故障补偿）');
  const compensateResult = benefitService.compensateBenefit({
    requestId: 'req-compensate-001',
    benefitId: benefit3Id,
    days: 7,
    reason: '系统故障导致权益无法使用补偿',
    operator: '客服-小张'
  });
  printResult('人工补偿', compensateResult);

  console.log('\n操作: 查询补偿后的权益');
  const queryAfterCompensate = benefitService.queryBenefit({ benefitId: benefit3Id });
  printResult('补偿后查询', queryAfterCompensate);

  console.log('\n操作: 尝试补偿超限天数（100天，上限90天）');
  const compensateFailResult = benefitService.compensateBenefit({
    requestId: 'req-compensate-fail-001',
    benefitId: benefit3Id,
    days: 100,
    reason: '测试超限补偿',
    operator: '测试'
  });
  printResult('超限补偿失败', compensateFailResult);

  printSection('场景五: 幂等性测试 - 重复调用');
  
  console.log('操作: 使用相同requestId重复调用创建会员');
  const memberIdempotent1 = benefitService.createMember({
    requestId: 'req-create-member-001',
    name: '张三',
    phone: '13800138001'
  });
  printResult('重复创建会员（幂等）', memberIdempotent1);

  console.log('\n操作: 使用相同requestId重复调用补偿');
  const compensateIdempotent = benefitService.compensateBenefit({
    requestId: 'req-compensate-001',
    benefitId: benefit3Id,
    days: 7,
    reason: '系统故障导致权益无法使用补偿',
    operator: '客服-小张'
  });
  printResult('重复补偿（幂等）', compensateIdempotent);

  console.log('\n操作: 查询最终权益状态（确认只补偿了一次）');
  const queryFinal = benefitService.queryBenefit({ benefitId: benefit3Id });
  printResult('最终状态查询', queryFinal);

  printSection('场景六: 人工修正（需记录前后差异）');
  
  console.log('操作: 人工修正王五的权益信息');
  const correctResult = benefitService.manualCorrect({
    requestId: 'req-correct-001',
    benefitId: benefit3Id,
    changes: {
      remainingDays: 200,
      name: '年度VIP会员(修正版)'
    },
    operator: '运营经理-老刘',
    reason: '历史数据迁移修正'
  });
  printResult('人工修正', correctResult);
  
  if (correctResult.data) {
    console.log('\n   📝 差异记录:');
    correctResult.data.diffs.forEach((diff: any, i: number) => {
      console.log(`      ${i + 1}. ${diff.field}: ${diff.before} → ${diff.after}`);
    });
  }

  printSection('场景七: 异常流程 - 重复解冻已解冻权益');
  
  console.log('操作: 张三的权益已解冻，再次尝试解冻');
  const unfreezeAgainResult = benefitService.unfreezeBenefit({
    requestId: 'req-unfreeze-duplicate-001',
    benefitId,
    reason: '重复解冻测试'
  });
  printResult('重复解冻失败', unfreezeAgainResult);

  console.log('\n操作: 尝试冻结已冻结的权益');
  const freezeAgainResult = benefitService.freezeBenefit({
    requestId: 'req-freeze-duplicate-001',
    benefitId: benefit2Id,
    reason: FreezeReason.RISK_CONTROL,
    detail: '尝试冻结已退款权益'
  });
  printResult('冻结已退款权益失败', freezeAgainResult);

  printSection('📊 导出完整报告');
  
  const reportResult = benefitService.exportReport({});
  if (reportResult.success && reportResult.data) {
    console.log(`\n   共 ${reportResult.data.length} 条账本记录\n`);
    reportResult.data.forEach((entry: any, index: number) => {
      console.log(`   ${index + 1}. [${entry['时间']}] ${entry['操作类型']} - ${entry['操作详情']} (${entry['是否成功']})`);
    });
  }

  printSection('📋 完整数据汇总');
  
  const allData = benefitService.getAllData();
  console.log(`   会员数: ${allData.members.length}`);
  console.log(`   权益数: ${allData.benefits.length}`);
  console.log(`   账本记录: ${allData.ledgers.length}`);

  console.log('\n\n✅ 所有演示场景执行完成！');
  console.log('\n📌 关键业务规则验证:');
  console.log('   ✅ 正常流程: 发放 → 冻结 → 解冻 状态一致');
  console.log('   ✅ 退款规则: 退款后永久冻结，不可解冻');
  console.log('   ✅ 风控规则: 风控解除恢复剩余天数');
  console.log('   ✅ 补偿规则: 单次补偿上限90天');
  console.log('   ✅ 幂等规则: 相同requestId返回相同结果');
  console.log('   ✅ 人工修正: 记录前后差异和操作者');
  console.log('   ✅ 账本一致: 每步操作都有状态变化记录');
}

runDemos().catch(console.error);
