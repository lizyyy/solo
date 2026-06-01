import type { SettlementReport } from '../types';

export function exportAsJSON(report: SettlementReport): string {
  const exportData = {
    metadata: {
      tool: '期货仓单抢修队',
      version: '1.0.0',
      exportedAt: report.exportedAt,
      exportedAtFormatted: new Date(report.exportedAt).toLocaleString('zh-CN'),
    },
    summary: {
      sessionId: report.sessionId,
      levelName: report.levelName,
      levelDescription: report.levelDescription,
      totalScore: report.totalScore,
      maxScore: report.maxScore,
      accuracy: report.accuracy,
      avgResponseTime: report.avgResponseTime,
      totalProblems: report.totalProblems,
      correctCount: report.correctCount,
      wrongCount: report.wrongCount,
      timeoutCount: report.timeoutCount,
      failureBreakdown: report.failureBreakdown,
    },
    problemDetails: report.problemDetails.map((p) => ({
      ...p,
      failureTypeLabel: p.failureType === 'rule_misunderstanding' ? '规则误解' : p.failureType === 'operation_timeout' ? '操作超时' : undefined,
    })),
    humanReadableReport: report.humanReadableSummary,
    supplementaryNoteDiff: report.supplementaryNoteDiff,
    judgmentTrail: {
      description: '包含完整判断链的原始会话数据，用于追溯每一步判断过程',
      session: report.rawSessionData,
    },
    fieldDefinitions: {
      failureType: {
        rule_misunderstanding: '玩家做出了选择，但不符合该场景下的正确操作规则',
        operation_timeout: '玩家未在规定时间内做出选择，或选择时间超过时间限制',
      },
      judgmentChain: '完整的判断步骤链，记录了判断引擎每一步的检查条件和结果',
      scoreChange: '该题得分变化，正数为加分，负数为扣分',
      ruleReferences: '关联的业务规则编号',
    },
  };

  return JSON.stringify(exportData, null, 2);
}

export function exportAsText(report: SettlementReport): string {
  return report.humanReadableSummary;
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadReport(report: SettlementReport, format: 'json' | 'text'): void {
  const timestamp = new Date(report.exportedAt).toISOString().replace(/[:.]/g, '-');
  const sessionId = report.sessionId.slice(0, 8);

  if (format === 'json') {
    const content = exportAsJSON(report);
    const filename = `期货仓单抢修队-${sessionId}-${timestamp}.json`;
    downloadFile(content, filename, 'application/json');
  } else {
    const content = exportAsText(report);
    const filename = `期货仓单抢修队-${sessionId}-${timestamp}.txt`;
    downloadFile(content, filename, 'text/plain;charset=utf-8');
  }
}

export function copyToClipboard(text: string): Promise<boolean> {
  return navigator.clipboard
    .writeText(text)
    .then(() => true)
    .catch(() => false);
}
