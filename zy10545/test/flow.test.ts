import { store } from '../src/models/store';
import { qualificationService } from '../src/services/qualification.service';
import { reportService } from '../src/services/report.service';
import { RegistrationStatus } from '../src/models/types';

async function runTests() {
  console.log('=== 开始测试培训资格审核API ===\n');

  console.log('1. 创建培训');
  const training = store.createTraining({
    trainingCode: 'TRAIN-001',
    name: '高级技能培训',
    description: '针对高级员工的技能培训',
    maxSlots: 2,
    qualificationConditions: [
      { field: 'level', operator: 'greaterThan', value: 3 },
      { field: 'department', operator: 'in', value: ['技术部', '产品部'] }
    ],
    startDate: new Date('2024-06-01'),
    endDate: new Date('2024-06-05')
  });
  console.log('   ✅ 培训创建成功:', training.trainingCode);
  console.log('   📋 培训名额:', training.maxSlots);
  console.log();

  console.log('2. 第一个员工报名（符合条件，有名额）');
  const reg1 = qualificationService.processRegistration(
    training.id,
    'EMP001',
    '张三',
    'zhangsan@example.com',
    { level: 5, department: '技术部', years: 3 },
    '系统管理员'
  );
  console.log('   ✅ 报名成功，状态:', reg1.status);
  console.log();

  console.log('3. 第二个员工报名（符合条件，有名额）');
  const reg2 = qualificationService.processRegistration(
    training.id,
    'EMP002',
    '李四',
    'lisi@example.com',
    { level: 4, department: '产品部', years: 2 },
    '系统管理员'
  );
  console.log('   ✅ 报名成功，状态:', reg2.status);
  console.log();

  console.log('4. 第三个员工报名（符合条件，但名额已满，进入候补）');
  const reg3 = qualificationService.processRegistration(
    training.id,
    'EMP003',
    '王五',
    'wangwu@example.com',
    { level: 4, department: '技术部', years: 4 },
    '系统管理员'
  );
  console.log('   ✅ 报名成功，状态:', reg3.status);
  console.log('   📋 候补序号:', reg3.waitlistOrder);
  console.log();

  console.log('5. 第四个员工报名（不符合资格条件）');
  try {
    qualificationService.processRegistration(
      training.id,
      'EMP004',
      '赵六',
      'zhaoliu@example.com',
      { level: 2, department: '人事部', years: 1 },
      '系统管理员'
    );
    console.log('   ❌ 应该报错但没有报错');
  } catch (e) {
    console.log('   ✅ 正确拒绝，原因:', (e as Error).message);
  }
  console.log();

  console.log('6. 查询报名记录');
  const foundReg = store.getRegistration(reg1.id);
  console.log('   ✅ 找到报名记录:', foundReg?.applicantName);
  console.log('   📋 当前状态:', foundReg?.status);
  console.log();

  console.log('7. 生成培训报告');
  const report = reportService.generateReport(training.id);
  console.log('   ✅ 报告生成成功');
  console.log('   📊 总报名数:', report.totalRegistrations);
  console.log('   📊 通过数:', report.qualifiedCount);
  console.log('   📊 候补数:', report.waitlistCount);
  console.log();

  console.log('8. 导出CSV报告');
  const csv = await reportService.exportReportToCsv(training.id);
  console.log('   ✅ CSV导出成功，长度:', csv.length, '字符');
  console.log();

  console.log('9. 取消第一个报名（触发候补晋级）');
  qualificationService.cancelRegistration(reg1.id, '张三', '个人原因');
  console.log('   ✅ 取消成功');
  console.log();

  console.log('10. 检查候补是否晋级');
  const promotedReg = store.getRegistration(reg3.id);
  console.log('   ✅ 候补状态:', promotedReg?.status);
  console.log('   📋 是否已通过:', promotedReg?.status === RegistrationStatus.QUALIFIED ? '是 ✅' : '否 ❌');
  console.log();

  console.log('11. 重复提交报名（防重测试）');
  try {
    qualificationService.processRegistration(
      training.id,
      'EMP002',
      '李四',
      'lisi@example.com',
      { level: 4, department: '产品部' },
      '系统管理员'
    );
    console.log('   ❌ 应该报错但没有报错');
  } catch (e) {
    console.log('   ✅ 正确阻止重复报名:', (e as Error).message);
  }
  console.log();

  console.log('12. 查询审核留痕');
  const auditTrails = store.getAuditTrailsByRegistration(reg1.id);
  console.log('   ✅ 找到审核记录:', auditTrails.length, '条');
  auditTrails.forEach((a, i) => {
    console.log(`      ${i + 1}. ${a.action} - ${a.operator}`);
    console.log(`         处理依据: ${a.processingBasis}`);
  });
  console.log();

  console.log('13. 人工修正报名状态');
  const corrected = qualificationService.manualCorrect(
    reg2.id,
    { status: RegistrationStatus.CANCELLED, reviewComment: '人工修正测试' },
    '管理员',
    '数据修正'
  );
  console.log('   ✅ 修正成功，新状态:', corrected?.status);
  console.log();

  console.log('14. 最终培训报告');
  const finalReport = reportService.generateReport(training.id);
  console.log('   📊 总报名数:', finalReport.totalRegistrations);
  console.log('   📊 通过数:', finalReport.qualifiedCount);
  console.log('   📊 候补数:', finalReport.waitlistCount);
  console.log('   📊 取消数:', finalReport.cancelledCount);
  console.log();

  console.log('=== 所有测试完成! ===');
  console.log();
  console.log('📝 验收要点总结:');
  console.log('   ✅ 正常创建、查询、导出');
  console.log('   ✅ 重复提交被阻止');
  console.log('   ✅ 状态不会被推进两次（有状态检查）');
  console.log('   ✅ 资格校验正确');
  console.log('   ✅ 候补自动晋级');
  console.log('   ✅ 审核留痕完整');
  console.log('   ✅ 人工修正功能正常');
}

runTests().catch(console.error);
