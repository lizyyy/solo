import weightImportService from './services/weightImportService';
import formulaScreenshotService from './services/formulaScreenshotService';
import studentAnswerService from './services/studentAnswerService';
import scoringEngine from './services/scoringEngine';
import dataExportService from './services/dataExportService';
import selfCheckService from './services/selfCheckService';
import unifiedDataService from './services/unifiedDataService';
import {
  ConflictStatus,
  AnswerReviewStatus,
  ConflictType,
  DataSource,
  AuditAction
} from './types';
import * as readline from 'readline';

export {
  weightImportService,
  formulaScreenshotService,
  studentAnswerService,
  scoringEngine,
  dataExportService,
  selfCheckService,
  unifiedDataService,
  ConflictStatus,
  AnswerReviewStatus,
  ConflictType,
  DataSource,
  AuditAction
};

export default {
  weightImportService,
  formulaScreenshotService,
  studentAnswerService,
  scoringEngine,
  dataExportService,
  selfCheckService,
  unifiedDataService
};

function printBanner() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║            网络流容量分配 - 评分管理系统 v1.0                 ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  默认启动入口 — 可直接导入、上传、补录、复核、重算、导出、报告   ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
}

function printMenu() {
  console.log('─── 主菜单 ───');
  console.log('  1) 导入评分权重表 (CSV 文本)');
  console.log('  2) 上传旧公式截图 + 提取关键备注');
  console.log('  3) 导入学生答案 / 补交多版答案');
  console.log('  4) 补录 / 修正学生答案 (错口径/补录返工)');
  console.log('  5) 业务运营复核 (学生答案 + 公式冲突)');
  console.log('  6) 执行评分计算 / 重算');
  console.log('  7) 查看列表 / 详情 / 摘要');
  console.log('  8) 查看多版答案分组 (含原始答案、备注、处理原因)');
  console.log('  9) 导出明细 (CSV + JSON)');
  console.log(' 10) 生成数据一致性报告');
  console.log(' 11) 系统自检 (6 项)');
  console.log(' 12) 运行演示场景 (全链路)');
  console.log('  0) 退出');
  console.log('');
}

function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise(resolve => rl.question(question, answer => resolve(answer.trim())));
}

async function interactiveMain() {
  printBanner();
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  while (true) {
    printMenu();
    const choice = await prompt(rl, '请选择操作 [0-12]: ');

    try {
      switch (choice) {
        case '1': {
          const csv = await prompt(rl, '请输入 CSV 文本内容 (直接回车用样例): ');
          const sample = `criterionId,criterionName,weight,maxScore,formula
Q01,网络拓扑设计,0.3,100,score * weight
Q02,容量计算,0.4,100,score * weight * 1.1
Q03,路径优化,0.3,100,score * weight`;
          const result = weightImportService.importWeightTable(
            csv || sample,
            'CLI-用户',
            '通过 CLI 入口导入'
          );
          console.log(`✓ 导入成功，批次: ${result.batch.batchNumber}, ${result.weights.length} 条标准, 冲突: ${result.conflicts.length}`);
          break;
        }
        case '2': {
          const weightBatches = weightImportService.getWeightBatches();
          if (weightBatches.length === 0) {
            console.log('✗ 请先导入评分权重表');
            break;
          }
          const batchId = weightBatches[0].id;
          const formulaText = await prompt(rl, '公式文本 (直接回车用样例): ');
          const remarks = await prompt(rl, '截图备注原文 (直接回车用样例): ');
          const sampleFormula = 'Q01: score * weight\nQ02: score * weight * 1.2\nQ03: score * weight';
          const sampleRemarks = 'Q02: 系数调整为1.1后要保留两位小数；\nQ01: 注意拓扑图完整性要占此项30%权重，业务运营李老师确认；\nQ03: 如未写路径理由，一律扣5分';
          const shot = formulaScreenshotService.uploadFormulaScreenshot(
            batchId,
            '/cli/uploaded-formula.png',
            'CLI 上传的旧公式截图',
            formulaText || sampleFormula,
            'CLI-用户',
            remarks || sampleRemarks,
            []
          );
          const notes = formulaScreenshotService.extractKeyNotesFromRemarks(shot.id, 'CLI-用户');
          formulaScreenshotService.setActiveScreenshot(shot.id, 'CLI-用户');
          const batchWeights = weightImportService.getScoringWeights(batchId);
          formulaScreenshotService.buildWeightConflictsFromKeyNotes(batchId, batchWeights, 'CLI-用户');
          console.log(`✓ 截图 ID: ${shot.id}`);
          console.log(`✓ 解析备注: ${notes.length} 条`);
          notes.forEach(n => console.log(`  - [${n.referencedCriterionId}] ${n.content}`));
          break;
        }
        case '3': {
          const sid = await prompt(rl, '学生ID (如 S001): ') || 'S001';
          const sname = await prompt(rl, '学生姓名: ') || '李同学';
          const subId = await prompt(rl, '提交ID (如 SUB-S001 或 SUB-S001-V2): ') || `SUB-${sid}`;
          const ansRaw = await prompt(rl, '答案 JSON (如 {"Q01":85,"Q02":90,"Q03":88}, 回车用样例): ');
          const answers = ansRaw ? JSON.parse(ansRaw) : { Q01: 85, Q02: 90, Q03: 88 };
          const result = studentAnswerService.addStudentAnswer(sid, sname, subId, answers, 'CLI-用户');
          console.log(`✓ 已导入: ${result.answer.submissionId}, 状态=${result.answer.reviewStatus}, 冲突=${result.conflicts.length}`);
          result.conflicts.forEach(c => {
            console.log(`  冲突: ${c.title}`);
            console.log(`    原始说法: ${c.originalStatement}`);
            console.log(`    下一步: ${c.nextStepContact}`);
          });
          break;
        }
        case '4': {
          const answers = studentAnswerService.getStudentAnswers();
          if (answers.length === 0) { console.log('✗ 暂无学生答案'); break; }
          answers.forEach(a => console.log(`  ${a.submissionId} ${a.studentName} 状态=${a.reviewStatus}`));
          const subId = await prompt(rl, '要修正的 submissionId: ');
          const target = answers.find(a => a.submissionId === subId);
          if (!target) { console.log('✗ 找不到该 submissionId'); break; }
          const reason = await prompt(rl, '处理原因: ') || '现场错口径补录';
          const contact = await prompt(rl, '下一步联系人: ') || '业务运营复核';
          const ansRaw = await prompt(rl, '修正后答案 JSON: ');
          const newAnswers = ansRaw ? JSON.parse(ansRaw) : { ...target.answers };
          const updated = studentAnswerService.correctStudentAnswers(
            target.id, newAnswers, reason, 'CLI-用户', contact
          );
          console.log(`✓ 已修正，新状态=${updated?.reviewStatus}, 变更历史=${updated?.changeHistory.length}`);
          break;
        }
        case '5': {
          console.log('── 待复核学生答案 ──');
          const pending = studentAnswerService.getAnswersPendingReview();
          pending.forEach(a => console.log(`  answerId=${a.id} ${a.submissionId} ${a.studentName}`));
          const answerId = await prompt(rl, '要复核的 answerId (回车跳过): ');
          if (answerId) {
            const decision = await prompt(rl, '通过=approved / 驳回=rejected: ');
            const notes = await prompt(rl, '复核备注: ') || '';
            const contact = await prompt(rl, '下一步联系人: ') || '';
            const reason = await prompt(rl, '处理原因: ') || '';
            const st = decision === 'rejected' ? AnswerReviewStatus.REJECTED : AnswerReviewStatus.APPROVED;
            const r = studentAnswerService.reviewStudentAnswer(answerId, st, 'CLI-业务运营', notes, contact, reason);
            console.log(`✓ 已复核: ${r?.reviewStatus}`);
          }
          console.log('── 待处理冲突 ──');
          const conflicts = unifiedDataService.getAllPendingConflicts();
          conflicts.forEach(c => console.log(`  id=${c.id} [${c.type}] ${c.title}`));
          const cid = await prompt(rl, '要处理的 conflictId (回车跳过): ');
          if (cid) {
            const decision = await prompt(rl, '确认=confirmed / 驳回=rejected / 仍待处理=pending: ');
            const st = decision === 'confirmed' ? ConflictStatus.CONFIRMED
                   : decision === 'rejected' ? ConflictStatus.REJECTED
                   : ConflictStatus.PENDING;
            const notes = await prompt(rl, '处理备注: ') || '';
            const corrected = await prompt(rl, '改后口径说明: ') || '';
            const reason = await prompt(rl, '处理原因: ') || '';
            const contact = await prompt(rl, '下一步联系人: ') || '';
            weightImportService.resolveConflict(cid, st, 'CLI-业务运营', notes, corrected, reason, contact);
            console.log(`✓ 冲突已处理为: ${st}`);
          }
          break;
        }
        case '6': {
          const mode = await prompt(rl, '全量计算=c / 单条重算=r (默认c): ') || 'c';
          if (mode === 'r') {
            const subId = await prompt(rl, 'submissionId: ');
            const reason = await prompt(rl, '重算原因: ') || '补录后重算';
            const contact = await prompt(rl, '下一步联系人: ') || '';
            const r = scoringEngine.recalculateScore(subId, reason, 'CLI-用户', undefined, contact);
            console.log(`✓ 重算完成: ${r?.studentName}=${r?.totalScore} v${r?.version}`);
          } else {
            const r = scoringEngine.calculateScores('CLI-用户');
            console.log(`✓ 计算完成: 批次=${r.batchId}, 参与=${r.results.length}`);
            r.results.forEach(x => console.log(`  ${x.submissionId} ${x.studentName}=${x.totalScore} v${x.version}`));
          }
          break;
        }
        case '7': {
          const subId = await prompt(rl, '查看详情 submissionId (回车看列表+摘要): ');
          if (subId) {
            const rec = unifiedDataService.getUnifiedRecord(subId);
            if (!rec) { console.log('✗ 无此记录'); break; }
            console.log(JSON.stringify(rec, null, 2));
          } else {
            const list = unifiedDataService.getUnifiedList();
            const summary = unifiedDataService.getSummary();
            console.log('── 列表 ──');
            list.forEach(r => console.log(`  ${r.submissionId} ${r.studentName} ${r.totalScore}分 [${r.statusText}] 可导出=${r.exportReady}`));
            console.log(`\n── 摘要 ── 总=${summary.total} 正常=${summary.normal} 待复核=${summary.pendingReview} 已修正=${summary.corrected} 已重算=${summary.recalculated} 可导出=${summary.exportReadyCount} 均分=${summary.averageScore} 待处理冲突=${summary.allPendingConflictCount}`);
          }
          break;
        }
        case '8': {
          const groups = unifiedDataService.getDuplicateAnswerGroups();
          if (groups.length === 0) { console.log('✓ 无学生提交多版答案'); break; }
          groups.forEach(g => {
            console.log(`\n═══ ${g.studentName}(${g.studentId}) 共 ${g.submissions.length} 版, 待复核=${g.hasPending}`);
            if (g.processingReason) console.log(`  处理原因: ${g.processingReason}`);
            if (g.nextStepContact) console.log(`  下一步: ${g.nextStepContact}`);
            g.submissions.forEach(s => {
              console.log(`  · ${s.submissionId} 状态=${s.statusText} 分数=${s.totalScore}`);
              console.log(`    原始答案: ${JSON.stringify(s.answerData.originalAnswers)}`);
              console.log(`    当前答案: ${JSON.stringify(s.answerData.currentAnswers)}`);
              if (s.auditInfo.processingReason) console.log(`    处理原因: ${s.auditInfo.processingReason}`);
              if (s.auditInfo.nextStepContact) console.log(`    下一步: ${s.auditInfo.nextStepContact}`);
              if (s.conflictInfo.hasConflict) console.log(`    关联冲突: type=${s.conflictInfo.conflictType} status=${s.conflictInfo.conflictStatus}`);
            });
          });
          break;
        }
        case '9': {
          const includePending = await prompt(rl, '是否包含待复核? (y/n, 默认n): ') === 'y';
          const result = dataExportService.exportScoringResults('CLI-用户', { includePending });
          console.log(`✓ 导出 ${result.data.length} 条记录`);
          console.log('── CSV 头 ──');
          console.log(result.csvContent.split('\n')[0]);
          console.log('\n── JSON 首条样例 ──');
          if (result.data[0]) {
            const r = result.data[0];
            console.log(`  submissionId=${r.submissionId}, student=${r.studentName}, totalScore=${r.totalScore}, status=${r.statusText}, originalStatement=${r.originalStatement || '(无)'}, nextStepContact=${r.nextStepContact || '(无)'}, history=${r.history_trace?.substring(0, 60)}...`);
          }
          break;
        }
        case '10': {
          const report = dataExportService.generateReport('CLI-用户');
          console.log(report);
          const summary = unifiedDataService.getSummary();
          const pendingInReport = (report.match(/【待处理冲突清单】([\s\S]*?)\n\s*\n/)?.[1] || '').match(/  - \[/g)?.length || 0;
          console.log(`\n── 数据一致性自证 ──`);
          console.log(`  概览待处理冲突数: ${summary.allPendingConflictCount}`);
          console.log(`  清单列出冲突数:   ${pendingInReport}`);
          console.log(`  是否一致:         ${summary.allPendingConflictCount === pendingInReport ? '✓ 一致' : '✗ 不一致（BUG）'}`);
          break;
        }
        case '11': {
          const checks = selfCheckService.runAllChecks();
          const s = selfCheckService.getCheckSummary();
          console.log(`总通过: ${s.passedChecks}/${s.totalChecks}`);
          checks.forEach(c => console.log(`  ${c.passed ? '✓' : '✗'} ${c.checkName}: ${c.message}`));
          const dupInfo = checks.find(c => c.checkName === '学生重复提交检测');
          if (dupInfo?.details?.duplicateStudents?.length) {
            console.log('\n  多版答案明细:');
            dupInfo.details.duplicateStudents.forEach((d: any) => {
              console.log(`    ${d.studentName}(${d.studentId}): ${d.submissionCount} 版, ${d.submissionIds.join(', ')}, pending=${d.pendingReview}`);
              if (d.allVersions) {
                d.allVersions.forEach((v: any) => console.log(`      · ${v.submissionId}: original=${JSON.stringify(v.originalAnswers)}, current=${JSON.stringify(v.currentAnswers)}, reason=${v.correctionReason || ''}, next=${v.nextStepContact || ''}`));
              }
            });
          }
          break;
        }
        case '12': {
          console.log('\n── 调用内置演示脚本 (src/tests/index.ts 同款逻辑) ──\n');
          const { runDemo } = require('./tests/index');
          await runDemo();
          break;
        }
        case '0':
        case 'q':
        case 'quit':
        case 'exit':
          console.log('再见。');
          rl.close();
          return;
        default:
          console.log('无效选项。');
      }
    } catch (err: any) {
      console.log(`✗ 操作出错: ${err?.message || err}`);
    }
    console.log('');
    await prompt(rl, '按回车继续...');
  }
}

if (require.main === module) {
  interactiveMain().catch(err => {
    console.error('✗ CLI 启动失败:', err);
    process.exit(1);
  });
}
