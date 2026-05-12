const { sequelize, Contract, Installment } = require('../models');
const ContractService = require('../services/ContractService');
const RepaymentService = require('../services/RepaymentService');
const ForbearanceService = require('../services/ForbearanceService');
const CollectionService = require('../services/CollectionService');
const moment = require('moment');

let testResults = [];

function logTest(testName, passed, message = '') {
  const result = { testName, passed, message };
  testResults.push(result);
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${testName}`);
  if (message) {
    console.log(`   ${message}`);
  }
}

async function runTests() {
  console.log('=== 开始运行小贷还款宽限 API 测试场景 ===\n');

  try {
    await sequelize.sync({ force: true });
    console.log('数据库初始化完成\n');

    let contract = null;
    let firstInstallment = null;
    let application = null;

    console.log('--- 测试场景 1: 合同与账期创建 ---\n');

    try {
      contract = await ContractService.createContract({
        contractNo: 'TEST2025001',
        customerName: '测试用户',
        customerIdNo: '123456199001011234',
        principal: 50000,
        interestRate: 8.0,
        term: 12,
        startDate: new Date(),
      });
      logTest('创建合同成功', true, `合同ID: ${contract.id}`);
    } catch (e) {
      logTest('创建合同成功', false, e.message);
      return;
    }

    try {
      const has12Installments = contract.installments.length === 12;
      logTest('自动生成12期账期', has12Installments, `实际生成: ${contract.installments.length}期`);
    } catch (e) {
      logTest('自动生成12期账期', false, e.message);
    }

    firstInstallment = contract.installments[0];

    console.log('\n--- 测试场景 2: 宽限资格校验 ---\n');

    try {
      const eligibility = await ContractService.calculateForbearanceEligibility(
        contract.id,
        firstInstallment.id
      );
      logTest('正常合同可申请宽限', eligibility.eligible === true, `剩余次数: ${eligibility.remainingForbearanceTimes}`);
      logTest('宽限天数上限为30天', eligibility.maxDays === 30, `maxDays: ${eligibility.maxDays}`);
    } catch (e) {
      logTest('正常合同可申请宽限', false, e.message);
    }

    console.log('\n--- 测试场景 3: 宽限申请天数校验 ---\n');

    try {
      await ForbearanceService.createApplication({
        contractId: contract.id,
        installmentId: firstInstallment.id,
        applicantName: '测试用户',
        applicantPhone: '13800138000',
        reason: '资金周转困难',
        requestedDays: 45,
        operator: '客服A',
      });
      logTest('申请超过最大宽限天数应失败', false, '未正确拦截超期申请');
    } catch (e) {
      logTest('申请超过最大宽限天数应失败', true, e.message);
    }

    try {
      const result = await ForbearanceService.createApplication({
        contractId: contract.id,
        installmentId: firstInstallment.id,
        applicantName: '测试用户',
        applicantPhone: '13800138000',
        reason: '资金周转困难',
        requestedDays: 15,
        operator: '客服A',
      });
      application = result.application;
      logTest('申请合法宽限天数应成功', true, `申请ID: ${application.id}, 申请天数: 15天`);
    } catch (e) {
      logTest('申请合法宽限天数应成功', false, e.message);
    }

    console.log('\n--- 测试场景 4: 审批天数校验 ---\n');

    try {
      await ForbearanceService.approveApplication(application.id, {
        approvedDays: 45,
        approver: '审批经理',
        approvalRemark: '测试超期审批',
      });
      logTest('审批超过最大宽限天数应失败', false, '未正确拦截超期审批');
    } catch (e) {
      logTest('审批超过最大宽限天数应失败', true, e.message);
    }

    console.log('\n--- 测试场景 5: 正常审批流程 ---\n');

    try {
      const approved = await ForbearanceService.approveApplication(application.id, {
        approvedDays: 15,
        approver: '审批经理',
        approvalRemark: '情况属实，同意宽限15天',
      });
      logTest('正常审批通过', approved.status === 'approved', `审批天数: ${approved.approvedDays}天`);

      const updatedContract = await ContractService.getContractDetail(contract.id);
      const updatedInstallment = updatedContract.installments[0];
      const dueDateExtended = moment(updatedInstallment.currentDueDate).isAfter(moment(firstInstallment.currentDueDate));

      logTest('审批后账期还款日延后', dueDateExtended, `原还款日: ${moment(firstInstallment.currentDueDate).format('YYYY-MM-DD')}, 新还款日: ${moment(updatedInstallment.currentDueDate).format('YYYY-MM-DD')}`);
      logTest('账期标记为已宽限', updatedInstallment.isForborne === true, `isForborne: ${updatedInstallment.isForborne}`);
      logTest('合同已用宽限次数+1', updatedContract.usedForbearanceTimes === 1, `usedForbearanceTimes: ${updatedContract.usedForbearanceTimes}`);
    } catch (e) {
      logTest('正常审批流程验证', false, e.message);
    }

    console.log('\n--- 测试场景 6: 催收中仍可宽限（需特别审批） ---\n');

    try {
      const contract2 = await ContractService.createContract({
        contractNo: 'TEST2025002',
        customerName: '催收中用户',
        customerIdNo: '123456199001011235',
        principal: 30000,
        interestRate: 9.0,
        term: 6,
        startDate: new Date(),
      });

      await Contract.update(
        { isInCollection: true },
        { where: { id: contract2.id } }
      );

      const eligibility = await ContractService.calculateForbearanceEligibility(
        contract2.id,
        contract2.installments[0].id
      );
      logTest('催收中合同宽限资格为true', eligibility.eligible === true, `eligible: ${eligibility.eligible}`);
      logTest('催收中标记需特别审批', eligibility.requiresSpecialApproval === true, `requiresSpecialApproval: ${eligibility.requiresSpecialApproval}`);
    } catch (e) {
      logTest('催收中仍可宽限验证', false, e.message);
    }

    console.log('\n--- 测试场景 7: 催收冻结状态宽限（需特别审批） ---\n');

    try {
      const contract3 = await ContractService.createContract({
        contractNo: 'TEST2025003',
        customerName: '催收冻结用户',
        customerIdNo: '123456199001011236',
        principal: 20000,
        interestRate: 8.5,
        term: 6,
        startDate: new Date(),
      });

      await CollectionService.freezeCollection(contract3.id, {
        freezeReason: '测试催收冻结',
        freezeDays: 30,
      });

      const eligibility = await ContractService.calculateForbearanceEligibility(
        contract3.id,
        contract3.installments[0].id
      );
      logTest('催收冻结合同宽限资格为true', eligibility.eligible === true, `eligible: ${eligibility.eligible}`);
      logTest('催收冻结标记需特别审批', eligibility.requiresSpecialApproval === true, `requiresSpecialApproval: ${eligibility.requiresSpecialApproval}`);
    } catch (e) {
      logTest('催收冻结状态宽限验证', false, e.message);
    }

    console.log('\n--- 测试场景 8: 还款防重机制 ---\n');

    try {
      const contract4 = await ContractService.createContract({
        contractNo: 'TEST2025004',
        customerName: '防重测试用户',
        customerIdNo: '123456199001011237',
        principal: 10000,
        interestRate: 8.0,
        term: 3,
        startDate: new Date(),
      });

      const sourceId = 'BANK_TRANSFER_UNIQUE_001';

      const result1 = await RepaymentService.createRepayment({
        contractId: contract4.id,
        installmentId: contract4.installments[0].id,
        amount: 500,
        repaymentDate: new Date(),
        repaymentMethod: 'bank_transfer',
        type: 'partial',
        sourceId,
        operator: '客服A',
      });
      logTest('首次还款成功', !result1.isDuplicate, `还款ID: ${result1.repayment.id}`);

      const result2 = await RepaymentService.createRepayment({
        contractId: contract4.id,
        installmentId: contract4.installments[0].id,
        amount: 500,
        repaymentDate: new Date(),
        repaymentMethod: 'bank_transfer',
        type: 'partial',
        sourceId,
        operator: '客服A',
      });
      logTest('相同sourceId重复还款被拦截', result2.isDuplicate === true, `isDuplicate: ${result2.isDuplicate}`);
    } catch (e) {
      logTest('还款防重机制验证', false, e.message);
    }

    console.log('\n--- 测试场景 9: 部分还款账期更新 ---\n');

    try {
      const contract5 = await ContractService.createContract({
        contractNo: 'TEST2025005',
        customerName: '部分还款测试',
        customerIdNo: '123456199001011238',
        principal: 10000,
        interestRate: 8.0,
        term: 3,
        startDate: new Date(),
      });

      const installment = contract5.installments[0];
      const partialAmount = parseFloat(installment.totalAmount) / 2;

      await RepaymentService.createRepayment({
        contractId: contract5.id,
        installmentId: installment.id,
        amount: partialAmount,
        repaymentDate: new Date(),
        repaymentMethod: 'alipay',
        type: 'partial',
        operator: '客服A',
      });

      const updatedInstallment = await Installment.findByPk(installment.id);
      logTest('部分还款后账期状态为partial', updatedInstallment.status === 'partial', `status: ${updatedInstallment.status}`);
      logTest('已还金额正确更新', Math.abs(parseFloat(updatedInstallment.paidAmount) - partialAmount) < 0.01, `paidAmount: ${updatedInstallment.paidAmount}, 期望: ${partialAmount}`);
    } catch (e) {
      logTest('部分还款账期更新验证', false, e.message);
    }

    console.log('\n--- 测试场景 10: 还款试算功能 ---\n');

    try {
      const contract6 = await ContractService.createContract({
        contractNo: 'TEST2025006',
        customerName: '试算测试用户',
        customerIdNo: '123456199001011239',
        principal: 30000,
        interestRate: 8.0,
        term: 3,
        startDate: new Date(),
      });

      const trialAmount = 5000;
      const trial = await RepaymentService.calculateTrial(contract6.id, trialAmount);

      logTest('还款试算返回正确影响期数', trial.totalInstallmentsAffected > 0, `影响期数: ${trial.totalInstallmentsAffected}`);
      logTest('试算明细包含期号和还款金额', trial.trialDetails.length > 0 && trial.trialDetails[0].installmentNo, `试算明细期数: ${trial.trialDetails.length}`);
    } catch (e) {
      logTest('还款试算功能验证', false, e.message);
    }

    console.log('\n--- 测试场景 11: 超过宽限次数限制 ---\n');

    try {
      const contract7 = await ContractService.createContract({
        contractNo: 'TEST2025007',
        customerName: '次数限制测试',
        customerIdNo: '123456199001011240',
        principal: 10000,
        interestRate: 8.0,
        term: 6,
        startDate: new Date(),
        maxForbearanceTimes: 1,
      });

      const app1 = await ForbearanceService.createApplication({
        contractId: contract7.id,
        installmentId: contract7.installments[0].id,
        applicantName: '测试用户',
        applicantPhone: '13800138000',
        reason: '测试1',
        requestedDays: 10,
        operator: '客服A',
      });
      await ForbearanceService.approveApplication(app1.application.id, {
        approvedDays: 10,
        approver: '审批经理',
        approvalRemark: 'OK',
      });

      const refreshedContract = await ContractService.getContractDetail(contract7.id);

      try {
        await ForbearanceService.createApplication({
          contractId: refreshedContract.id,
          installmentId: refreshedContract.installments[1].id,
          applicantName: '测试用户',
          applicantPhone: '13800138000',
          reason: '另一账期宽限，合同次数已用完',
          requestedDays: 10,
          operator: '客服A',
        });
        logTest('超过宽限次数应被拒绝', false, `未正确拦截超限申请，当前次数: ${refreshedContract.usedForbearanceTimes}/${refreshedContract.maxForbearanceTimes}`);
      } catch (e) {
        logTest('超过宽限次数应被拒绝', true, e.message);
      }
    } catch (e) {
      logTest('宽限次数限制验证', false, e.message);
    }

    console.log('\n=== 测试汇总 ===\n');
    const passed = testResults.filter(t => t.passed).length;
    const total = testResults.length;
    console.log(`通过: ${passed}/${total}`);
    console.log(`通过率: ${((passed/total)*100).toFixed(1)}%\n`);

    if (passed < total) {
      console.log('失败的测试:');
      testResults.filter(t => !t.passed).forEach(t => {
        console.log(`  - ${t.testName}: ${t.message}`);
      });
    } else {
      console.log('🎉 所有测试通过！');
    }

  } catch (error) {
    console.error('测试执行失败:', error);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

runTests();
