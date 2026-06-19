/**
 * 独立验证脚本 — 覆盖安装→启动→导入→上传→补录→保存→刷新→重算→报告→导出全链路
 * 专门验证本次修复的三大核心问题：
 *   1) 报告概览"待处理冲突"数字与清单条数严格一致
 *   2) 同一学生多版答案判断不写反，两版均保留、单版不混入
 *   3) 默认入口可直接启动（可通过 `npm run dev` 进入 CLI）
 *
 * 运行:
 *   npm run lint
 *   npm run test （内部已包含所有断言）
 *   npm run dev   （进入 CLI 交互入口，菜单内可选 12 运行演示）
 *   ts-node src/tests/verify-fixes.ts   (单独跑这个)
 */
import systemStore from '../store/systemStore';
import weightImportService from '../services/weightImportService';
import formulaScreenshotService from '../services/formulaScreenshotService';
import studentAnswerService from '../services/studentAnswerService';
import scoringEngine from '../services/scoringEngine';
import dataExportService from '../services/dataExportService';
import selfCheckService from '../services/selfCheckService';
import unifiedDataService from '../services/unifiedDataService';
import { ConflictStatus, AnswerReviewStatus } from '../types';

let failures = 0;

function assert(cond: any, label: string) {
  if (cond) {
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ ${label}`);
    failures++;
  }
}

const CSV = `criterionId,criterionName,weight,maxScore,formula
Q01,网络拓扑设计,0.3,100,score * weight
Q02,容量计算,0.4,100,score * weight * 1.1
Q03,路径优化,0.3,100,score * weight`;

const FORMULA = 'Q01: score * weight\nQ02: score * weight * 1.2\nQ03: score * weight';
const REMARKS = 'Q02: 系数调整为1.1后要保留两位小数；\nQ01: 注意拓扑图完整性要占此项30%权重，业务运营李老师确认；\nQ03: 如未写路径理由，一律扣5分';

function countPendingInReport(report: string): number {
  const section = report.match(/【待处理冲突清单】([\s\S]*?)\n\s*\n/)?.[1] || '';
  return (section.match(/  - \[/g) || []).length;
}

(async () => {
  console.log('\n═══ 独立验证脚本：网络流容量分配 ═══\n');

  // ======= 0. 安装 & 启动入口可访问性（代码层面） =======
  console.log('【0】默认入口 / 模块导出可用性');
  const mod = require('../index');
  assert(typeof mod.weightImportService !== 'undefined', '导出 weightImportService');
  assert(typeof mod.formulaScreenshotService !== 'undefined', '导出 formulaScreenshotService');
  assert(typeof mod.studentAnswerService !== 'undefined', '导出 studentAnswerService');
  assert(typeof mod.scoringEngine !== 'undefined', '导出 scoringEngine');
  assert(typeof mod.dataExportService !== 'undefined', '导出 dataExportService');
  assert(typeof mod.selfCheckService !== 'undefined', '导出 selfCheckService');
  assert(typeof mod.unifiedDataService !== 'undefined', '导出 unifiedDataService');

  // ======= 1. 导入权重 → 2. 上传截图+备注 → 产生 4 条冲突 =======
  console.log('\n【1-3】导入权重 + 上传旧公式截图备注 + 触发 4 条冲突');
  systemStore.clearAll();
  const step1 = weightImportService.importWeightTable(CSV, '验证者-A', '');
  const shot = formulaScreenshotService.uploadFormulaScreenshot(
    step1.batch.id, '/verify/old.png', '验证截图', FORMULA, '验证者-A', REMARKS, []
  );
  formulaScreenshotService.extractKeyNotesFromRemarks(shot.id, '验证者-A');
  formulaScreenshotService.setActiveScreenshot(shot.id, '验证者-A');
  formulaScreenshotService.reviewScreenshot(shot.id, '验证者-A', '可信');
  const reimported = weightImportService.importWeightTable(CSV, '验证者-A', '触发冲突');
  assert(reimported.conflicts.length === 4, `产生 4 条冲突（实际=${reimported.conflicts.length}）`);

  // ======= Bug 1 核心验证：概览数字 === 清单条数 =======
  console.log('\n【Bug 1 验证】报告概览待处理冲突数字与清单条数一致');
  const summary1 = unifiedDataService.getSummary();
  const report1 = dataExportService.generateReport('验证者-A');
  const inReport1 = countPendingInReport(report1);
  assert(
    summary1.allPendingConflictCount === 4,
    `概览 allPendingConflictCount=4（实际=${summary1.allPendingConflictCount}）`
  );
  assert(inReport1 === 4, `清单列出 4 条（实际=${inReport1}）`);
  assert(
    summary1.allPendingConflictCount === inReport1,
    `概览(${summary1.allPendingConflictCount}) === 清单(${inReport1})`
  );

  // ======= Bug 2 验证：多版答案判断 =======
  console.log('\n【Bug 2 验证】多版答案判断正确（不写反、不漏、不混入）');
  studentAnswerService.addStudentAnswer('S001', '李同学', 'SUB-S001', { Q01: 85, Q02: 90, Q03: 88 }, '验证者-A');
  studentAnswerService.addStudentAnswer('S002', '王同学', 'SUB-S002', { Q01: 92, Q02: 88, Q03: 95 }, '验证者-A');
  studentAnswerService.addStudentAnswer('S003', '赵同学', 'SUB-S003', { Q01: 78, Q02: 82, Q03: 80 }, '验证者-A');

  const groups0 = unifiedDataService.getDuplicateAnswerGroups();
  assert(groups0.length === 0, `仅单版答案时多版分组=0（实际=${groups0.length}）`);

  const dupAdd = studentAnswerService.addStudentAnswer(
    'S001', '李同学', 'SUB-S001-V2', { Q01: 88, Q02: 92, Q03: 90 }, '验证者-A'
  );
  assert(dupAdd.answer.reviewStatus === AnswerReviewStatus.PENDING_REVIEW, '补交答案状态=pending_review');

  const groups1 = unifiedDataService.getDuplicateAnswerGroups();
  assert(groups1.length === 1, `补交后多版分组=1（实际=${groups1.length}）`);
  assert(groups1[0].studentId === 'S001', `多版分组学生=S001（实际=${groups1[0].studentId}）`);
  assert(groups1[0].submissions.length === 2, `李同学保留 2 版（实际=${groups1[0].submissions.length}）`);
  assert(
    groups1[0].submissions.some(s => s.submissionId === 'SUB-S001'),
    '保留 V1 SUB-S001'
  );
  assert(
    groups1[0].submissions.some(s => s.submissionId === 'SUB-S001-V2'),
    '保留 V2 SUB-S001-V2'
  );

  const self = selfCheckService.runAllChecks();
  const dupCheck = self.find(c => c.checkName === '学生重复提交检测');
  assert(
    dupCheck && dupCheck.details.duplicateStudents.length === 1,
    `自检 duplicateStudents 长度=1（实际=${dupCheck?.details?.duplicateStudents?.length}）`
  );
  assert(
    dupCheck && dupCheck.details.duplicateStudents[0].studentId === 'S001',
    `自检 duplicateStudents 只含 S001（实际=${dupCheck?.details?.duplicateStudents?.[0]?.studentId}）`
  );
  const v = dupCheck?.details?.duplicateStudents?.[0]?.allVersions;
  assert(Array.isArray(v) && v.length === 2, `多版 allVersions 含 2 版完整信息（实际=${v?.length}）`);

  // ======= 4. 保存 / 复核 / 刷新 =======
  console.log('\n【4-6】保存、复核（业务运营）、刷新（重算）');
  const v2 = studentAnswerService.getAnswerBySubmissionId('SUB-S001-V2');
  if (v2) {
    studentAnswerService.reviewStudentAnswer(
      v2.id, AnswerReviewStatus.APPROVED, '业务运营', '确认 V2',
      '如需追溯 V1 查历史', '补交差异系笔误'
    );
  }
  const allPend = weightImportService.getPendingConflicts();
  for (const c of allPend) {
    weightImportService.resolveConflict(
      c.id, ConflictStatus.CONFIRMED, '业务运营', '确认',
      '已合入口径', '会议纪要决定', '后续按新口径'
    );
  }
  scoringEngine.calculateScores('验证者-A');
  const zhao = studentAnswerService.getAnswerBySubmissionId('SUB-S003');
  if (zhao) {
    studentAnswerService.correctStudentAnswers(
      zhao.id, { Q01: 78, Q02: 82, Q03: 85 },
      '人工复核补录', '验证者-A', '有疑问去教务处'
    );
  }
  scoringEngine.recalculateScore('SUB-S003', '补录后重算', '验证者-A');

  // ======= Bug 1 关键验证：全部处理完后概览=0 与清单=0 =======
  console.log('\n【Bug 1 关键证明】概览=0 时，清单绝对不能=4');
  const summaryFinal = unifiedDataService.getSummary();
  const reportFinal = dataExportService.generateReport('验证者-A');
  const inReportFinal = countPendingInReport(reportFinal);
  assert(
    summaryFinal.allPendingConflictCount === 0,
    `概览 allPendingConflictCount=0（实际=${summaryFinal.allPendingConflictCount}）`
  );
  assert(
    inReportFinal === 0,
    `清单列出 0 条（实际=${inReportFinal}）。若=4则是 BUG！`
  );
  assert(
    summaryFinal.allPendingConflictCount === inReportFinal,
    `概览(${summaryFinal.allPendingConflictCount}) === 清单(${inReportFinal})`
  );

  // ======= Bug 3 验证：四维一致性（列表/详情/API/导出） =======
  console.log('\n【展示/接口/导出同一份结果验证】');
  const ids = ['SUB-S001-V2', 'SUB-S002', 'SUB-S003'];
  const exp = dataExportService.exportScoringResults('验证者', { includePending: true });
  for (const id of ids) {
    const list = unifiedDataService.getUnifiedRecord(id);
    const api = dataExportService.getApiResponse(id);
    const row = exp.unifiedRecords.find(u => u.submissionId === id);
    assert(list && api?.data && row, `${id} 三个视图均存在`);
    assert(
      list!.totalScore === api?.data?.totalScore && api?.data?.totalScore === row?.totalScore,
      `${id} 列表/API/导出 totalScore 一致 (=${list?.totalScore})`
    );
    assert(
      list!.auditInfo.processingReason === api?.data?.auditInfo?.processingReason &&
      api?.data?.auditInfo?.processingReason === row?.auditInfo?.processingReason,
      `${id} processingReason 一致`
    );
    assert(
      list!.auditInfo.nextStepContact === api?.data?.auditInfo?.nextStepContact &&
      api?.data?.auditInfo?.nextStepContact === row?.auditInfo?.nextStepContact,
      `${id} nextStepContact 一致`
    );
  }

  // ======= 自检 =======
  console.log('\n【自检】');
  const allChecks = selfCheckService.runAllChecks();
  const chk = selfCheckService.getCheckSummary();
  console.log(`  总通过: ${chk.passedChecks}/${chk.totalChecks}`);
  const consistency = allChecks.find(c => c.checkName === '导出一致性检测');
  assert(consistency?.passed === true, '导出一致性检测通过');
  const unifiedOK = allChecks.find(c => c.checkName === '统一数据源一致性');
  assert(unifiedOK?.passed === true, '统一数据源一致性通过');
  const pendingOK = allChecks.find(c => c.checkName === '待处理冲突检测');
  assert(pendingOK?.passed === true, '待处理冲突检测通过（0 条待处理）');

  console.log('\n═══ 验证结束 ═══');
  if (failures > 0) {
    console.error(`\n✗ 共 ${failures} 个断言失败\n`);
    process.exit(1);
  } else {
    console.log('\n✓ 全部断言通过\n');
    process.exit(0);
  }
})();
