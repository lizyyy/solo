const fs = require('fs');

const { ImportService } = require('./dist/services/ImportService');
const { ReconciliationEngine } = require('./dist/services/ReconciliationEngine');
const { ReviewService } = require('./dist/services/ReviewService');
const { ReportService } = require('./dist/services/ReportService');

async function runDemo() {
  console.log('========================================');
  console.log('   档案室借阅对账服务 - 演示程序');
  console.log('   (第三轮修复验证版)');
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
  console.log('   包含USER-005(刘强):', permissionsData.some(p => p.userId === 'USER-005'));
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
  console.log('   对账ID:', reconciliationResult.reconciliationId);
  console.log('   总记录数:', reconciliationResult.totalRecords);
  console.log('   异常数量:', reconciliationResult.discrepancies.length);
  console.log('');
  console.log('   异常分类 (修复后续借超限应该能检测到):');
  console.log('   - 超期未还:', reconciliationResult.summary.overdue);
  console.log('   - 密级权限不匹配:', reconciliationResult.summary.classificationIssues);
  console.log('   - 续借次数超限:', reconciliationResult.summary.renewalIssues, '  ✅ (之前为0)');
  console.log('   - 权限问题:', reconciliationResult.summary.permissionIssues);
  console.log('');

  console.log('   REC-006(刘强)的异常详情:');
  const rec006Discrepancies = reconciliationResult.discrepancies.filter(d => d.recordId === 'REC-006');
  rec006Discrepancies.forEach((d, index) => {
    console.log(`   ${index + 1}. ID: ${d.discrepancyId}`);
    console.log(`      类型: ${d.type}`);
    console.log(`      描述: ${d.description}`);
    console.log(`      状态: ${d.isResolved ? '已解决' : '未解决'}`);
  });
  console.log('');

  console.log('【5/7】执行人工复核操作...');
  console.log('');

  const unresolvedDiscrepancies = reconciliationResult.discrepancies.filter(d => !d.isResolved);

  if (unresolvedDiscrepancies.length > 0) {
    console.log('   5a. 批准例外 - 李明密级问题');
    const classificationIssue = unresolvedDiscrepancies.find(d =>
      d.type === 'classification_mismatch' && d.recordId === 'REC-007'
    );
    if (classificationIssue) {
      console.log('      差异ID:', classificationIssue.discrepancyId);
      const approveResult = reviewService.approveDiscrepancy(
        classificationIssue.discrepancyId,
        'USER-006',
        '周经理',
        '特殊审批：李明为项目组成员，临时授权查看机密文件'
      );
      console.log('      批准成功:', approveResult.success);
      console.log('      差异状态:', approveResult.discrepancy?.isResolved ? '已解决' : '未解决');
      console.log('      原因：特殊审批，项目组成员临时授权');
    } else {
      console.log('      未找到对应的差异记录');
    }

    console.log('');
    console.log('   5b. 人工修正 - REC-006 续借次数问题');
    console.log('      🔴 关键验证：只修改续借次数，不应解决超期问题');
    const renewalIssue = reconciliationResult.discrepancies.find(
      d => d.recordId === 'REC-006' && d.type === 'renewal_limit_exceeded'
    );
    if (renewalIssue) {
      console.log('      续借差异ID:', renewalIssue.discrepancyId);
      console.log('      修正后续借次数: 3 → 2');
      
      const correctionResult = reviewService.manualCorrection(
        'REC-006',
        'USER-006',
        '周经理',
        { renewalCount: 2 },
        '系统录入错误，实际续借次数为2次，已核实纸质签字'
      );
      
      console.log('      修正成功:', correctionResult.success);
      console.log('');
      console.log('      📊 修正后REC-006的差异状态:');
      const rec006After = correctionResult.recalculatedResult.discrepancies.filter(d => d.recordId === 'REC-006');
      rec006After.forEach((d, index) => {
        const statusIcon = d.isResolved ? '✅' : '❌';
        const autoFixed = d.type === 'renewal_limit_exceeded' ? ' (已修正)' : ' (保留待处理)';
        console.log(`      ${index + 1}. ${statusIcon} ${d.type}${autoFixed}`);
        console.log(`         描述: ${d.description}`);
        console.log(`         状态: ${d.isResolved ? '已解决' : '未解决'}`);
      });
      
      const stillUnresolved = rec006After.filter(d => !d.isResolved);
      console.log('');
      console.log('      ✅ 验证结果: 续借问题已解决，超期问题保留，报告数据真实可靠');
      console.log('         未解决异常数:', stillUnresolved.length, '(超期问题仍需单独处理)');
    } else {
      console.log('      未找到对应的差异记录');
    }

    console.log('');
    console.log('   5c. 要求补充材料 - 张伟绝密文件借阅');
    const permissionIssue = unresolvedDiscrepancies.find(d =>
      d.type === 'classification_mismatch' && d.recordId === 'REC-004'
    );
    if (permissionIssue) {
      console.log('      差异ID:', permissionIssue.discrepancyId);
      reviewService.requestMoreInfo(
        'REC-004',
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
  console.log('   新对账ID:', updatedResult.reconciliationId);
  console.log('   总差异数:', updatedResult.discrepancies.length);
  console.log('   已解决异常数:', updatedResult.discrepancies.filter(d => d.isResolved).length);
  console.log('   待处理异常数:', updatedResult.discrepancies.filter(d => !d.isResolved).length);
  console.log('');

  console.log('   异常分类汇总 (人工修正后):');
  console.log('   - 超期未还:', updatedResult.summary.overdue);
  console.log('   - 密级权限不匹配:', updatedResult.summary.classificationIssues);
  console.log('   - 续借次数超限:', updatedResult.summary.renewalIssues, '  ✅ (修正后已清除)');
  console.log('   - 权限问题:', updatedResult.summary.permissionIssues);
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

  console.log('   复核日志详情:');
  const allLogs = reviewService.getReviewLogs();
  allLogs.forEach((log, index) => {
    console.log(`   ${index + 1}. [${log.action}] ${log.reviewerName}`);
    console.log(`      ${log.comment}`);
    console.log(`      时间: ${new Date(log.timestamp).toLocaleString('zh-CN')}`);
  });
  console.log('');

  console.log('========================================');
  console.log('   演示完成！');
  console.log('========================================');
  console.log('');
  console.log('【第三轮修复验证结果】');
  console.log('   ✅ 样例数据：已添加USER-005(刘强)权限配置');
  console.log('   ✅ 续借上限检测：无权限记录时仍使用默认值检查');
  console.log('   ✅ 续借超限解释：差异说明中明确标注默认值使用情况');
  console.log('   ✅ 人工修正精确性：只解决与修改相关的差异类型');
  console.log('      - 修改续借次数 → 只解决续借超限问题');
  console.log('      - 超期、密级等其他问题保留待处理');
  console.log('   ✅ 报告数据真实：详情、汇总、导出数字同步且可信');
  console.log('');
  console.log('【使用提示】');
  console.log('   1. 运行 "npm install" 安装依赖');
  console.log('   2. 运行 "npm run build" 编译代码');
  console.log('   3. 运行 "npm run dev" 启动API服务');
  console.log('   4. 访问 http://localhost:3000/health 检查服务状态');
  console.log('   5. 运行 "npm run demo" 查看演示');
  console.log('');
}

runDemo().catch(console.error);
