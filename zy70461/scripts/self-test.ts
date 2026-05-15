import { db } from '../src/utils/database';
import { SubmissionService } from '../src/services/SubmissionService';
import { RuleEngineService } from '../src/services/RuleEngineService';
import { ReportService } from '../src/services/ReportService';
import { SubmissionDAO } from '../src/models/SubmissionDAO';
import { RuleVersionDAO } from '../src/models/RuleVersionDAO';
import { DependencyChangeDAO } from '../src/models/DependencyChangeDAO';
import { BatchActionType, SubmissionStatus } from '../src/models/types';

function initTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS rule_versions (
      id TEXT PRIMARY KEY,
      version TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      rules JSON NOT NULL,
      effective_from DATETIME NOT NULL,
      effective_to DATETIME,
      is_active BOOLEAN NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      student_name TEXT NOT NULL,
      course_code TEXT NOT NULL,
      course_name TEXT NOT NULL,
      content TEXT NOT NULL,
      attachments JSON NOT NULL,
      rule_version_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      summary TEXT,
      conclusion TEXT,
      processing_time INTEGER,
      processed_at DATETIME,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rule_version_id) REFERENCES rule_versions(id)
    );

    CREATE TABLE IF NOT EXISTS history_records (
      id TEXT PRIMARY KEY,
      submission_id TEXT NOT NULL,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      change_reason TEXT NOT NULL,
      source_system TEXT NOT NULL,
      changed_by TEXT NOT NULL,
      changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS dependency_changes (
      id TEXT PRIMARY KEY,
      dependency_name TEXT NOT NULL,
      old_version TEXT NOT NULL,
      new_version TEXT NOT NULL,
      change_reason TEXT NOT NULL,
      requester TEXT NOT NULL,
      approver TEXT,
      requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      approved_at DATETIME,
      status TEXT NOT NULL DEFAULT 'pending',
      both_confirmed BOOLEAN NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS process_reports (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      before_stats JSON NOT NULL,
      after_stats JSON NOT NULL,
      execution_time INTEGER NOT NULL,
      processed_count INTEGER NOT NULL,
      next_suggestions JSON NOT NULL,
      rule_version_used TEXT NOT NULL,
      generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

function printHeader(title: string) {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${title}`);
  console.log('='.repeat(60));
}

function printResult(result: TestResult) {
  const status = result.passed ? '✓ 通过' : '✗ 失败';
  console.log(`  ${status.padEnd(10)} ${result.name}`);
  if (result.error) {
    console.log(`           错误: ${result.error}`);
  }
  console.log(`           耗时: ${result.duration}ms`);
}

async function runTest(name: string, testFn: () => Promise<void>): Promise<TestResult> {
  const startTime = Date.now();
  try {
    await testFn();
    return { name, passed: true, duration: Date.now() - startTime };
  } catch (error: any) {
    return { name, passed: false, error: error.message, duration: Date.now() - startTime };
  }
}

async function runSelfTests() {
  const allResults: TestResult[] = [];

  printHeader('初始化测试数据库');
  
  initTables();
  
  db.exec(`DELETE FROM history_records`);
  db.exec(`DELETE FROM process_reports`);
  db.exec(`DELETE FROM submissions`);
  db.exec(`DELETE FROM dependency_changes`);
  db.exec(`DELETE FROM rule_versions`);
  console.log('  ✓ 数据库表已初始化并清理');

  const initResult = await runTest('初始化数据库规则', async () => {
    RuleEngineService.createNewRuleVersion(
      'v1.0-test',
      '测试规则版本',
      '用于自测的规则',
      {
        attachmentValidDays: 30,
        requireStudentId: true,
        requireCourseCode: true,
        minPageCount: 1,
        maxFileSizeMB: 10,
        allowedFileTypes: ['.pdf', '.doc', '.docx', '.txt'],
        customChecks: []
      },
      new Date(),
      'test-runner'
    );
  });
  allResults.push(initResult);
  printResult(initResult);

  printHeader('核心功能测试 - 正常提交');

  const normalSubmission = await runTest('创建正常提交', async () => {
    const submission = SubmissionService.createSubmission({
      batchId: 'BATCH-001',
      studentId: 'STU-001',
      studentName: '张三',
      courseCode: 'CS-101',
      courseName: '计算机基础',
      content: '这是一份完整的手写课程练习作业，内容详实...',
      attachments: [{ name: 'homework.pdf', type: 'application/pdf', size: 1024 * 500 }]
    }, 'test-user');
    
    if (!submission.id) throw new Error('提交ID为空');
    if (submission.status !== 'pending') throw new Error('状态不正确');
  });
  allResults.push(normalSubmission);
  printResult(normalSubmission);

  const expiredSubmission = await runTest('创建含过期附件的提交', async () => {
    const submission = SubmissionService.createSubmissionWithExpiredAttachment({
      batchId: 'BATCH-001',
      studentId: 'STU-002',
      studentName: '李四',
      courseCode: 'CS-101',
      courseName: '计算机基础',
      content: '这是另一份作业',
      attachments: [{ name: 'expired.pdf', type: 'application/pdf', size: 1024 * 100 }]
    }, 'test-user');
    
    const hasExpired = submission.attachments.some(a => a.isExpired);
    if (!hasExpired) throw new Error('附件应该已过期');
  });
  allResults.push(expiredSubmission);
  printResult(expiredSubmission);

  const addMoreSubmissions = await runTest('批量创建更多提交', async () => {
    for (let i = 3; i <= 5; i++) {
      SubmissionService.createSubmission({
        batchId: 'BATCH-001',
        studentId: `STU-00${i}`,
        studentName: `学生${i}`,
        courseCode: 'CS-101',
        courseName: '计算机基础',
        content: '作业内容...',
        attachments: [{ name: `hw${i}.pdf`, type: 'application/pdf', size: 1024 * 100 }]
      }, 'test-user');
    }
  });
  allResults.push(addMoreSubmissions);
  printResult(addMoreSubmissions);

  printHeader('核心功能测试 - 规则引擎');

  const processNormal = await runTest('处理正常提交', async () => {
    const submissions = SubmissionDAO.getByBatchId('BATCH-001');
    const normalSub = submissions.find(s => !s.attachments.some(a => a.isExpired));
    if (!normalSub) throw new Error('未找到正常提交');
    
    const processed = await SubmissionService.processSubmission(normalSub.id, 'test-user');
    
    if (processed.status !== SubmissionStatus.APPROVED) {
      throw new Error(`处理后状态应该是approved，实际为${processed.status}`);
    }
    if (!processed.processedAt) throw new Error('处理时间未记录');
  });
  allResults.push(processNormal);
  printResult(processNormal);

  const processExpired = await runTest('处理含过期附件的提交', async () => {
    const submissions = SubmissionDAO.getByBatchId('BATCH-001');
    const expiredSub = submissions.find(s => s.attachments.some(a => a.isExpired));
    if (!expiredSub) throw new Error('未找到含过期附件的提交');
    
    const processed = await SubmissionService.processSubmission(expiredSub.id, 'test-user');
    
    if (processed.status !== SubmissionStatus.ATTACHMENT_EXPIRED) {
      throw new Error(`处理后状态应该是attachment_expired，实际为${processed.status}`);
    }
  });
  allResults.push(processExpired);
  printResult(processExpired);

  printHeader('核心功能测试 - 批量操作预览');

  const previewApprove = await runTest('预览批量通过操作', async () => {
    const preview = SubmissionService.previewBatchAction('BATCH-001', BatchActionType.APPROVE);
    if (preview.affectedCount === 0) throw new Error('应该有受影响的提交');
    if (preview.estimatedTime <= 0) throw new Error('应该有预估时间');
  });
  allResults.push(previewApprove);
  printResult(previewApprove);

  const previewReprocess = await runTest('预览批量重新处理', async () => {
    const preview = SubmissionService.previewBatchAction('BATCH-001', BatchActionType.REPROCESS);
    if (preview.sampleSubmissions.length === 0) throw new Error('应该有示例提交');
    if (!preview.warnings) throw new Error('应该包含警告信息');
  });
  allResults.push(previewReprocess);
  printResult(previewReprocess);

  printHeader('核心功能测试 - 规则版本管理');

  const getActiveRule = await runTest('获取当前生效规则', async () => {
    const rule = RuleVersionDAO.getActiveRule();
    if (!rule) throw new Error('未找到生效规则');
    if (!rule.rules.attachmentValidDays) throw new Error('规则配置不完整');
  });
  allResults.push(getActiveRule);
  printResult(getActiveRule);

  const createNewRule = await runTest('创建新规则版本', async () => {
    const newRule = RuleEngineService.createNewRuleVersion(
      'v2.0',
      '新规则版本',
      '更新了附件有效期',
      {
        attachmentValidDays: 60,
        requireStudentId: true,
        requireCourseCode: true,
        minPageCount: 2,
        maxFileSizeMB: 20,
        allowedFileTypes: ['.pdf', '.doc', '.docx'],
        customChecks: []
      },
      new Date(),
      'admin'
    );
    
    if (!newRule.id) throw new Error('新规则ID为空');
    if (newRule.rules.attachmentValidDays !== 60) throw new Error('规则未正确更新');
  });
  allResults.push(createNewRule);
  printResult(createNewRule);

  const verifyOldRuleExists = await runTest('验证旧规则仍然可查询', async () => {
    const allRules = RuleVersionDAO.getAll();
    if (allRules.length < 2) throw new Error('应该至少有两个规则版本');
  });
  allResults.push(verifyOldRuleExists);
  printResult(verifyOldRuleExists);

  printHeader('核心功能测试 - 历史追踪');

  const updateField = await runTest('更新字段并记录历史', async () => {
    const submissions = SubmissionDAO.getByBatchId('BATCH-001');
    const submission = submissions[0];
    
    SubmissionService.updateSubmissionField(
      submission.id,
      'courseName',
      submission.courseName,
      '计算机科学基础',
      '课程名称更正',
      'admin-system',
      'admin-user'
    );
  });
  allResults.push(updateField);
  printResult(updateField);

  const checkHistory = await runTest('验证历史记录存在', async () => {
    const submissions = SubmissionDAO.getByBatchId('BATCH-001');
    const submission = submissions[0];
    
    const result = SubmissionService.getSubmissionWithHistory(submission.id);
    if (result.history.length === 0) throw new Error('历史记录为空');
  });
  allResults.push(checkHistory);
  printResult(checkHistory);

  const simulateCertificateChange = await runTest('模拟证书签发单变更', async () => {
    const submissions = SubmissionDAO.getByBatchId('BATCH-001');
    const submission = submissions[0];
    
    SubmissionService.updateSubmissionField(
      submission.id,
      'summary',
      submission.summary || '',
      '证书已签发：CERT-2024-001',
      '证书签发完成',
      'certificate-system',
      'cert-admin'
    );
  });
  allResults.push(simulateCertificateChange);
  printResult(simulateCertificateChange);

  printHeader('核心功能测试 - 依赖变更确认');

  const createDependencyChange = await runTest('创建依赖变更申请', async () => {
    const change = DependencyChangeDAO.create({
      dependencyName: 'better-sqlite3',
      oldVersion: '8.0.0',
      newVersion: '9.4.0',
      changeReason: '安全更新和性能改进',
      requester: 'dev-ops',
      status: 'pending'
    });
    
    if (!change.id) throw new Error('变更ID为空');
    if (change.bothConfirmed) throw new Error('初始状态应该未确认');
  });
  allResults.push(createDependencyChange);
  printResult(createDependencyChange);

  const approveDependencyChange = await runTest('审批依赖变更', async () => {
    const pending = DependencyChangeDAO.getAll('pending');
    if (pending.length === 0) throw new Error('没有待审批的变更');
    
    const approved = DependencyChangeDAO.approve(pending[0].id, 'tech-lead');
    if (!approved?.bothConfirmed) throw new Error('审批后应该已双方确认');
    if (approved.status !== 'approved') throw new Error('状态应该为approved');
  });
  allResults.push(approveDependencyChange);
  printResult(approveDependencyChange);

  printHeader('核心功能测试 - 报告生成');

  const generateReport = await runTest('生成批次处理报告', async () => {
    const report = await ReportService.generateBatchReport('BATCH-001', 'test-runner');
    
    if (!report.id) throw new Error('报告ID为空');
    if (report.beforeStats.total === 0) throw new Error('处理前统计为空');
    if (report.afterStats.total === 0) throw new Error('处理后统计为空');
    if (report.executionTime <= 0) throw new Error('执行时间未记录');
    if (report.nextSuggestions.length === 0) throw new Error('应该有下一步建议');
  });
  allResults.push(generateReport);
  printResult(generateReport);

  const formatReport = await runTest('格式化报告输出', async () => {
    const reports = ReportService.getAllReports();
    if (reports.length === 0) throw new Error('没有报告');
    
    const formatted = ReportService.formatReport(reports[0]);
    if (!formatted.includes('处理前后对比')) throw new Error('报告格式不正确');
    if (!formatted.includes('下一步建议')) throw new Error('报告格式不正确');
  });
  allResults.push(formatReport);
  printResult(formatReport);

  printHeader('边界情况测试 - 数据持久化验证');

  const verifyDataPersistence = await runTest('验证数据持久化', async () => {
    const submissions = SubmissionDAO.getAll();
    if (submissions.length === 0) throw new Error('提交数据丢失');
    
    const rules = RuleVersionDAO.getAll();
    if (rules.length === 0) throw new Error('规则数据丢失');
    
    const reports = ReportService.getAllReports();
    if (reports.length === 0) throw new Error('报告数据丢失');
  });
  allResults.push(verifyDataPersistence);
  printResult(verifyDataPersistence);

  const getBatchStats = await runTest('获取批次统计', async () => {
    const stats = SubmissionService.getBatchStats('BATCH-001');
    if (stats.total === 0) throw new Error('批次统计为空');
    if (!stats.hasOwnProperty('approved')) throw new Error('统计字段不完整');
  });
  allResults.push(getBatchStats);
  printResult(getBatchStats);

  printHeader('测试结果汇总');
  
  const passed = allResults.filter(r => r.passed).length;
  const total = allResults.length;
  const failed = total - passed;
  const totalDuration = allResults.reduce((sum, r) => sum + r.duration, 0);

  console.log(`\n  总测试数: ${total}`);
  console.log(`  通过: ${passed} ✓`);
  console.log(`  失败: ${failed} ✗`);
  console.log(`  通过率: ${((passed / total) * 100).toFixed(2)}%`);
  console.log(`  总耗时: ${totalDuration}ms\n`);

  if (failed > 0) {
    console.log('  失败的测试:');
    allResults.filter(r => !r.passed).forEach(r => {
      console.log(`    - ${r.name}: ${r.error}`);
    });
    console.log('');
    process.exit(1);
  } else {
    console.log('  所有测试通过！✓\n');
    process.exit(0);
  }
}

runSelfTests().catch(error => {
  console.error('测试运行失败:', error);
  process.exit(1);
});
