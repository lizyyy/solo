const fs = require('fs');
const path = require('path');

const { ImportService } = require('./dist/services/ImportService');
const { ReconciliationEngine } = require('./dist/services/ReconciliationEngine');
const { ReviewService } = require('./dist/services/ReviewService');
const { ReportService } = require('./dist/services/ReportService');

async function runDemo() {
  console.log('========================================');
  console.log('   档案室借阅对账服务 - 演示程序');
  console.log('========================================');
  console.log('');

  const importService = new ImportService();
  const engine = new ReconciliationEngine();
  const reviewService = new ReviewService(engine);
  const reportService = new ReportService(engine, reviewService);

  console.log('【1/7】读取样例数据...');
  const casesData = JSON.parse(fs.readFileSync('./sample-data/cases.json', 'utf-8'));
  const permissionsData = JSON.parse(fs.readFileSync('./sample-data/permissions.json', 'utf-8'));

  console.log('   案件数量:', casesData.length);
  console.log('   人员权限数量:', permissionsData.length);
  console.log('');

  console.log('【2/7】导入CSV借阅记录...');
  const csvResult = await importService.importBorrowRecordsFromCSV('./sample-data/borrow-records.csv');
  console.log('   成功导入:', csvResult.validCount, '条');
  console.log('   错误数量:', csvResult.errors.length);
  if (csvResult.errors.length > 0) {
    csvResult.errors.forEach(err => console.log('   -', err));
  }
  console.log('');

  console.log('【3/7】加载数据到对账引擎...');
  engine.loadData(casesData, csvResult.data, permissionsData);
  console.log('   加载完成');
  console.log('');

  console.log('【4/7】执行自动对账...');
  const reconciliationResult = engine.runReconciliation();
  console.log('   总记录数:', reconciliationResult.totalRecords);
  console.log('   异常数量:', reconciliationResult.discrepancies.length);
  console.log('');
  console.log('   异常分类:');
  console.log('   - 超期未还:', reconciliationResult.summary.overdue);
  console.log('   - 密级权限不匹配:', reconciliationResult.summary.classificationIssues);
  console.log('   - 续借次数超限:', reconciliationResult.summary.renewalIssues);
  console.log('   - 权限问题:', reconciliationResult.summary.permissionIssues);
  console.log('');

  console.log('   异常详情:');
  reconciliationResult.discrepancies.forEach((d, index) => {
    console.log(`   ${index + 1}. [${d.severity.toUpperCase()}] ${d.description}`);
    console.log(`      说明: ${d.explanation.substring(0, 80)}...`);
  });
  console.log('');

  console.log('【5/7】执行人工复核操作...');
  console.log('');

  const unresolvedDiscrepancies = reconciliationResult.discrepancies.filter(d => !d.isResolved);

  if (unresolvedDiscrepancies.length > 0) {
    console.log('   5a. 批准例外 - CASE-003 密级问题');
    const classificationIssue = unresolvedDiscrepancies.find(d => d.type === 'classification_mismatch');
    if (classificationIssue) {
      reviewService.approveDiscrepancy(
        classificationIssue.discrepancyId,
        'USER-006',
        '周经理',
        '特殊审批：李明为项目组成员，临时授权查看机密文件'
      );
      console.log('      已批准，原因：特殊审批，项目组成员临时授权');
    }

    console.log('');
    console.log('   5b. 人工修正 - REC-006 续借次数问题');
    const renewalIssue = reconciliationResult.discrepancies.find(d => d.recordId === 'REC-006');
    if (renewalIssue) {
      reviewService.manualCorrection(
        'REC-006',
        'USER-006',
        '周经理',
        { renewalCount: 2 },
        '系统录入错误，实际续借次数为2次，已核实纸质签字'
      );
      console.log('      已修正：续借次数从3次改为2次');
      console.log('      原因：系统录入错误，已核实纸质签字');
    }

    console.log('');
    console.log('   5c. 要求补充材料 - REC-004 绝密文件借阅');
    const permissionIssue = unresolvedDiscrepancies.find(d => d.type === 'permission_denied');
    if (permissionIssue) {
      reviewService.requestMoreInfo(
        permissionIssue.recordId,
        'USER-006',
        '周经理',
        '请补充绝密文件借阅审批单和保密协议签署证明'
      );
      console.log('      已要求补充材料：绝密文件借阅审批单和保密协议');
    }
  }
  console.log('');

  console.log('【6/7】重新计算对账结果...');
  const updatedResult = reviewService.recalculateReconciliation();
  console.log('   已解决异常数:', updatedResult.discrepancies.filter(d => d.isResolved).length);
  console.log('   待处理异常数:', updatedResult.discrepancies.filter(d => !d.isResolved).length);
  console.log('');

  console.log('【7/7】生成对账报告...');
  const reportData = reportService.generateReportData();
  console.log('   报告生成时间:', reportData.generatedAt);
  console.log('   统计周期:', reportData.period.start, '至', reportData.period.end);
  console.log('');
  console.log('   报告摘要:');
  console.log('   - 总借阅数:', reportData.summary.totalBorrowed);
  console.log('   - 已归还:', reportData.summary.returned);
  console.log('   - 超期未还:', reportData.summary.overdue);
  console.log('   - 待复核:', reportData.summary.pendingReview);
  console.log('');

  console.log('   复核记录摘要:');
  const reviewSummary = reviewService.getReviewSummary();
  console.log('   - 总复核记录:', reviewSummary.totalReviewed);
  console.log('   - 批准例外:', reviewSummary.approved);
  console.log('   - 退回借阅:', reviewSummary.rejected);
  console.log('   - 需补材料:', reviewSummary.needsInfo);
  console.log('   - 人工修正:', reviewSummary.manualCorrections);
  console.log('');

  console.log('========================================');
  console.log('   演示完成！');
  console.log('========================================');
  console.log('');
  console.log('【使用提示】');
  console.log('   1. 运行 "npm install" 安装依赖');
  console.log('   2. 运行 "npm run build" 编译代码');
  console.log('   3. 运行 "npm run dev" 启动API服务');
  console.log('   4. 访问 http://localhost:3000/health 检查服务状态');
  console.log('   5. 运行 "node demo.js" 查看演示');
  console.log('');
}

runDemo().catch(console.error);
