import type { ReportJSON } from "@/types";

export function reportToText(report: ReportJSON): string {
  const lines: string[] = [];
  lines.push(`# 冷链车装载报告`);
  lines.push(`关卡: ${report.levelName} (${report.levelId})`);
  lines.push(`完成时间: ${new Date(report.finishedAt).toLocaleString()}`);
  lines.push(`耗时: ${report.durationSec}s`);
  lines.push(`结果: ${report.result === "won" ? "通关" : "失败"}${report.reason ? ` - ${report.reason}` : ""}`);
  lines.push(`得分: ${report.score}  (基础 ${report.baseScore} + 时间 ${report.timeBonus} - 扣分 ${report.penaltyTotal})`);
  lines.push(``);
  lines.push(`## 货物清单`);
  report.cargos.forEach((c, i) => {
    lines.push(
      `${i + 1}. ${c.name} [${c.zone}] 卸货序#${c.destOrder} ${c.placed ? `已装车 @(${c.x},${c.y})` : "未装车"}`
    );
  });
  if (report.violations.length) {
    lines.push(``);
    lines.push(`## 违规记录 (${report.violations.length})`);
    report.violations.forEach((v, i) => {
      lines.push(`${i + 1}. [${v.type}] ${v.message} (-${v.penalty})`);
    });
  }
  return lines.join("\n");
}

export function download(filename: string, content: string, mime = "text/plain;charset=utf-8"): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadReportJSON(report: ReportJSON): void {
  download(`cold-chain-report-${report.levelId}-${report.finishedAt}.json`, JSON.stringify(report, null, 2), "application/json");
}

export function downloadReportText(report: ReportJSON): void {
  download(`cold-chain-report-${report.levelId}-${report.finishedAt}.txt`, reportToText(report));
}
