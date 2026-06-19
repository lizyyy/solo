import type { SummarySnapshot } from "@/types";
import { formatDateTime } from "./consistency";

export function summaryToPlainText(s: SummarySnapshot): string {
  const lines: string[] = [];
  lines.push("【曲线拟合批量验算·沟通摘要】");
  lines.push(`项目：${s.sessionId}`);
  lines.push(`教练：${s.coachName}`);
  lines.push(`验算时间：${formatDateTime(s.auditedAt)}`);
  lines.push(`参数版本：${s.paramVersionName} (${s.paramVersionId})`);
  lines.push("");
  lines.push(`判断结论：${s.verdictText}`);
  lines.push("");
  lines.push("核心数据：");
  lines.push(`  · 样本总数：${s.totalRows}，有效参与拟合：${s.validRows}`);
  lines.push(`  · 撤回记录：${s.withdrawnRows}，边界样本：${s.boundaryRows}`);
  lines.push(`  · 单位缺失处理：${s.missingUnitRows}，偏差较大：${s.highDeviationRows}`);
  lines.push("");
  lines.push(`拟合公式：${s.formulaLabel}`);
  lines.push(`拟合质量：R² = ${s.rSquared.toFixed(4)}，RMSE = ${s.rmse.toFixed(4)}`);
  lines.push("");
  lines.push("边界样本处理说明：");
  lines.push(`  ${s.boundaryNote || "无特殊说明"}`);
  lines.push("");
  lines.push("单位确认摘要：");
  lines.push(`  ${s.unitNote || "所有样本单位齐全"}`);
  lines.push("");
  lines.push("异常处理摘要：");
  lines.push(`  ${s.exceptionNote || "无异常"}`);
  lines.push("");
  lines.push("交接备注：");
  s.handoffNotes.forEach((n, i) => lines.push(`  ${i + 1}. ${n}`));
  lines.push("");
  lines.push(`摘要校验码：${s.hash}`);
  return lines.join("\n");
}

export function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard) return Promise.resolve(false);
  return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
}

export function triggerPrint(): void {
  if (typeof window !== "undefined") window.print();
}

export function buildHandoffNotes(
  boundaryCount: number,
  missingUnitCount: number,
  withdrawnCount: number,
  highDeviationCount: number,
): string[] {
  const notes: string[] = [];
  notes.push("参数版本已锁定，如切换需重新运行验算并刷新摘要；");
  if (withdrawnCount > 0) notes.push(`存在 ${withdrawnCount} 条撤回记录，已标记不参与拟合，详情见草稿表格。`);
  if (missingUnitCount > 0) notes.push(`存在 ${missingUnitCount} 条单位缺失样本，已由教练人工补录，理由与影响范围留存于行级详情。`);
  if (boundaryCount > 0) notes.push(`存在 ${boundaryCount} 条边界样本，位于阈值 ±5% 容差带内，建议复核。`);
  if (highDeviationCount > 0) notes.push(`存在 ${highDeviationCount} 条拟合偏差较大的样本，需人工二次核验。`);
  if (notes.length === 1) notes.push("本次验算无特殊异常，可直接按参数版本结果交付。");
  return notes;
}
