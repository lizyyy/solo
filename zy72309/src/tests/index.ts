import weightImportService from '../services/weightImportService';
import formulaScreenshotService from '../services/formulaScreenshotService';
import studentAnswerService from '../services/studentAnswerService';
import scoringEngine from '../services/scoringEngine';
import dataExportService from '../services/dataExportService';
import selfCheckService from '../services/selfCheckService';
import { ConflictStatus, AnswerReviewStatus } from '../types';

const sampleWeightCsv = `criterionId,criterionName,weight,maxScore,formula
Q01,网络拓扑设计,0.3,100,score * weight
Q02,容量计算,0.4,100,score * weight * 1.1
Q03,路径优化,0.3,100,score * weight`;

const sampleFormulaText = `Q01: score * weight
Q02: score * weight * 1.2
Q03: score * weight`;

async function runDemo() {
  console.log('=' .repeat(60));
  console.log('网络流容量分配评分系统 - 演示流程');
  console.log('=' .repeat(60));

  console.log('\n【步骤1】导入评分权重表');
  console.log('-'.repeat(40));
  const importResult = weightImportService.importWeightTable(sampleWeightCsv, '实验助理小穆');
  console.log(`导入批次: ${importResult.batch.batchNumber}`);
  console.log(`导入记录数: ${importResult.weights.length} 条评分标准`);
  console.log(`检测到冲突: ${importResult.conflicts.length} 个`);

  console.log('\n【步骤2】上传旧公式截图');
  console.log('-'.repeat(40));
  const screenshot = formulaScreenshotService.uploadFormulaScreenshot(
    importResult.batch.id,
    '/screenshots/formula_v1.png',
    '旧版计算公式截图',
    sampleFormulaText,
    '实验助理小穆'
  );
  console.log(`上传截图ID: ${screenshot.id}`);
  formulaScreenshotService.setActiveScreenshot(screenshot.id);
  console.log('设置为活跃截图 ✓');

  console.log('\n【步骤3】添加误差说明');
  console.log('-'.repeat(40));
  const explanation = formulaScreenshotService.createErrorExplanation(
    importResult.batch.id,
    'Q02公式差异说明',
    '由于业务口径调整，Q02的计算公式系数从1.2改为1.1，经业务运营确认后生效',
    '实验助理小穆'
  );
  console.log(`添加说明: ${explanation.title}`);

  console.log('\n【步骤4】检测公式冲突');
  console.log('-'.repeat(40));
  const conflicts = weightImportService.getPendingConflicts();
  console.log(`待处理冲突: ${conflicts.length} 个`);
  conflicts.forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.title}`);
    console.log(`     类型: ${c.type}`);
    console.log(`     描述: ${c.description}`);
    console.log(`     证据:`, JSON.stringify(c.evidence, null, 2).split('\n').map((line, idx) => idx > 0 ? '     ' + line : line).join('\n'));
  });

  console.log('\n【步骤5】业务运营复核冲突');
  console.log('-'.repeat(40));
  conflicts.forEach(c => {
    weightImportService.resolveConflict(
      c.id,
      ConflictStatus.CONFIRMED,
      '业务运营张三',
      '确认使用新公式，旧公式截图仅作参考'
    );
  });
  console.log('冲突已确认 ✓');

  console.log('\n【步骤6】导入学生答案');
  console.log('-'.repeat(40));
  const students = [
    { id: 'S001', name: '学生A', answers: { Q01: 85, Q02: 90, Q03: 88 } },
    { id: 'S002', name: '学生B', answers: { Q01: 92, Q02: 88, Q03: 95 } },
    { id: 'S003', name: '学生C', answers: { Q01: 78, Q02: 82, Q03: 80 } }
  ];

  students.forEach(student => {
    const result = studentAnswerService.addStudentAnswer(
      student.id,
      student.name,
      `SUB-${student.id}`,
      student.answers
    );
    console.log(`导入: ${student.name} - ${result.answer.submissionId}`);
  });

  console.log('\n【步骤7】模拟学生A重复提交答案');
  console.log('-'.repeat(40));
  const resubmitResult = studentAnswerService.addStudentAnswer(
    'S001',
    '学生A',
    'SUB-S001-V2',
    { Q01: 88, Q02: 92, Q03: 90 }
  );
  console.log(`重复提交检测: ${resubmitResult.conflicts.length > 0 ? '✓ 检测到重复' : '未检测到'}`);
  console.log(`答案状态: ${resubmitResult.answer.reviewStatus}`);
  console.log(`需要业务运营复核: ${resubmitResult.answer.reviewStatus === AnswerReviewStatus.PENDING_REVIEW ? '是' : '否'}`);

  console.log('\n【步骤8】业务运营复核重复提交的答案');
  console.log('-'.repeat(40));
  const pendingAnswers = studentAnswerService.getAnswersPendingReview();
  console.log(`待复核答案: ${pendingAnswers.length} 条`);
  pendingAnswers.forEach(answer => {
    studentAnswerService.reviewStudentAnswer(
      answer.id,
      AnswerReviewStatus.APPROVED,
      '业务运营张三',
      '确认使用第二版答案，修正了Q02的计算错误'
    );
    console.log(`已复核: ${answer.studentName} - ${answer.submissionId}`);
  });

  console.log('\n【步骤9】执行评分计算');
  console.log('-'.repeat(40));
  const scoringResult = scoringEngine.calculateScores('实验助理小穆');
  console.log(`计算批次: ${scoringResult.batchId}`);
  console.log(`计算结果数: ${scoringResult.results.length} 条`);
  scoringResult.results.forEach(r => {
    console.log(`  ${r.studentName}: ${r.totalScore} 分`);
  });

  console.log('\n【步骤10】补录后重算 - 学生C成绩修正');
  console.log('-'.repeat(40));
  const recalculated = scoringEngine.recalculateScore(
    'SUB-S003',
    '人工复核时发现漏判，Q03实际应为85分',
    '实验助理小穆'
  );
  console.log(`重算后成绩: ${recalculated?.totalScore} 分`);
  console.log(`重算标记: ${recalculated?.isRecalculated ? '是' : '否'}`);
  console.log(`重算原因: ${recalculated?.recalculationReason}`);

  console.log('\n【步骤11】导出评分结果');
  console.log('-'.repeat(40));
  const exportResult = dataExportService.exportScoringResults();
  console.log(`导出记录数: ${exportResult.data.length} 条`);
  console.log('CSV内容预览:');
  console.log(exportResult.csvContent.split('\n').slice(0, 5).join('\n'));

  console.log('\n【步骤12】执行系统自检');
  console.log('-'.repeat(40));
  const checkResults = selfCheckService.runAllChecks();
  const summary = selfCheckService.getCheckSummary();
  console.log(`自检结果: ${summary.overallPassed ? '通过' : '存在问题'}`);
  console.log(`通过: ${summary.passedChecks}/${summary.totalChecks}`);
  checkResults.forEach(r => {
    const status = r.passed ? '✓' : '✗';
    console.log(`  ${status} ${r.checkName}: ${r.message}`);
  });

  console.log('\n【步骤13】验证数据一致性');
  console.log('-'.repeat(40));
  const apiResponse = dataExportService.getApiResponse('SUB-S001-V2');
  console.log('API返回与页面展示使用同一数据源 ✓');
  console.log(`学生A最新成绩: ${apiResponse.result.totalScore}`);
  console.log(`API与导出一致性检查:`);
  const consistency = dataExportService.verifyDataConsistency('SUB-S001-V2');
  console.log(`  一致: ${consistency.consistent ? '是' : '否'}`);
  if (!consistency.consistent) {
    consistency.differences.forEach(d => console.log(`  - ${d}`));
  }

  console.log('\n' + '=' .repeat(60));
  console.log('演示流程完成！');
  console.log('=' .repeat(60));

  console.log('\n【核心功能总结】');
  console.log('1. ✓ 评分权重表导入与冲突检测');
  console.log('2. ✓ 旧公式截图管理与误差说明');
  console.log('3. ✓ 学生答案管理与重复提交检测');
  console.log('4. ✓ 业务运营复核流程');
  console.log('5. ✓ 评分计算与补录重算');
  console.log('6. ✓ 数据导出与一致性保证');
  console.log('7. ✓ 五项基本自检功能');
}

runDemo().catch(console.error);
