import dayjs from 'dayjs';
import { FilingStatus } from '../src/types';
import { filingService } from '../src/services/FilingService';

async function testCompleteFlow() {
  console.log('=== 开始测试公网出口备案API完整流程 ===\n');

  try {
    console.log('1. 创建备案申请...');
    const filing = await filingService.createFiling({
      serviceName: 'order-service',
      egressAddress: 'https://api.external.com',
      openWindow: {
        startTime: dayjs().toISOString(),
        endTime: dayjs().add(1, 'day').toISOString()
      },
      purpose: '对接第三方支付接口，需要临时开放公网出口',
      closeCondition: {
        type: 'manual',
        reason: '任务完成后手动关闭'
      },
      creator: 'zhangsan'
    });
    console.log('   创建成功，ID:', filing.id);
    console.log('   当前状态:', filing.status);
    console.log('   审批状态:', filing.approvalStatus);
    console.log();

    console.log('2. 审批通过...');
    const approvedFiling = await filingService.approveFiling(filing.id, 'security-admin');
    console.log('   审批状态:', approvedFiling.approvalStatus);
    console.log('   审批人:', approvedFiling.approver);
    console.log();

    console.log('3. 推进状态到已确认...');
    const confirmedFiling = await filingService.advanceStatus(
      filing.id,
      FilingStatus.CONFIRMED,
      'system',
      '审批通过，已确认开放'
    );
    console.log('   当前状态:', confirmedFiling.status);
    console.log();

    console.log('4. 模拟安全检查异常（异常路径追溯...');
    await filingService.handleException(filing.id, {
      step: 'security_check',
      originalInput: {
        serviceName: 'order-service',
        egressAddress: 'https://api.external.com',
        sourceIp: '192.168.1.100'
      },
      processingBasis: '根据安全策略第3.2条，对外接口需要额外验证',
      conclusion: '第一次安全检查通过，但已记录审计日志',
      errorCode: 'SEC-001',
      errorMessage: '检测到异常访问模式，已记录',
      operator: 'security-bot'
    });
    console.log('   异常记录已保存');
    console.log();

    console.log('5. 记录访问日志...');
    await filingService.recordAccess(
      filing.id,
      '10.0.0.50',
      'https://api.external.com/v1/pay',
      'HTTP/GET',
      'success'
    );
    await filingService.recordAccess(
      filing.id,
      '10.0.0.51',
      'https://api.external.com/v1/callback',
      'HTTP/POST',
      'success'
    );
    console.log('   访问日志已记录');
    console.log();

    console.log('6. 人工修正备案信息...');
    await filingService.manualCorrection(filing.id, {
      field: 'purpose',
      oldValue: '对接第三方支付接口，需要临时开放公网出口',
      newValue: '对接第三方支付和回调接口，需要临时开放公网出口',
      operator: 'zhangsan',
      reason: '补充说明回调接口需求'
    });
    console.log('   人工修正已记录');
    console.log();

    console.log('7. 关闭备案...');
    await filingService.closeFiling(filing.id, 'zhangsan', '支付对接任务已完成');
    console.log('   备案已关闭');
    console.log();

    console.log('8. 生成备案报告...');
    const report = await filingService.generateReport(filing.id);
    console.log('   报告摘要:');
    console.log('     服务名称:', report.summary.serviceName);
    console.log('     开放时长(分钟):', report.summary.openDuration);
    console.log('     访问次数:', report.summary.accessCount);
    console.log('     状态变更次数:', report.summary.statusChanges);
    console.log('     结论:', report.conclusion);
    console.log();

    console.log('9. 异常记录详情:');
    report.details.exceptions.forEach((ex, idx) => {
      console.log(`   ${idx + 1}. 步骤: ${ex.step}, 结论: ${ex.conclusion}`);
      console.log(`      原始输入:`, ex.originalInput.serviceName, ex.originalInput.egressAddress);
    });
    console.log();

    console.log('10. 状态变更历史:');
    report.details.statusHistory.forEach((h, idx) => {
      console.log(`   ${idx + 1}. ${h.fromStatus || '初始' } -> ${h.toStatus}, 原因: ${h.reason}`);
    });
    console.log();

    console.log('11. 查询所有备案...');
    const allFilings = await filingService.listFilings();
    console.log('   备案总数:', allFilings.length);
    console.log();

    console.log('=== 测试流程完成 ===');

  } catch (error: any) {
    console.error('测试失败:', error.message);
    process.exit(1);
  }
}

async function testBlockedFlow() {
  console.log('\n=== 测试拦截异常流程 ===\n');

  try {
    console.log('1. 创建另一个备案...');
    const filing = await filingService.createFiling({
      serviceName: 'risk-service',
      egressAddress: 'https://high-risk.external.com',
      openWindow: {
        startTime: dayjs().toISOString(),
        endTime: dayjs().add(2, 'day').toISOString()
      },
      purpose: '对接高风险第三方接口',
      closeCondition: {
        type: 'auto',
        reason: '超时自动关闭'
      },
      creator: 'lisi'
    });
    console.log('   创建成功，ID:', filing.id);
    console.log();

    console.log('2. 模拟安全检查拦截...');
    await filingService.handleException(filing.id, {
      step: 'security_check',
      originalInput: {
        serviceName: 'risk-service',
        egressAddress: 'https://high-risk.external.com',
        riskLevel: 'high'
      },
      processingBasis: '根据安全策略第5.1条，高风险地址禁止开放',
      conclusion: '安全检查未通过，已拦截',
      errorCode: 'SEC-BLOCK-002',
      errorMessage: '目标地址在黑名单中',
      operator: 'security-system'
    });
    console.log('   拦截异常已记录');
    console.log();

    console.log('3. 推进状态到已拦截...');
    await filingService.advanceStatus(
      filing.id,
      FilingStatus.BLOCKED,
      'security-admin',
      '安全检查未通过，已拦截'
    );
    console.log('   当前状态: blocked');
    console.log();

    console.log('4. 撤销已拦截的备案...');
    await filingService.advanceStatus(
      filing.id,
      FilingStatus.REVOKED,
      'security-admin',
      '确认撤销此备案申请'
    );
    console.log('   当前状态: revoked');
    console.log();

    console.log('5. 生成报告查看异常追溯...');
    const report = await filingService.generateReport(filing.id);
    console.log('   结论:', report.conclusion);
    console.log();

    console.log('=== 异常流程测试完成 ===');

  } catch (error: any) {
    console.error('测试失败:', error.message);
    process.exit(1);
  }
}

async function runTests() {
  await testCompleteFlow();
  await testBlockedFlow();
  console.log('\n✅ 所有测试通过!');
}

runTests();
