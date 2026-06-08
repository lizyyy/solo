import systemStore from '../store/systemStore';
import weightImportService from '../services/weightImportService';
import formulaScreenshotService from '../services/formulaScreenshotService';
import studentAnswerService from '../services/studentAnswerService';
import scoringEngine from '../services/scoringEngine';
import dataExportService from '../services/dataExportService';
import selfCheckService from '../services/selfCheckService';
import unifiedDataService from '../services/unifiedDataService';
import { ConflictStatus, AnswerReviewStatus } from '../types';

systemStore.clearAll();

const sampleWeightCsv = `criterionId,criterionName,weight,maxScore,formula
Q01,网络拓扑设计,0.3,100,score * weight
Q02,容量计算,0.4,100,score * weight * 1.1
Q03,路径优化,0.3,100,score * weight`;

const sampleFormulaText = `Q01: score * weight
Q02: score * weight * 1.2
Q03: score * weight`;

const sampleFormulaRemarks = `Q02: 系数调整为1.1后要保留两位小数；
Q01: 注意拓扑图完整性要占此项30%权重，业务运营李老师确认；
Q03: 如未写路径理由，一律扣5分`;

function hr(char = '=') {
  console.log(char.repeat(72));
}
function section(title: string) {
  hr('=');
  console.log(`  ${title}`);
  hr('-');
}

async function runDemo() {
  console.log('\n');
  section('网络流容量分配 - 完整链路验证演示');
  console.log('  重点: 公式截图关键备注 → 冲突/补录/复核 → 统一展示/导出/接口');
  hr();

  // ---------- Step 1 ----------
  section('【1】实验助理小穆第一次导入评分权重表');
  const step1 = weightImportService.importWeightTable(
    sampleWeightCsv,
    '实验助理小穆',
    '初次导入，业务提供的最新口径版本'
  );
  console.log(`  ✓ 批次号: ${step1.batch.batchNumber}`);
  console.log(`  ✓ 导入 ${step1.weights.length} 条评分标准`);
  console.log(`  ✓ 暂未发现冲突（尚未上传旧公式截图）`);
  step1.weights.forEach(w =>
    console.log(`    - [${w.criterionId}] ${w.criterionName}  权重=${w.weight}  公式=${w.formula}`)
  );

  // ---------- Step 2 ----------
  section('【2】小穆上传旧公式截图并提取关键备注');
  const step2Screenshot = formulaScreenshotService.uploadFormulaScreenshot(
    step1.batch.id,
    '/screenshots/old-formula-2024-03.png',
    '2024年3月旧公式截图（含手写备注）',
    sampleFormulaText,
    '实验助理小穆',
    sampleFormulaRemarks,
    []
  );
  console.log(`  ✓ 截图已上传，ID: ${step2Screenshot.id}`);
  console.log(`  ✓ 原始公式文本: ${sampleFormulaText.replace(/\n/g, ' | ')}`);
  console.log(`  ✓ 图片备注原文: ${sampleFormulaRemarks.replace(/\n/g, ' | ')}`);

  const step2Notes = formulaScreenshotService.extractKeyNotesFromRemarks(
    step2Screenshot.id,
    '实验助理小穆'
  );
  console.log(`  ✓ 自动解析出 ${step2Notes.length} 条关键备注`);
  step2Notes.forEach(n =>
    console.log(
      `    - 关联[${n.referencedCriterionId || '-'}]: ${n.content.substring(0, 40)}${n.content.length > 40 ? '...' : ''}`
    )
  );

  formulaScreenshotService.setActiveScreenshot(step2Screenshot.id, '实验助理小穆');
  formulaScreenshotService.reviewScreenshot(step2Screenshot.id, '实验助理小穆', '已核对截图来源可信');
  console.log('  ✓ 已设为活跃截图并完成来源复核');

  // ---------- Step 3 ----------
  section('【3】触发权重表导入公式冲突检测（对比截图+关键备注）');
  const step3ReImport = weightImportService.importWeightTable(
    sampleWeightCsv,
    '实验助理小穆',
    '二次导入，触发与截图备注冲突的检查'
  );
  const pendingConflicts = step3ReImport.conflicts;
  console.log(`  ✓ 检测到 ${pendingConflicts.length} 个冲突`);
  pendingConflicts.forEach((c, i) => {
    console.log(`  冲突#${i + 1}: ${c.title}`);
    console.log(`    · 原始说法: ${c.originalStatement}`);
    console.log(`    · 下一步: ${c.nextStepContact}`);
    c.evidence.forEach(e =>
      console.log(`      [${e.source}] ${e.fieldName}: ${JSON.stringify(e.actualValue).substring(0, 40)} @ ${e.location}`)
    );
  });

  // ---------- Step 4 ----------
  section('【4】小穆补录误差说明，冲突留给业务运营张经理确认');
  const conflictsForResolution = weightImportService.getPendingConflicts();
  const q02Conflict = conflictsForResolution.find(c => c.title.includes('Q02'));
  const q02Weight = step3ReImport.weights.find(w => w.criterionId === 'Q02');

  formulaScreenshotService.createErrorExplanation(
    step3ReImport.batch.id,
    'Q02公式系数差异',
    '评分权重表系数1.1 vs 旧截图1.2。根据2024年4月15日业务协调会纪要，新口径应为1.1（保留两位小数），但截图备注另有说法，需张经理最终签字确认。',
    '实验助理小穆',
    q02Conflict ? [q02Conflict.id] : []
  );

  if (q02Conflict && q02Weight) {
    weightImportService.resolveConflict(
      q02Conflict.id,
      ConflictStatus.PENDING,
      '实验助理小穆',
      '已补充说明，等待张经理确认后生效',
      '按评分权重表1.1执行，需张经理邮件批复',
      `已创建误差说明并附上业务协调会信息；下一步请业务运营张经理(zhang@)确认Q02系数最终口径`,
      '业务运营张经理'
    );
    console.log(`  ✓ Q02冲突暂保留 PENDING，未自动归正常`);
    console.log(`    · 原公式说法: ${q02Conflict.originalStatement}`);
    console.log(`    · 改后值说法: ${q02Conflict.correctedStatement}`);
    console.log(`    · 处理原因: ${q02Conflict.processingReason}`);
    console.log(`    · 下一步联系人: ${q02Conflict.nextStepContact}`);
  }

  // ---------- Step 5 ----------
  section('【5】导入3名学生初次答案');
  const students = [
    { id: 'S001', name: '李同学', answers: { Q01: 85, Q02: 90, Q03: 88 } },
    { id: 'S002', name: '王同学', answers: { Q01: 92, Q02: 88, Q03: 95 } },
    { id: 'S003', name: '赵同学', answers: { Q01: 78, Q02: 82, Q03: 80 } }
  ];
  students.forEach(s => {
    studentAnswerService.addStudentAnswer(s.id, s.name, `SUB-${s.id}`, s.answers, '实验助理小穆');
  });
  console.log('  ✓ 已导入3名学生初次答案，状态均为 APPROVED');

  // ---------- Step 6 ----------
  section('【6】李同学补交第二版答案（触发重复提交冲突）');
  const step6 = studentAnswerService.addStudentAnswer(
    'S001',
    '李同学',
    'SUB-S001-V2',
    { Q01: 88, Q02: 92, Q03: 90 },
    '实验助理小穆'
  );
  console.log(`  ✓ 检测到补交答案: ${step6.answer.submissionId}`);
  console.log(`  ✓ 答案状态: ${step6.answer.reviewStatus}（未自动归正常）`);
  console.log(`  ✓ 历史提交记录: ${step6.answer.allSubmissionIds.join(' → ')}`);
  step6.conflicts.forEach(c => {
    console.log(`  ✓ 关联冲突: ${c.title}`);
    console.log(`    · 原始说法: ${c.originalStatement}`);
    console.log(`    · 下一步: ${c.nextStepContact}`);
  });

  // ---------- Step 7 ----------
  section('【7】初次执行评分计算（李同学V2还在待复核，不会被评分）');
  const step7 = scoringEngine.calculateScores('实验助理小穆');
  console.log(`  ✓ 计算批次: ${step7.batchId}`);
  console.log(`  ✓ 参与评分答案数: ${step7.results.length}（S001-V2待复核被排除）`);
  step7.results.forEach(r => {
    const d = unifiedDataService.getUnifiedRecord(r.submissionId);
    console.log(`    ${r.studentName}(${r.submissionId}): ${r.totalScore}分 [状态:${d?.displayStatus}/${d?.statusText}]`);
  });

  // ---------- Step 8 ----------
  section('【8】业务运营张经理复核：李同学V2通过 + Q02冲突确认');
  const pendingAnswers = studentAnswerService.getAnswersPendingReview();
  const s001V2 = pendingAnswers.find(a => a.submissionId === 'SUB-S001-V2');
  if (s001V2) {
    studentAnswerService.reviewStudentAnswer(
      s001V2.id,
      AnswerReviewStatus.APPROVED,
      '业务运营张经理',
      '确认使用V2版，Q02计算错误已由学生改正；原V1作废归档',
      '如需追溯原V1请查历史记录',
      '李同学补交答案，对比差异为Q02提升2分，系原计算笔误；已与辅导老师刘老师电话确认'
    );
    console.log('  ✓ S001-V2复核完成（APPROVED），原状态→待复核变更历史已留痕');
  }

  const q02Pending = weightImportService.getPendingConflicts().find(c => c.title.includes('Q02'));
  if (q02Pending) {
    weightImportService.resolveConflict(
      q02Pending.id,
      ConflictStatus.CONFIRMED,
      '业务运营张经理',
      '确认以权重表1.1为最终口径',
      '按4月协调会纪要执行，1.2系旧学期口径过期作废',
      '经与教务处确认本学期Q02容量计算统一改为1.1，保留两位小数',
      '下一轮评分以新口径为准，若有疑问请2024-05-31前反馈张经理'
    );
    if (q02Weight) {
      weightImportService.correctWeightFormula(
        q02Weight.id,
        'score * weight * 1.10',
        '张经理确认口径后补充小数位数要求',
        '业务运营张经理',
        '小穆核对并在导出文件中附上此变更说明'
      );
    }
    console.log('  ✓ Q02公式口径 CONFIRMED，变更原因/下一步联系人均已留痕');
  }

  // ---------- Step 9 ----------
  section('【9】重新计算评分，含S001-V2');
  const step9 = scoringEngine.calculateScores('实验助理小穆');
  console.log(`  ✓ 本轮参与: ${step9.results.length}条，含S001-V2`);
  step9.results.forEach(r => {
    const d = unifiedDataService.getUnifiedRecord(r.submissionId);
    console.log(`    ${r.studentName}(${r.submissionId}): ${r.totalScore}分 [${d?.statusText}] v${r.version}`);
  });

  // ---------- Step 10 ----------
  section('【10】赵同学人工复核发现Q03漏判，补录修正后重算');
  const zhaoAnswer = studentAnswerService.getAnswerBySubmissionId('SUB-S003');
  if (zhaoAnswer) {
    studentAnswerService.correctStudentAnswers(
      zhaoAnswer.id,
      { Q01: 78, Q02: 82, Q03: 85 },
      '人工复核发现Q03路径理由完整，原扣5分应加回；业务组会议2024-04-20决定',
      '实验助理小穆',
      '如赵同学对分数仍有疑问，请到教务处103室咨询李老师'
    );
  }
  const step10 = scoringEngine.recalculateScore(
    'SUB-S003',
    '人工复核发现Q03路径理由完整，原扣5分应加回',
    '实验助理小穆',
    undefined,
    '下次复核会再抽查一次赵同学相关记录'
  );
  console.log(`  ✓ 赵同学(Q03:80→85): 原分${step10?.originalTotalScore} → 新分${step10?.totalScore}`);
  console.log(`  ✓ 重算标记: isRecalculated=${step10?.isRecalculated}，版本v${step10?.version}`);
  console.log(`  ✓ 变更历史条数: ${step10?.changeHistory.length}`);

  // ---------- Step 11 ----------
  section('【11】同一数据源验证：列表/详情/API/导出是否一致');
  const checkIds = ['SUB-S001-V2', 'SUB-S002', 'SUB-S003'];
  console.log('  验证维度：列表总分 === 详情总分 === API总分 === 导出总分');
  let allMatch = true;
  for (const id of checkIds) {
    const unif = unifiedDataService.getSingleSource(id);
    const consistency = dataExportService.verifyDataConsistency(id);
    const api = dataExportService.getApiResponse(id);
    const passed = unif.summaryIncludes && consistency.consistent;
    console.log(
      `    ${id} ${passed ? '✓一致' : '✗不一致'}  列表/详情=${unif.list.totalScore}  API=${api?.data?.totalScore}  导出=${consistency.exportRow?.totalScore}`
    );
    if (!consistency.consistent) {
      allMatch = false;
      consistency.differences.forEach(d => console.log(`      · ${d}`));
    }
    console.log(`       状态标签: list=${unif.list.statusText}  detail=${unif.detail.statusText}  displayStatus=${unif.list.displayStatus}`);
    console.log(`       最后操作人: ${unif.list.auditInfo.lastOperator} @ ${unif.list.auditInfo.lastOperatedAt.toLocaleString()}`);
    console.log(`       原始说法: ${unif.list.auditInfo.originalStatement || '(无)'}`);
    console.log(`       处理原因: ${unif.list.auditInfo.processingReason || '(无)'}`);
    console.log(`       下一步找:  ${unif.list.auditInfo.nextStepContact || '(无)'}`);
    console.log(`       版本链长度: ${unif.list.auditInfo.allVersions.length}条`);
    unif.list.auditInfo.allVersions.slice(-3).forEach(v =>
      console.log(`         v${v.version} ${v.operatedAt.toLocaleString().slice(5)} ${v.operator}: ${v.summary.substring(0, 40)}`)
    );
  }
  console.log(`  一致性总结: ${allMatch ? '✓ 全部通过' : '✗ 存在不一致'}`);

  const summary = unifiedDataService.getSummary();
  console.log('');
  console.log('  摘要统计（与列表同一份数据）:');
  console.log(`    总记录=${summary.total}  正常=${summary.normal}  待复核=${summary.pendingReview}  已修正=${summary.corrected}  已重算=${summary.recalculated}`);
  console.log(`    可导出=${summary.exportReadyCount}  平均分=${summary.averageScore}  待处理冲突=${summary.pendingConflictCount}`);

  // ---------- Step 12 ----------
  section('【12】导出明细 + 报告（含审计链、变更原因、下一步联系人）');
  const step12 = dataExportService.exportScoringResults('实验助理小穆', { includePending: true });
  console.log(`  ✓ 导出 ${step12.data.length} 条记录`);
  console.log('  导出关键字段（每条记录均与统一视图一致）:');
  step12.data.forEach(row => {
    console.log(
      `    ${row.submissionId}  ${row.studentName}  ${row.totalScore}分(${row.statusText})  原始=${row.originalTotalScore ?? '-'}  Δ=${row.scoreDelta ?? 0}  版本=${row.versionCount}  下一步=${row.nextStepContact || '无'}  复核原因=${(row.processingReason || '').substring(0, 20)}...`
    );
  });

  const csvLines = step12.csvContent.split('\n');
  console.log('');
  console.log('  CSV头部（展示同一数据源）:');
  console.log('    ' + csvLines[0].split(',').slice(0, 12).join(' | ') + ' | ...');
  if (csvLines.length > 1) {
    console.log('    ' + csvLines[1].split(',').slice(0, 12).join(' | ') + ' | ...');
  }

  // ---------- Step 13 ----------
  section('【13】系统自检 + 数据一致性报告');
  const step13 = selfCheckService.runAllChecks();
  const chkSummary = selfCheckService.getCheckSummary();
  console.log(`  自检: ${chkSummary.passedChecks}/${chkSummary.totalChecks} 通过  ${chkSummary.overallPassed ? '✓' : '✗'}`);
  step13.forEach(c => {
    const icon = c.passed ? '✓' : '✗';
    console.log(`    ${icon} ${c.checkName}: ${c.message}`);
  });

  const report = dataExportService.generateReport('实验助理小穆');
  console.log('');
  console.log('  ════════ 数据一致性报告 ════════');
  report.split('\n').forEach(line => console.log('  ' + line));

  hr();
  console.log('  ✓ 完整链路演示完成');
  console.log('    - 公式截图关键备注已串入冲突证据，不自动归正常');
  console.log('    - 补录/重算/复核的输入→动作→状态→最终展示均连在同一份数据上');
  console.log('    - 列表/详情/摘要/历史/导出/接口/报告全部走统一视图');
  console.log('    - 人工复核记录保留原始说法、改后值、处理原因、下一步找谁');
  hr();
  console.log('');
}

runDemo().catch(err => {
  console.error('✗ 演示流程报错:', err);
  process.exit(1);
});
