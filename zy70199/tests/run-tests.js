const EmployeeService = require('../src/services/employee.service');
const DocumentService = require('../src/services/document.service');
const RemediationService = require('../src/services/remediation.service');
const ContractService = require('../src/services/contract.service');
const AccountService = require('../src/services/account.service');
const SalaryService = require('../src/services/salary.service');
const ReportService = require('../src/services/report.service');
const { BackgroundJobService, jobExecutors } = require('../src/services/background-job.service');
const { EmployeeStatus, DocumentStatus, TaskStatus, JobStatus, models } = require('../src/models');
const logger = require('../src/utils/logger');

class TestRunner {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.results = [];
  }

  test(name, fn) {
    try {
      fn();
      this.passed++;
      this.results.push({ name, status: 'PASSED' });
      logger.info(`✓ ${name}`);
    } catch (error) {
      this.failed++;
      this.results.push({ name, status: 'FAILED', error: error.message });
      logger.error(`✗ ${name}: ${error.message}`);
    }
  }

  assertEqual(actual, expected, message = '') {
    if (actual !== expected) {
      throw new Error(`${message} Expected: ${expected}, Actual: ${actual}`);
    }
  }

  assertThrows(fn, expectedError, message = '') {
    try {
      fn();
      throw new Error(`${message} Expected to throw error but did not`);
    } catch (error) {
      if (error.message.includes('Expected to throw') || !error.message.includes(expectedError)) {
        throw error;
      }
    }
  }

  assertTrue(value, message = '') {
    if (!value) {
      throw new Error(`${message} Expected true but got ${value}`);
    }
  }

  assertFalse(value, message = '') {
    if (value) {
      throw new Error(`${message} Expected false but got ${value}`);
    }
  }

  summary() {
    logger.info('\n' + '='.repeat(50));
    logger.info(`测试结果: ${this.passed} passed, ${this.failed} failed`);
    logger.info('='.repeat(50));
    
    if (this.failed > 0) {
      logger.info('\n失败的测试:');
      this.results
        .filter(r => r.status === 'FAILED')
        .forEach(r => logger.error(`  - ${r.name}: ${r.error}`));
    }
    
    return this.failed === 0;
  }
}

function runAllTests() {
  logger.info('\n' + '='.repeat(50));
  logger.info('开始运行入职资料补齐服务测试');
  logger.info('='.repeat(50));
  
  const runner = new TestRunner();
  
  DocumentService.initializeCatalog();
  
  logger.info('\n----- 测试1: 员工创建和状态管理 -----');
  
  runner.test('创建新员工', () => {
    const emp = EmployeeService.create({
      name: '测试员工1',
      email: 'test1@example.com',
      department: '测试部',
      position: '测试工程师',
      hireDate: '2026-06-01'
    });
    
    runner.assertEqual(emp.name, '测试员工1');
    runner.assertEqual(emp.status, EmployeeStatus.PENDING_REVIEW);
  });
  
  runner.test('初始化员工资料', () => {
    const emp = EmployeeService.create({
      name: '测试员工2',
      email: 'test2@example.com',
      department: '测试部'
    });
    
    DocumentService.initializeEmployeeDocuments(emp.id);
    const docs = DocumentService.getEmployeeDocuments(emp.id);
    
    runner.assertTrue(docs.documents.length > 0, '应该初始化资料列表');
    runner.assertTrue(docs.summary.required > 0, '应该有待办必填资料');
  });
  
  runner.test('资料提交和审批', () => {
    const emp = EmployeeService.create({
      name: '测试员工3',
      email: 'test3@example.com',
      department: '测试部'
    });
    
    DocumentService.initializeEmployeeDocuments(emp.id);
    const docs = DocumentService.getEmployeeDocuments(emp.id);
    const firstDoc = docs.documents[0];
    
    DocumentService.submitDocument(emp.id, firstDoc.id, {
      fileUrl: 'https://example.com/test',
      content: '测试内容'
    });
    
    const afterSubmit = models.EmployeeDocument.findById(firstDoc.id);
    runner.assertEqual(afterSubmit.status, DocumentStatus.SUBMITTED);
    
    DocumentService.approveDocument(emp.id, firstDoc.id);
    const afterApprove = models.EmployeeDocument.findById(firstDoc.id);
    runner.assertEqual(afterApprove.status, DocumentStatus.APPROVED);
  });
  
  logger.info('\n----- 测试2: 异常拦截 -----');
  
  runner.test('资料缺失时无法生成合同', () => {
    const emp = EmployeeService.create({
      name: '测试员工4',
      email: 'test4@example.com',
      department: '测试部'
    });
    
    DocumentService.initializeEmployeeDocuments(emp.id);
    
    runner.assertThrows(() => {
      ContractService.generate(emp.id, { salary: 10000 });
    }, '员工状态为 PENDING_REVIEW', '资料不完整时应该拦截合同生成');
  });
  
  runner.test('缺少银行卡无法建立薪资', () => {
    const emp = EmployeeService.create({
      name: '测试员工5',
      email: 'test5@example.com',
      department: '测试部'
    });
    
    DocumentService.initializeEmployeeDocuments(emp.id);
    const docs = DocumentService.getEmployeeDocuments(emp.id);
    
    for (const doc of docs.documents) {
      if (doc.isRequired && doc.catalogCode !== 'BANK_CARD') {
        DocumentService.submitDocument(emp.id, doc.id, {
          content: '测试内容'
        });
        DocumentService.approveDocument(emp.id, doc.id);
      }
    }
    
    ContractService.generate(emp.id, { salary: 10000 });
    AccountService.create(emp.id, {});
    
    runner.assertThrows(() => {
      SalaryService.establish(emp.id, {});
    }, '银行卡信息尚未审批通过', '缺少银行卡时应该拦截薪资建档');
  });
  
  runner.test('未生成合同时无法创建账号', () => {
    const emp = EmployeeService.create({
      name: '测试员工6',
      email: 'test6@example.com',
      department: '测试部'
    });
    
    DocumentService.initializeEmployeeDocuments(emp.id);
    const docs = DocumentService.getEmployeeDocuments(emp.id);
    
    for (const doc of docs.documents) {
      if (doc.isRequired) {
        DocumentService.submitDocument(emp.id, doc.id, { content: '测试内容' });
        DocumentService.approveDocument(emp.id, doc.id);
      }
    }
    
    runner.assertThrows(() => {
      AccountService.create(emp.id, {});
    }, '员工状态为 DOCUMENTS_COMPLETE', '未生成合同时应该拦截账号创建');
  });
  
  logger.info('\n----- 测试3: 重复操作防护 -----');
  
  runner.test('已审批资料不能重复提交', () => {
    const emp = EmployeeService.create({
      name: '测试员工7',
      email: 'test7@example.com',
      department: '测试部'
    });
    
    DocumentService.initializeEmployeeDocuments(emp.id);
    const docs = DocumentService.getEmployeeDocuments(emp.id);
    const doc = docs.documents[0];
    
    DocumentService.submitDocument(emp.id, doc.id, { content: '第一次提交' });
    DocumentService.approveDocument(emp.id, doc.id);
    
    runner.assertThrows(() => {
      DocumentService.submitDocument(emp.id, doc.id, { content: '第二次提交' });
    }, '该资料已审批通过', '已审批资料应该阻止重复提交');
  });
  
  runner.test('同一资料不能有多个未完成的补齐任务', () => {
    const emp = EmployeeService.create({
      name: '测试员工8',
      email: 'test8@example.com',
      department: '测试部'
    });
    
    DocumentService.initializeEmployeeDocuments(emp.id);
    const docs = DocumentService.getEmployeeDocuments(emp.id);
    const doc = docs.documents[0];
    
    RemediationService.createTask(emp.id, doc.id, { reason: '测试任务' });
    
    runner.assertThrows(() => {
      RemediationService.createTask(emp.id, doc.id, { reason: '测试任务2' });
    }, '该资料已有未完成的补齐任务', '应该阻止重复创建任务');
  });
  
  logger.info('\n----- 测试4: 正常流程 -----');
  
  runner.test('完整入职流程', () => {
    const emp = EmployeeService.create({
      name: '测试员工9',
      email: 'test9@example.com',
      department: '测试部',
      position: '完整流程测试'
    });
    
    DocumentService.initializeEmployeeDocuments(emp.id);
    const docs = DocumentService.getEmployeeDocuments(emp.id);
    
    for (const doc of docs.documents) {
      if (doc.isRequired) {
        DocumentService.submitDocument(emp.id, doc.id, { content: `测试内容-${doc.name}` });
        DocumentService.approveDocument(emp.id, doc.id);
      }
    }
    
    let empAfterDocs = EmployeeService.getById(emp.id);
    runner.assertEqual(empAfterDocs.status, EmployeeStatus.DOCUMENTS_COMPLETE, '资料完成后状态应该更新');
    
    const contract = ContractService.generate(emp.id, {
      salary: 15000,
      startDate: '2026-06-01'
    });
    runner.assertTrue(contract.id, '应该生成合同');
    
    let empAfterContract = EmployeeService.getById(emp.id);
    runner.assertEqual(empAfterContract.status, EmployeeStatus.CONTRACT_GENERATED);
    
    const account = AccountService.create(emp.id, { username: 'test9' });
    runner.assertTrue(account.id, '应该创建账号');
    
    let empAfterAccount = EmployeeService.getById(emp.id);
    runner.assertEqual(empAfterAccount.status, EmployeeStatus.ACCOUNT_CREATED);
    
    const salary = SalaryService.establish(emp.id, {
      baseSalary: 15000,
      bankName: '测试银行',
      bankAccount: '1234567890'
    });
    runner.assertTrue(salary.id, '应该建立薪资档案');
    
    let empAfterSalary = EmployeeService.getById(emp.id);
    runner.assertEqual(empAfterSalary.status, EmployeeStatus.SALARY_ESTABLISHED);
    
    const validation = ReportService.validateOnboardingFlow(emp.id);
    runner.assertTrue(validation.valid, '完整流程应该通过验证');
  });
  
  logger.info('\n----- 测试5: 人工修正和历史记录 -----');
  
  runner.test('人工状态修正记录历史', () => {
    const emp = EmployeeService.create({
      name: '测试员工10',
      email: 'test10@example.com',
      department: '测试部'
    });
    
    EmployeeService.manuallyCorrectStatus(
      emp.id,
      EmployeeStatus.CONTRACT_GENERATED,
      '测试人工修正原因需要足够长'
    );
    
    const history = ReportService.getHistoryReport(emp.id);
    runner.assertTrue(history.statusHistory.length >= 1, '应该有状态变更记录');
    
    const manualChange = history.statusHistory.find(h => 
      h.reason.includes('人工') || h.reason.includes('MANUAL')
    );
    runner.assertTrue(manualChange, '应该有人工修正记录');
  });
  
  runner.test('人工修正后报表验证显示警告', () => {
    const emp = EmployeeService.create({
      name: '测试员工11',
      email: 'test11@example.com',
      department: '测试部'
    });
    
    EmployeeService.manuallyCorrectStatus(
      emp.id,
      EmployeeStatus.DOCUMENTS_COMPLETE,
      '测试人工修正原因需要足够长'
    );
    
    const validation = ReportService.validateOnboardingFlow(emp.id);
    runner.assertTrue(validation.warnings.length > 0, '人工修正应该有警告');
    runner.assertTrue(
      validation.warnings.some(w => w.includes('人工')),
      '警告应该提及人工修正'
    );
  });
  
  logger.info('\n----- 测试6: 后台任务 -----');
  
  runner.test('创建后台任务', () => {
    const job = BackgroundJobService.createJob('NOTIFY_REMEDIATION', {
      employeeName: '测试',
      documentName: '身份证'
    });
    
    runner.assertEqual(job.status, JobStatus.PENDING);
    runner.assertEqual(job.jobType, 'NOTIFY_REMEDIATION');
  });
  
  runner.test('执行成功的后台任务', () => {
    const job = BackgroundJobService.createJob('CHECK_DOCUMENT_COMPLETION', {
      employeeId: 'test-emp-id'
    });
    
    const result = BackgroundJobService.executeJob(job.id, jobExecutors['CHECK_DOCUMENT_COMPLETION']);
    runner.assertEqual(result.status, 'SUCCESS');
    
    const updatedJob = BackgroundJobService.getJob(job.id);
    runner.assertEqual(updatedJob.status, JobStatus.SUCCESS);
    runner.assertEqual(updatedJob.attempts, 1);
  });
  
  runner.test('失败的任务会重试', () => {
    const job = BackgroundJobService.createJob('SEND_REMINDER', {
      recipient: 'test@example.com',
      shouldFail: true
    });
    
    const result1 = BackgroundJobService.executeJob(job.id, jobExecutors['SEND_REMINDER']);
    runner.assertEqual(result1.status, 'FAILED_WILL_RETRY', '第一次失败应该可以重试');
    
    const jobAfter1 = BackgroundJobService.getJob(job.id);
    runner.assertEqual(jobAfter1.status, JobStatus.RETRYING);
    runner.assertEqual(jobAfter1.attempts, 1);
  });
  
  runner.test('超过最大重试次数后任务失败', () => {
    const job = BackgroundJobService.createJob('SEND_REMINDER', {
      recipient: 'test@example.com',
      shouldFail: true
    }, { maxAttempts: 2 });
    
    BackgroundJobService.executeJob(job.id, jobExecutors['SEND_REMINDER']);
    const result2 = BackgroundJobService.executeJob(job.id, jobExecutors['SEND_REMINDER']);
    
    runner.assertEqual(result2.status, 'FAILED_PERMANENTLY', '超过重试次数应该永久失败');
    
    const finalJob = BackgroundJobService.getJob(job.id);
    runner.assertEqual(finalJob.status, JobStatus.FAILED);
    runner.assertEqual(finalJob.attempts, 2);
  });
  
  runner.test('可以强制重试已失败的任务', () => {
    const job = BackgroundJobService.createJob('SEND_REMINDER', {
      recipient: 'test@example.com',
      shouldFail: true
    }, { maxAttempts: 1 });
    
    BackgroundJobService.executeJob(job.id, jobExecutors['SEND_REMINDER']);
    
    const retryResult = BackgroundJobService.retryJob(job.id);
    runner.assertEqual(retryResult.status, 'RESET_FOR_RETRY', '应该可以强制重试');
    
    const resetJob = BackgroundJobService.getJob(job.id);
    runner.assertEqual(resetJob.status, JobStatus.PENDING);
    runner.assertEqual(resetJob.attempts, 0);
  });
  
  logger.info('\n----- 测试7: 补齐任务 -----');
  
  runner.test('创建补齐任务时状态自动更新', () => {
    const emp = EmployeeService.create({
      name: '测试员工12',
      email: 'test12@example.com',
      department: '测试部'
    });
    
    DocumentService.initializeEmployeeDocuments(emp.id);
    const docs = DocumentService.getEmployeeDocuments(emp.id);
    const doc = docs.documents.find(d => d.isRequired);
    
    RemediationService.createTask(emp.id, doc.id, { reason: '需要补充资料' });
    
    const updatedEmp = EmployeeService.getById(emp.id);
    runner.assertEqual(updatedEmp.status, EmployeeStatus.DOCUMENTS_INCOMPLETE);
    
    const tasks = RemediationService.getEmployeeTasks(emp.id);
    runner.assertTrue(tasks.length >= 1);
    runner.assertEqual(tasks[0].status, TaskStatus.OPEN);
  });
  
  runner.test('自动检查缺失资料并创建任务', () => {
    const emp = EmployeeService.create({
      name: '测试员工13',
      email: 'test13@example.com',
      department: '测试部'
    });
    
    DocumentService.initializeEmployeeDocuments(emp.id);
    
    const result = RemediationService.checkAndCreateTasksForMissingDocuments(emp.id);
    runner.assertTrue(result.created.length > 0, '应该创建补齐任务');
  });
  
  logger.info('\n----- 测试8: 报表验证 -----');
  
  runner.test('入职仪表盘统计正确', () => {
    const emp = EmployeeService.create({
      name: '测试员工14',
      email: 'test14@example.com',
      department: '测试部'
    });
    
    DocumentService.initializeEmployeeDocuments(emp.id);
    const docs = DocumentService.getEmployeeDocuments(emp.id);
    
    for (const doc of docs.documents) {
      if (doc.isRequired) {
        DocumentService.submitDocument(emp.id, doc.id, { content: '测试' });
        DocumentService.approveDocument(emp.id, doc.id);
      }
    }
    
    ContractService.generate(emp.id, { salary: 10000 });
    AccountService.create(emp.id, {});
    SalaryService.establish(emp.id, { baseSalary: 10000, bankName: '测试银行', bankAccount: '123' });
    
    const dashboard = ReportService.getOnboardingDashboard();
    runner.assertTrue(dashboard.completionStats.withContracts >= 1);
    runner.assertTrue(dashboard.completionStats.withAccounts >= 1);
    runner.assertTrue(dashboard.completionStats.withSalary >= 1);
  });
  
  const success = runner.summary();
  process.exit(success ? 0 : 1);
}

runAllTests();
