const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const dayjs = require('dayjs');

require('../src/config/database');
const {
  Employee,
  ProbationPlan,
  PerformanceEvaluation,
  MentorFeedback,
  SalaryAdjustment,
  ExtensionRequest,
  ProbationHistory
} = require('../src/models');

const ProbationRuleEngine = require('../src/services/probationRuleEngine');
const ProbationService = require('../src/services/probationService');
const ReportService = require('../src/services/reportService');
const {
  ProbationStatus,
  EvaluationStatus,
  MentorFeedbackStatus,
  SalaryAdjustmentStatus,
  RuleCheckResult
} = require('../src/constants');

class TestRunner {
  constructor() {
    this.results = [];
    this.passed = 0;
    this.failed = 0;
  }

  async test(name, fn) {
    console.log(`\n=== 测试: ${name} ===`);
    try {
      await fn();
      console.log(`✓ 通过: ${name}`);
      this.results.push({ name, status: 'passed' });
      this.passed++;
    } catch (error) {
      console.log(`✗ 失败: ${name}`);
      console.log(`  错误: ${error.message}`);
      this.results.push({ name, status: 'failed', error: error.message });
      this.failed++;
    }
  }

  assert(condition, message) {
    if (!condition) {
      throw new Error(message);
    }
  }

  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`${message}: 期望 ${expected}, 实际 ${actual}`);
    }
  }

  summary() {
    console.log('\n\n=== 测试总结 ===');
    console.log(`总测试数: ${this.results.length}`);
    console.log(`通过: ${this.passed}`);
    console.log(`失败: ${this.failed}`);
    
    if (this.failed > 0) {
      console.log('\n失败的测试:');
      this.results.filter(r => r.status === 'failed').forEach(r => {
        console.log(`  - ${r.name}: ${r.error}`);
      });
    }
    
    return this.failed === 0;
  }
}

async function runTests() {
  console.log('开始测试试用期转正 API 系统...\n');

  const runner = new TestRunner();

  try {
    console.log('同步数据库模型...');
    await require('../src/config/database').sync({ force: true });
    console.log('数据库模型同步完成\n');

    let employee, mentor, hrManager, probationPlan;

    await runner.test('创建测试员工', async () => {
      employee = await Employee.create({
        employeeNo: 'EMP001',
        name: '张三',
        email: 'zhangsan@example.com',
        department: '技术部',
        position: '高级工程师',
        hireDate: dayjs().subtract(3, 'month').format('YYYY-MM-DD'),
        baseSalary: 15000,
        currentSalary: 15000,
        isActive: true
      });

      mentor = await Employee.create({
        employeeNo: 'EMP002',
        name: '李四（导师）',
        email: 'lisi@example.com',
        department: '技术部',
        position: '技术总监',
        hireDate: dayjs().subtract(2, 'year').format('YYYY-MM-DD'),
        baseSalary: 30000,
        currentSalary: 30000,
        isActive: true
      });

      hrManager = await Employee.create({
        employeeNo: 'EMP003',
        name: '王五（HR）',
        email: 'wangwu@example.com',
        department: '人力资源部',
        position: 'HR经理',
        hireDate: dayjs().subtract(1, 'year').format('YYYY-MM-DD'),
        baseSalary: 20000,
        currentSalary: 20000,
        isActive: true
      });

      runner.assert(employee.id, '员工ID应该存在');
      runner.assertEqual(employee.currentSalary, 15000, '初始薪资');
    });

    await runner.test('创建试用期计划', async () => {
      probationPlan = await ProbationService.createProbationPlan({
        employeeId: employee.id,
        mentorId: mentor.id,
        startDate: dayjs().subtract(3, 'month').format('YYYY-MM-DD'),
        durationMonths: 3,
        goals: '熟悉公司业务，完成项目交付',
        requirements: '通过技术考核，达到团队协作要求',
        notes: '新员工试用期计划'
      }, hrManager.id);

      runner.assertEqual(probationPlan.status, ProbationStatus.PENDING, '初始状态');
      runner.assertEqual(probationPlan.extensionCount, 0, '延期次数');
    });

    await runner.test('启动试用期', async () => {
      const plan = await ProbationService.startProbation(probationPlan.id, hrManager.id);
      runner.assertEqual(plan.status, ProbationStatus.IN_PROGRESS, '启动后状态');

      const history = await ProbationHistory.findAll({
        where: { probationPlanId: plan.id }
      });
      runner.assert(history.length >= 1, '应该有历史记录');
    });

    await runner.test('规则引擎：绩效分数检查', async () => {
      const passResult = ProbationRuleEngine.checkPerformanceScore(3.5);
      runner.assertEqual(passResult.checkResult, RuleCheckResult.PASS, '3.5分应该通过');
      runner.assertEqual(passResult.rule, 'MIN_PERFORMANCE_SCORE', '规则名称');

      const failResult = ProbationRuleEngine.checkPerformanceScore(2.5);
      runner.assertEqual(failResult.checkResult, RuleCheckResult.FAIL, '2.5分应该失败');
    });

    await runner.test('规则引擎：导师评分检查', async () => {
      const passResult = ProbationRuleEngine.checkMentorFeedbackScore(4.0);
      runner.assertEqual(passResult.checkResult, RuleCheckResult.PASS, '4.0分应该通过');

      const failResult = ProbationRuleEngine.checkMentorFeedbackScore(2.0);
      runner.assertEqual(failResult.checkResult, RuleCheckResult.FAIL, '2.0分应该失败');
    });

    await runner.test('规则引擎：延期规则检查', async () => {
      const passResults = ProbationRuleEngine.checkExtensionRules(0, 2);
      const allPass = passResults.every(r => r.checkResult === RuleCheckResult.PASS);
      runner.assert(allPass, '0次延期、2个月应该通过');

      const failResults1 = ProbationRuleEngine.checkExtensionRules(1, 1);
      const hasFail = failResults1.some(r => r.checkResult === RuleCheckResult.FAIL);
      runner.assert(hasFail, '已延期1次应该失败');

      const failResults2 = ProbationRuleEngine.checkExtensionRules(0, 4);
      const hasFail2 = failResults2.some(r => r.checkResult === RuleCheckResult.FAIL);
      runner.assert(hasFail2, '延期4个月应该失败');
    });

    await runner.test('规则引擎：状态转换验证', async () => {
      const valid = ProbationRuleEngine.isValidStatusTransition(
        ProbationStatus.IN_PROGRESS,
        ProbationStatus.AWAITING_EVALUATION
      );
      runner.assert(valid, '有效状态转换应该允许');

      const invalid = ProbationRuleEngine.isValidStatusTransition(
        ProbationStatus.CONFIRMED,
        ProbationStatus.IN_PROGRESS
      );
      runner.assert(!invalid, '无效状态转换应该拒绝');
    });

    await runner.test('提交绩效评价', async () => {
      const evaluation = await ProbationService.submitPerformanceEvaluation({
        probationPlanId: probationPlan.id,
        evaluatorId: hrManager.id,
        overallScore: 4.2,
        workQualityScore: 4.5,
        workEfficiencyScore: 4.0,
        collaborationScore: 4.3,
        learningAbilityScore: 4.0,
        comments: '表现优秀，工作质量高',
        strengths: '学习能力强，团队协作好',
        areasForImprovement: '可以更主动地沟通'
      }, hrManager.id);

      runner.assertEqual(evaluation.status, EvaluationStatus.SUBMITTED, '评价状态');
      runner.assertEqual(parseFloat(evaluation.overallScore), 4.2, '评价分数');
    });

    await runner.test('批准绩效评价', async () => {
      const evaluations = await PerformanceEvaluation.findAll({
        where: { probationPlanId: probationPlan.id }
      });
      runner.assert(evaluations.length > 0, '应该有绩效评价');

      const approved = await ProbationService.approvePerformanceEvaluation(
        evaluations[0].id,
        hrManager.id
      );

      runner.assertEqual(approved.status, EvaluationStatus.APPROVED, '批准后状态');
    });

    await runner.test('提交导师意见', async () => {
      const feedback = await ProbationService.submitMentorFeedback({
        probationPlanId: probationPlan.id,
        overallScore: 4.5,
        skillProgressScore: 4.3,
        attitudeScore: 4.8,
        teamworkScore: 4.2,
        goalsAchieved: '已完成所有目标，学习进度良好',
        challengesFaced: '初期对业务不太熟悉，后来很快适应',
        suggestions: '继续保持学习态度',
        recommendation: 'confirm',
        additionalComments: '强烈建议转正'
      }, mentor.id);

      runner.assertEqual(feedback.status, MentorFeedbackStatus.SUBMITTED, '导师意见状态');
      runner.assertEqual(feedback.recommendation, 'confirm', '导师建议');
    });

    await runner.test('检查评价完成状态', async () => {
      const plan = await ProbationPlan.findByPk(probationPlan.id);
      
      runner.assertEqual(
        plan.status,
        ProbationStatus.EVALUATION_COMPLETED,
        '评价完成后状态应该是 evaluation_completed'
      );
    });

    await runner.test('提交转正审批（触发规则检查）', async () => {
      const result = await ProbationService.submitForApproval(
        probationPlan.id,
        hrManager.id
      );

      runner.assertEqual(result.plan.status, ProbationStatus.AWAITING_APPROVAL, '提交审批后状态');
      runner.assertEqual(result.ruleCheck.overallResult, RuleCheckResult.PASS, '规则检查应该通过');
      runner.assert(!result.shouldReview, '不应该需要人工复核');
    });

    await runner.test('批准转正（含薪资调整）', async () => {
      const result = await ProbationService.approveProbation(
        probationPlan.id,
        hrManager.id,
        {
          newSalary: 18000,
          effectiveDate: dayjs().format('YYYY-MM-DD'),
          reason: '试用期表现优秀，薪资调整'
        }
      );

      runner.assertEqual(result.plan.status, ProbationStatus.CONFIRMED, '转正后状态');
      runner.assert(result.salaryAdjustment, '应该创建薪资调整记录');
      runner.assertEqual(parseFloat(result.salaryAdjustment.newSalary), 18000, '新薪资');
    });

    await runner.test('验证薪资调整记录', async () => {
      const adjustments = await SalaryAdjustment.findAll({
        where: { probationPlanId: probationPlan.id }
      });

      runner.assert(adjustments.length > 0, '应该有薪资调整记录');
      runner.assertEqual(
        adjustments[0].status,
        SalaryAdjustmentStatus.APPROVED,
        '薪资调整状态'
      );
    });

    await runner.test('验证转正历史记录', async () => {
      const history = await ProbationHistory.findAll({
        where: { probationPlanId: probationPlan.id },
        order: [['timestamp', 'ASC']]
      });

      runner.assert(history.length >= 5, '应该有足够的历史记录');

      const actions = history.map(h => h.action);
      runner.assert(actions.includes('PLAN_CREATED'), '应该包含计划创建');
      runner.assert(actions.includes('STATUS_CHANGE'), '应该包含状态变更');
      runner.assert(actions.includes('EVALUATION_SUBMITTED'), '应该包含评价提交');
      runner.assert(actions.includes('MENTOR_FEEDBACK_SUBMITTED'), '应该包含导师意见提交');
      runner.assert(actions.includes('RULE_CHECK'), '应该包含规则检查');
    });

    await runner.test('创建第二个测试场景：绩效不达标需要人工复核', async () => {
      const employee2 = await Employee.create({
        employeeNo: 'EMP004',
        name: '赵六',
        email: 'zhaoliu@example.com',
        department: '技术部',
        position: '中级工程师',
        hireDate: dayjs().subtract(3, 'month').format('YYYY-MM-DD'),
        baseSalary: 12000,
        currentSalary: 12000,
        isActive: true
      });

      const plan2 = await ProbationService.createProbationPlan({
        employeeId: employee2.id,
        mentorId: mentor.id,
        startDate: dayjs().subtract(3, 'month').format('YYYY-MM-DD'),
        durationMonths: 3,
        goals: '完成基础任务',
        requirements: '达到基本要求'
      }, hrManager.id);

      await ProbationService.startProbation(plan2.id, hrManager.id);

      await ProbationService.submitPerformanceEvaluation({
        probationPlanId: plan2.id,
        evaluatorId: hrManager.id,
        overallScore: 2.5,
        workQualityScore: 2.0,
        workEfficiencyScore: 3.0,
        collaborationScore: 2.5,
        learningAbilityScore: 2.5,
        comments: '表现有待提高',
        strengths: '态度认真',
        areasForImprovement: '工作质量和效率需要提升'
      }, hrManager.id);

      const evaluations = await PerformanceEvaluation.findAll({
        where: { probationPlanId: plan2.id }
      });
      await ProbationService.approvePerformanceEvaluation(evaluations[0].id, hrManager.id);

      await ProbationService.submitMentorFeedback({
        probationPlanId: plan2.id,
        overallScore: 2.8,
        skillProgressScore: 2.5,
        attitudeScore: 3.5,
        teamworkScore: 2.5,
        goalsAchieved: '部分完成',
        challengesFaced: '技术能力需要提升',
        suggestions: '建议延期观察',
        recommendation: 'extend',
        additionalComments: '态度很好，但能力需要更多时间提升'
      }, mentor.id);

      const result = await ProbationService.submitForApproval(plan2.id, hrManager.id);

      runner.assertEqual(result.ruleCheck.overallResult, RuleCheckResult.FAIL, '规则检查应该失败');
      runner.assert(result.shouldReview, '应该需要人工复核');
      runner.assertEqual(
        result.ruleCheck.recommendedAction,
        'consider_extension',
        '建议应该是考虑延期'
      );
    });

    await runner.test('测试延期流程', async () => {
      const employee3 = await Employee.create({
        employeeNo: 'EMP005',
        name: '孙七',
        email: 'sunqi@example.com',
        department: '产品部',
        position: '产品经理',
        hireDate: dayjs().subtract(2, 'month').format('YYYY-MM-DD'),
        baseSalary: 18000,
        currentSalary: 18000,
        isActive: true
      });

      const plan3 = await ProbationService.createProbationPlan({
        employeeId: employee3.id,
        mentorId: mentor.id,
        startDate: dayjs().subtract(2, 'month').format('YYYY-MM-DD'),
        durationMonths: 3,
        goals: '熟悉产品流程',
        requirements: '完成产品文档'
      }, hrManager.id);

      await ProbationService.startProbation(plan3.id, hrManager.id);

      const canExtend = ProbationRuleEngine.canRequestExtension(plan3);
      runner.assert(canExtend.canRequest, '应该可以申请延期');

      const extensionResult = await ProbationService.requestExtension({
        probationPlanId: plan3.id,
        extensionMonths: 1,
        reason: '业务复杂度超出预期，需要更多时间熟悉',
        improvementPlan: '1. 深入了解业务流程 2. 加强与技术团队沟通'
      }, hrManager.id);

      runner.assert(extensionResult.request.id, '应该创建延期申请');
      runner.assertEqual(extensionResult.request.extensionMonths, 1, '延期月数');

      const planAfterRequest = await ProbationPlan.findByPk(plan3.id);
      runner.assertEqual(
        planAfterRequest.status,
        ProbationStatus.EXTENSION_REQUESTED,
        '申请后状态'
      );

      const approveResult = await ProbationService.approveExtension(
        extensionResult.request.id,
        hrManager.id,
        '导师同意延期，观察后续表现'
      );

      runner.assertEqual(
        approveResult.plan.status,
        ProbationStatus.IN_PROGRESS,
        '批准后恢复进行中'
      );
      runner.assertEqual(approveResult.plan.extensionCount, 1, '延期次数加1');
    });

    await runner.test('验证超过延期次数限制', async () => {
      const employee4 = await Employee.create({
        employeeNo: 'EMP006',
        name: '周八',
        email: 'zhouba@example.com',
        department: '设计部',
        position: 'UI设计师',
        hireDate: dayjs().subtract(3, 'month').format('YYYY-MM-DD'),
        baseSalary: 15000,
        currentSalary: 15000,
        isActive: true
      });

      const plan4 = await ProbationPlan.create({
        employeeId: employee4.id,
        mentorId: mentor.id,
        startDate: dayjs().subtract(3, 'month').format('YYYY-MM-DD'),
        durationMonths: 3,
        goals: '完成设计任务',
        requirements: '达到设计标准'
      }, hrManager.id);

      plan4.extensionCount = 1;
      await plan4.save();

      let errorThrown = false;
      try {
        await ProbationService.requestExtension({
          probationPlanId: plan4.id,
          extensionMonths: 1,
          reason: '还需要更多时间'
        }, hrManager.id);
      } catch (error) {
        errorThrown = true;
        runner.assert(error.message.includes('延期'), '错误信息应该提到延期');
      }

      runner.assert(errorThrown, '超过延期次数应该抛出错误');
    });

    await runner.test('HR 报表：仪表盘', async () => {
      const dashboard = await ReportService.getProbationDashboard();

      runner.assert(dashboard.summary.total > 0, '应该有试用期计划');
      runner.assert(dashboard.summary.confirmed > 0, '应该有已转正的');
      runner.assert(typeof dashboard.statistics.confirmationRate === 'string', '转正率应该是字符串');
    });

    await runner.test('HR 报表：待处理评审', async () => {
      const report = await ReportService.getPendingReviewsReport();

      runner.assert(Array.isArray(report.needsManualReview), '应该有需要复核的列表');
    });

    await runner.test('HR 报表：转正历史', async () => {
      const report = await ReportService.getConfirmationHistoryReport();

      runner.assert(report.summary.total > 0, '应该有已完成的试用期');
      runner.assert(report.history.length > 0, '应该有历史记录');

      const confirmedRecord = report.history.find(h => h.status === 'confirmed');
      runner.assert(confirmedRecord, '应该有已转正的记录');
      runner.assert(confirmedRecord.performanceScore !== null, '应该有绩效分数');
      runner.assert(confirmedRecord.mentorScore !== null, '应该有导师评分');
      runner.assert(confirmedRecord.salaryAdjustment, '应该有薪资调整信息');
    });

    await runner.test('HR 报表：系统规则', async () => {
      const rules = ReportService.getSystemRules();

      runner.assert(rules.performance, '应该有绩效规则');
      runner.assertEqual(rules.performance.minScore, 3.0, '绩效最低分');
      runner.assert(rules.extension, '应该有延期规则');
      runner.assertEqual(rules.extension.maxCount, 1, '最大延期次数');
      runner.assertEqual(rules.extension.maxMonths, 3, '最大延期月数');
      runner.assert(rules.statusTransitions, '应该有状态转换图');
    });

    await runner.test('审计追踪：试用期历史', async () => {
      const trail = await ReportService.getProbationAuditTrail(probationPlan.id);

      runner.assert(trail.totalRecords > 0, '应该有审计记录');
      runner.assert(Array.isArray(trail.auditTrail), '审计追踪应该是数组');

      const statusChanges = trail.auditTrail.filter(h => h.action === 'STATUS_CHANGE');
      runner.assert(statusChanges.length > 0, '应该有状态变更记录');
    });

    await runner.test('规则引擎：完整的转正就绪评估', async () => {
      const plan = await ProbationPlan.findByPk(probationPlan.id, {
        include: ['evaluations', 'mentorFeedbacks']
      });

      const assessment = ProbationRuleEngine.evaluateProbationReadiness(
        plan,
        plan.evaluations,
        plan.mentorFeedbacks
      );

      runner.assertEqual(assessment.overallResult, RuleCheckResult.PASS, '评估结果');
      runner.assertEqual(assessment.passCount, 2, '通过的规则数');
      runner.assertEqual(assessment.failCount, 0, '失败的规则数');
      runner.assert(assessment.timestamp, '应该有时间戳');
    });

    const allPassed = runner.summary();
    
    console.log('\n\n=== 测试完成 ===');
    if (allPassed) {
      console.log('所有测试通过！ ✓');
      process.exit(0);
    } else {
      console.log('部分测试失败，请检查错误信息');
      process.exit(1);
    }

  } catch (error) {
    console.error('测试执行失败:', error);
    process.exit(1);
  }
}

runTests();
