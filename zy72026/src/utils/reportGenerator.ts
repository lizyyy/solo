import type {
  GameSession,
  Level,
  SettlementReport,
  ProblemResult,
  JudgmentResult,
  PlayerChoiceRecord,
} from '../types';
import { getFailureTypeLabel } from './judgmentEngine';

function getOptionLabel(options: Array<{ id: string; label: string }>, optionId: string | null): string {
  if (!optionId) return '未选择';
  const option = options.find((o) => o.id === optionId);
  return option?.label || optionId;
}

function generateHumanReadableSummary(report: SettlementReport): string {
  const lines: string[] = [];

  lines.push(`【期货仓单抢修队 - 演练结算报告】`);
  lines.push(`关卡：${report.levelName}`);
  lines.push(`说明：${report.levelDescription}`);
  lines.push('');

  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`📊 总成绩概览`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`总分：${report.totalScore} / ${report.maxScore} 分`);
  lines.push(`正确率：${report.accuracy.toFixed(1)}%（${report.correctCount}/${report.totalProblems}）`);
  lines.push(`平均响应时间：${report.avgResponseTime.toFixed(0)}ms`);
  lines.push('');

  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`⚠️  失败类型分析`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`规则误解：${report.failureBreakdown.ruleMisunderstanding} 次`);
  lines.push(`操作超时：${report.failureBreakdown.operationTimeout} 次`);
  lines.push('');

  if (report.failureBreakdown.ruleMisunderstanding > 0) {
    lines.push(`💡 建议：需要加强对业务规则的理解，特别是以下问题涉及的规则：`);
    report.problemDetails
      .filter((p) => p.failureType === 'rule_misunderstanding')
      .forEach((p) => {
        lines.push(`  • 【${p.problemTitle}】：${p.reasons[0]}`);
      });
    lines.push('');
  }

  if (report.failureBreakdown.operationTimeout > 0) {
    lines.push(`⏱️  建议：需要提高操作速度，以下问题响应超时：`);
    report.problemDetails
      .filter((p) => p.failureType === 'operation_timeout')
      .forEach((p) => {
        lines.push(`  • 【${p.problemTitle}】：${p.reasons[0]}`);
      });
    lines.push('');
  }

  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`📝 逐题详情`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  report.problemDetails.forEach((p, index) => {
    const status = p.isCorrect ? '✅ 正确' : `❌ 失败（${getFailureTypeLabel(p.failureType)}）`;
    lines.push(`\n第 ${index + 1} 题：${p.problemTitle}`);
    lines.push(`  状态：${status}`);
    lines.push(`  得分：${p.scoreChange > 0 ? '+' : ''}${p.scoreChange} 分`);
    lines.push(`  响应时间：${p.responseTime}ms`);
    lines.push(`  你的选择：${p.playerChoiceLabel || p.playerChoice || '未选择'}`);
    lines.push(`  正确答案：${p.correctChoiceLabel}`);
    lines.push(`  原因分析：`);
    p.reasons.forEach((r) => lines.push(`    - ${r}`));
    if (p.rules.length > 0) {
      lines.push(`  关联规则：${p.rules.join(', ')}`);
    }
  });

  if (report.supplementaryNoteDiff) {
    lines.push('');
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`📌 补录备注差异说明`);
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(report.supplementaryNoteDiff);
  }

  lines.push('');
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`报告生成时间：${new Date(report.exportedAt).toLocaleString('zh-CN')}`);
  lines.push(`会话ID：${report.sessionId}`);

  return lines.join('\n');
}

export function calculateSupplementaryNoteDiff(
  originalCount: number,
  currentCount: number,
  supplementaryNotes: Array<{ content: string; problemId?: string }>
): string | null {
  if (currentCount <= originalCount || supplementaryNotes.length === 0) {
    return null;
  }

  const diffLines: string[] = [];
  diffLines.push(`本次演练在原有 ${originalCount} 条备注的基础上，补录了 ${supplementaryNotes.length} 条讲解员备注：`);

  supplementaryNotes.forEach((note, index) => {
    const location = note.problemId ? `（关联问题：${note.problemId}）` : '（全局备注）';
    diffLines.push(`  ${index + 1}. ${note.content} ${location}`);
  });

  diffLines.push('');
  diffLines.push('补录前后差异：');
  diffLines.push(`  - 备注数量：${originalCount} → ${currentCount}（+${supplementaryNotes.length}）`);
  diffLines.push(`  - 补录时间：${new Date().toLocaleString('zh-CN')}`);
  diffLines.push(`  - 补录人员：讲解员小夏`);

  return diffLines.join('\n');
}

export function generateSettlementReport(
  session: GameSession,
  level: Level
): SettlementReport {
  const problemDetails: ProblemResult[] = [];
  let totalScore = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let timeoutCount = 0;
  let totalResponseTime = 0;
  let respondedCount = 0;
  let ruleMisunderstandingCount = 0;
  let operationTimeoutCount = 0;

  level.problems.forEach((problem) => {
    const judgment: JudgmentResult | undefined = session.judgments[problem.id];
    const choice: PlayerChoiceRecord | undefined = session.playerChoices[problem.id];

    if (judgment) {
      totalScore += judgment.scoreChange;

      if (judgment.isCorrect) {
        correctCount++;
      } else {
        if (judgment.failureType === 'rule_misunderstanding') {
          wrongCount++;
          ruleMisunderstandingCount++;
        } else if (judgment.failureType === 'operation_timeout') {
          timeoutCount++;
          operationTimeoutCount++;
        }
      }

      if (choice && choice.responseTime > 0) {
        totalResponseTime += choice.responseTime;
        respondedCount++;
      }

      problemDetails.push({
        problemId: problem.id,
        problemTitle: problem.title,
        isCorrect: judgment.isCorrect,
        failureType: judgment.failureType,
        playerChoice: choice?.optionId ?? null,
        playerChoiceLabel: getOptionLabel(problem.options, choice?.optionId ?? null),
        correctChoice: problem.correctOptionId,
        correctChoiceLabel: getOptionLabel(problem.options, problem.correctOptionId),
        responseTime: choice?.responseTime ?? 0,
        scoreChange: judgment.scoreChange,
        reasons: judgment.reasons,
        rules: judgment.ruleReferences,
      });
    }
  });

  const maxScore = level.problems.reduce((sum, p) => sum + p.scoring.correct, 0);
  const accuracy = level.problems.length > 0 ? (correctCount / level.problems.length) * 100 : 0;
  const avgResponseTime = respondedCount > 0 ? totalResponseTime / respondedCount : 0;

  const supplementaryNotes = session.notes.filter((n) => n.isSupplementary);
  const supplementaryNoteDiff = calculateSupplementaryNoteDiff(
    session.originalNotesCount,
    session.notes.length,
    supplementaryNotes
  );

  const report: SettlementReport = {
    sessionId: session.id,
    levelName: level.name,
    levelDescription: level.description,
    totalScore,
    maxScore,
    correctCount,
    wrongCount,
    timeoutCount,
    totalProblems: level.problems.length,
    accuracy,
    avgResponseTime,
    failureBreakdown: {
      ruleMisunderstanding: ruleMisunderstandingCount,
      operationTimeout: operationTimeoutCount,
    },
    problemDetails,
    humanReadableSummary: '',
    supplementaryNoteDiff,
    rawSessionData: session,
    exportedAt: Date.now(),
  };

  report.humanReadableSummary = generateHumanReadableSummary(report);

  return report;
}
