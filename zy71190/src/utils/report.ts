import type { GameSession, LevelConfig } from "@/types/game";

export interface ReportEntry {
  type: string;
  severity: string;
  detail: string;
  time: string;
}

export function buildReport(
  session: GameSession,
  level: LevelConfig,
): {
  sessionId: string;
  levelId: string;
  levelName: string;
  status: string;
  score: number;
  movesUsed: number;
  failureReason?: string;
  failureType?: string;
  totalEvents: number;
  criticalCount: number;
  warningCount: number;
  entries: ReportEntry[];
  generatedAt: string;
} {
  const entries: ReportEntry[] = session.events.map((e) => ({
    type: e.type,
    severity: e.severity,
    detail: e.detail,
    time: new Date(e.time).toISOString(),
  }));
  const criticalCount = session.events.filter((e) => e.severity === "critical").length;
  const warningCount = session.events.filter((e) => e.severity === "warning").length;
  return {
    sessionId: session.id,
    levelId: session.levelId,
    levelName: level.name,
    status: session.status,
    score: session.score,
    movesUsed: session.movesUsed,
    failureReason: session.failureReason,
    failureType: session.failureType,
    totalEvents: session.events.length,
    criticalCount,
    warningCount,
    entries,
    generatedAt: new Date().toISOString(),
  };
}

export function reportToText(report: ReturnType<typeof buildReport>): string {
  const lines: string[] = [];
  lines.push("=".repeat(56));
  lines.push("  钢卷吊运作业报告 / COIL LIFTING OPERATION REPORT");
  lines.push("=".repeat(56));
  lines.push(`关卡 Level     : ${report.levelName} (${report.levelId})`);
  lines.push(`会话 Session   : ${report.sessionId}`);
  lines.push(`状态 Status    : ${report.status}`);
  lines.push(`得分 Score     : ${report.score}`);
  lines.push(`移动次数 Moves : ${report.movesUsed}`);
  if (report.failureReason) {
    lines.push(`失败原因       : ${report.failureType} - ${report.failureReason}`);
  }
  lines.push(
    `事件统计       : 严重 ${report.criticalCount} / 警告 ${report.warningCount} / 合计 ${report.totalEvents}`,
  );
  lines.push("");
  lines.push("-".repeat(56));
  lines.push("  事件日志 / EVENT LOG");
  lines.push("-".repeat(56));
  if (report.entries.length === 0) {
    lines.push("  (无事件)");
  } else {
    report.entries.forEach((e, i) => {
      lines.push(
        `${String(i + 1).padStart(3, " ")} [${e.severity.toUpperCase().padEnd(8)}] ${e.type.padEnd(18)} ${e.detail}`,
      );
    });
  }
  lines.push("");
  lines.push(`生成时间 Generated: ${report.generatedAt}`);
  lines.push("=".repeat(56));
  return lines.join("\n");
}

export function downloadText(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadJSON(filename: string, data: unknown): void {
  const content = JSON.stringify(data, null, 2);
  const blob = new Blob([content], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
