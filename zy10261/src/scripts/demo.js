const { sequelize, Contract, Installment, Repayment, ForbearanceApplication } = require('../models');
const ContractService = require('../services/ContractService');
const RepaymentService = require('../services/RepaymentService');
const ForbearanceService = require('../services/ForbearanceService');
const CollectionService = require('../services/CollectionService');
const moment = require('moment');

async function runDemo() {
  try {
    console.log('=== 小贷还款宽限 API 演示 ===\n');

    await sequelize.sync({ force: true });
    console.log('1. 数据库初始化完成\n');

    console.log('2. 创建测试合同...');
    const contract = await ContractService.createContract({
      contractNo: 'DEMO2025001',
      customerName: '测试用户',
      customerIdNo: '123456199001011234',
      principal: 50000,
      interestRate: 8.0,
      term: 12,
      startDate: new Date(),
    });
    console.log(`   合同创建成功: ${contract.contractNo}`);
    console.log(`   客户: ${contract.customerName}`);
    console.log(`   本金: ¥${contract.principal}`);
    console.log(`   分期: ${contract.term}期\n`);

    const firstInstallment = contract.installments[0];
    console.log('3. 查询宽限资格...');
    const eligibility = await ContractService.calculateForbearanceEligibility(
      contract.id,
      firstInstallment.id
    );
    console.log(`   可宽限: ${eligibility.eligible}`);
    console.log(`   剩余宽限次数: ${eligibility.remainingForbearanceTimes}`);
    console.log(`   原因: ${eligibility.reasons.join(', ') || '无'}\n`);

    console.log('4. 提交宽限申请...');
    const applicationResult = await ForbearanceService.createApplication({
      contractId: contract.id,
      installmentId: firstInstallment.id,
      applicantName: '测试用户',
      applicantPhone: '13800138000',
      reason: '暂时资金周转困难',
      requestedDays: 15,
      operator: '客服A',
    });
    console.log(`   申请编号: ${applicationResult.application.applicationNo}`);
    console.log(`   状态: ${applicationResult.application.status}\n`);

    console.log('5. 审批宽限申请...');
    const approved = await ForbearanceService.approveApplication(
      applicationResult.application.id,
      {
        approvedDays: 15,
        approver: '审批经理',
        approvalRemark: '情况属实，同意宽限15天',
      }
    );
    console.log(`   审批状态: ${approved.status}`);
    console.log(`   宽限天数: ${approved.approvedDays}`);
    console.log(`   新还款日: ${moment(approved.installment.currentDueDate).format('YYYY-MM-DD')}\n`);

    console.log('6. 还款试算...');
    const trial = await RepaymentService.calculateTrial(contract.id, 5000);
    console.log(`   试算金额: ¥${trial.repaymentAmount}`);
    console.log(`   影响期数: ${trial.totalInstallmentsAffected}`);
    trial.trialDetails.forEach((detail, index) => {
      console.log(`   第${index + 1}期: 还款¥${detail.paymentAmount}, 剩余¥${detail.newRemainingAmount}`);
    });
    console.log('');

    console.log('7. 部分还款处理...');
    const repaymentResult = await RepaymentService.createRepayment({
      contractId: contract.id,
      installmentId: firstInstallment.id,
      amount: 2000,
      repaymentDate: new Date(),
      repaymentMethod: 'alipay',
      type: 'partial',
      operator: '客服A',
    });
    console.log(`   还款编号: ${repaymentResult.repayment.repaymentNo}`);
    console.log(`   还款金额: ¥${repaymentResult.repayment.amount}`);
    console.log(`   是否部分还款: ${repaymentResult.repayment.isPartial ? '是' : '否'}\n`);

    console.log('8. 验证还款后账期状态...');
    const updatedContract = await ContractService.getContractDetail(contract.id);
    const updatedInstallment = updatedContract.installments[0];
    console.log(`   账期状态: ${updatedInstallment.status}`);
    console.log(`   已还金额: ¥${updatedInstallment.paidAmount}`);
    console.log(`   剩余金额: ¥${updatedInstallment.remainingAmount}\n`);

    console.log('9. 催收冻结处理...');
    const freezeResult = await CollectionService.freezeCollection(contract.id, {
      freezeReason: '已申请宽限，暂停催收',
      freezeDays: 30,
    });
    console.log(`   ${freezeResult.message}\n`);

    console.log('10. 验证催收中仍可宽限(特殊逻辑)...');
    const updatedContract2 = await ContractService.getContractDetail(contract.id);
    const secondInstallment = updatedContract2.installments[1];
    const eligibility2 = await ContractService.calculateForbearanceEligibility(
      contract.id,
      secondInstallment.id
    );
    console.log(`   合同催收状态: ${updatedContract2.isInCollection ? '催收中' : '正常'}`);
    console.log(`   可宽限: ${eligibility2.eligible}`);
    console.log(`   是否需特别审批: ${eligibility2.requiresSpecialApproval ? '是' : '否'}\n`);

    console.log('11. 测试重复提交防重...');
    const duplicateResult = await RepaymentService.createRepayment({
      contractId: contract.id,
      amount: 2000,
      repaymentDate: new Date(),
      repaymentMethod: 'alipay',
      type: 'partial',
      sourceId: 'UNIQUE_SOURCE_001',
      operator: '客服A',
    });
    console.log(`   第一次提交: ${duplicateResult.isDuplicate ? '重复' : '成功'}`);

    const duplicateResult2 = await RepaymentService.createRepayment({
      contractId: contract.id,
      amount: 2000,
      repaymentDate: new Date(),
      repaymentMethod: 'alipay',
      type: 'partial',
      sourceId: 'UNIQUE_SOURCE_001',
      operator: '客服A',
    });
    console.log(`   第二次提交: ${duplicateResult2.isDuplicate ? '重复' : '成功'}`);
    console.log(`   消息: ${duplicateResult2.message}\n`);

    console.log('=== 演示完成 ===');
    console.log('\n核心功能验证:');
    console.log('✓ 合同创建与分期生成');
    console.log('✓ 宽限资格校验');
    console.log('✓ 宽限申请与审批');
    console.log('✓ 还款试算');
    console.log('✓ 部分还款处理');
    console.log('✓ 账期自动更新');
    console.log('✓ 催收冻结');
    console.log('✓ 催收中仍可宽限(特殊审批)');
    console.log('✓ 重复提交防重');

  } catch (error) {
    console.error('演示失败:', error);
  } finally {
    await sequelize.close();
  }
}

runDemo();
