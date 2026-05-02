import { JobConfig, ImpositionPlan, PreflightResult } from '../types';
import { toMM } from '../parser/unit';
import { calculatePaperUsage } from '../geometry';
export function exportImpositionPlan(config: JobConfig): ImpositionPlan {
 const usage = calculatePaperUsage(config);
 const workpieces = config.workpieces.map(wp => ({
 id: wp.id,
 name: wp.name,
 x: wp.x,
 y: wp.y,
 rotation: wp.rotation,
 copies: wp.copies,
 width: toMM(wp.width),
 height: toMM(wp.height),
 bleed: toMM(wp.bleed || config.bleed),
 safeMargin: toMM(wp.safeMargin || config.safeMargin)
 }));
 return {
 jobId: config.id,
 paperSize: {
 width: toMM(config.paper.width),
 height: toMM(config.paper.height),
 unit: 'mm'
 },
 workpieces,
 totalWaste: usage.wastePercentage,
 efficiency: 100 - usage.wastePercentage
 };
}
export function exportPreflightReport(config: JobConfig, preflight: PreflightResult): string {
 const usage = calculatePaperUsage(config);
 let md = `# 印刷拼版预检报告\n\n`;
 md += `## 作业信息\n\n`;
 md += `| 项目 | 值 |\n`;
 md += `|------|-----|\n`;
 md += `| 作业ID | ${config.id} |\n`;
 md += `| 作业名称 | ${config.name} |\n`;
 md += `| 纸张尺寸 | ${toMM(config.paper.width)}mm × ${toMM(config.paper.height)}mm |\n`;
 md += `| 标准出血 | ${toMM(config.bleed)}mm |\n`;
 md += `| 标准安全边距 | ${toMM(config.safeMargin)}mm |\n`;
 md += `| 作品数量 | ${config.workpieces.length} |\n`;
 md += `| 纸张利用率 | ${(100 - usage.wastePercentage).toFixed(1)}% |\n`;
 md += `| 纸张浪费率 | ${usage.wastePercentage.toFixed(1)}% |\n\n`;
 md += `## 作品列表\n\n`;
 md += `| 名称 | 尺寸 | 位置 | 旋转 | 份数 |\n`;
 md += `|------|------|------|------|------|\n`;
 config.workpieces.forEach(wp => {
 md += `| ${wp.name} | ${toMM(wp.width)}×${toMM(wp.height)}mm | (${wp.x.toFixed(1)}, ${wp.y.toFixed(1)}) | ${wp.rotation}° | ${wp.copies} |\n`;
 });
 md += `\n`;
 md += `## 预检结果\n\n`;
 md += `### 总体状态: ${preflight.passed ? '✅ 通过' : '❌ 未通过'}\n\n`;
 if (preflight.errors.length > 0) {
 md += `### ❌ 错误 (${preflight.errors.length})\n\n`;
 preflight.errors.forEach(issue => {
 md += `- **${issue.code}**: ${issue.message}\n`;
 if (issue.details) {
 md += ` - ${issue.details}\n`;
 }
 });
 md += `\n`;
 }
 if (preflight.warnings.length > 0) {
 md += `### ⚠️ 警告 (${preflight.warnings.length})\n\n`;
 preflight.warnings.forEach(issue => {
 md += `- **${issue.code}**: ${issue.message}\n`;
 if (issue.details) {
 md += ` - ${issue.details}\n`;
 }
 });
 md += `\n`;
 }
 if (preflight.passed && preflight.warnings.length === 0) {
 md += `### ✅ 所有检查通过\n\n`;
 md += `没有发现错误或警告，拼版方案可以发版。\n`;
 }
 md += `---\n`;
 md += `*生成时间: ${new Date().toISOString()}*\n`;
 return md;
}
export function downloadFile(content: string, filename: string, type: string): void {
 const blob = new Blob([content], { type });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = filename;
 document.body.appendChild(a);
 a.click();
 document.body.removeChild(a);
 URL.revokeObjectURL(url);
}
export function exportJson(config: JobConfig): string {
 const plan = exportImpositionPlan(config);
 return JSON.stringify(plan, null, 2);
}
export function exportMarkdown(config: JobConfig, preflight: PreflightResult): string {
 return exportPreflightReport(config, preflight);
}
export function downloadJson(config: JobConfig): void {
 const content = exportJson(config);
 downloadFile(content, `imposition_plan_${config.id}.json`, 'application/json');
}
export function downloadMarkdown(config: JobConfig, preflight: PreflightResult): void {
 const content = exportMarkdown(config, preflight);
 downloadFile(content, `preflight_${config.id}.md`, 'text/markdown');
}
