import { JobConfig, Workpiece, PreflightIssue, PreflightResult } from '../types';
import { toMM } from '../parser/unit';
export interface BoundingBox {
 x: number;
 y: number;
 width: number;
 height: number;
}
export function calculateBoundingBox(workpiece: Workpiece): BoundingBox {
 const width = toMM(workpiece.width);
 const height = toMM(workpiece.height);
 const bleed = toMM(workpiece.bleed || { value: 0, unit: 'mm' });
 const rotation = workpiece.rotation % 360;
 if (rotation === 0 || rotation === 180) {
 return {
 x: workpiece.x - bleed,
 y: workpiece.y - bleed,
 width: width + bleed * 2,
 height: height + bleed * 2
 };
 }
 else if (rotation === 90 || rotation === 270) {
 return {
 x: workpiece.x - bleed,
 y: workpiece.y - bleed,
 width: height + bleed * 2,
 height: width + bleed * 2
 };
 }
 else {
 const rad = (rotation * Math.PI) / 180;
 const cos = Math.abs(Math.cos(rad));
 const sin = Math.abs(Math.sin(rad));
 const rotWidth = width * cos + height * sin;
 const rotHeight = width * sin + height * cos;
 return {
 x: workpiece.x - bleed - (rotWidth - width) / 2,
 y: workpiece.y - bleed - (rotHeight - height) / 2,
 width: rotWidth + bleed * 2,
 height: rotHeight + bleed * 2
 };
 }
}
export function calculateSafeArea(workpiece: Workpiece): BoundingBox {
 const width = toMM(workpiece.width);
 const height = toMM(workpiece.height);
 const safe = toMM(workpiece.safeMargin || { value: 0, unit: 'mm' });
 return {
 x: workpiece.x + safe,
 y: workpiece.y + safe,
 width: width - safe * 2,
 height: height - safe * 2
 };
}
export function isPointInsideBox(x: number, y: number, box: BoundingBox): boolean {
 return x >= box.x && x <= box.x + box.width &&
 y >= box.y && y <= box.y + box.height;
}
export function doBoxesOverlap(box1: BoundingBox, box2: BoundingBox): boolean {
 return box1.x < box2.x + box2.width &&
 box1.x + box1.width > box2.x &&
 box1.y < box2.y + box2.height &&
 box1.y + box1.height > box2.y;
}
export function calculatePaperUsage(config: JobConfig): {
 totalArea: number;
 usedArea: number;
 wastePercentage: number;
} {
 const paperWidth = toMM(config.paper.width);
 const paperHeight = toMM(config.paper.height);
 const totalArea = paperWidth * paperHeight;
 let usedArea = 0;
 config.workpieces.forEach(workpiece => {
 const box = calculateBoundingBox(workpiece);
 const effectiveWidth = Math.min(box.width, paperWidth - box.x, box.x + box.width);
 const effectiveHeight = Math.min(box.height, paperHeight - box.y, box.y + box.height);
 usedArea += Math.max(0, effectiveWidth * effectiveHeight) * workpiece.copies;
 });
 const wastePercentage = ((totalArea - usedArea / config.workpieces.reduce((sum, wp) => sum + wp.copies, 1)) / totalArea * 100);
 return { totalArea, usedArea, wastePercentage: Math.max(0, wastePercentage) };
}
export function calculateWorkpiecePosition(index: number, config: JobConfig): {
 x: number;
 y: number;
} {
 const paperWidth = toMM(config.paper.width);
 const paperHeight = toMM(config.paper.height);
 const cols = Math.floor(paperWidth / (toMM(config.workpieces[0]?.width || { value: 100, unit: 'mm' }) + 10));
 const rows = Math.floor(paperHeight / (toMM(config.workpieces[0]?.height || { value: 100, unit: 'mm' }) + 10));
 const col = index % cols;
 const row = Math.floor(index / cols);
 const wpWidth = toMM(config.workpieces[0]?.width || { value: 100, unit: 'mm' });
 const wpHeight = toMM(config.workpieces[0]?.height || { value: 100, unit: 'mm' });
 const gapX = (paperWidth - cols * wpWidth) / (cols + 1);
 const gapY = (paperHeight - rows * wpHeight) / (rows + 1);
 return {
 x: gapX + col * (wpWidth + gapX),
 y: gapY + row * (wpHeight + gapY)
 };
}
export function preflightCheck(config: JobConfig): PreflightResult {
 const issues: PreflightIssue[] = [];
 const paperWidth = toMM(config.paper.width);
 const paperHeight = toMM(config.paper.height);
 config.workpieces.forEach(workpiece => {
 const bleed = toMM(workpiece.bleed || config.bleed);
 const safeMargin = toMM(workpiece.safeMargin || config.safeMargin);
 const bb = calculateBoundingBox(workpiece);
 const safeArea = calculateSafeArea(workpiece);
 if (bleed < 3) {
 issues.push({
 type: 'warning',
 code: `WP_${workpiece.id}_BLEED`,
 message: `${workpiece.name} 出血不足 (${bleed}mm)，建议至少 3mm`,
 workpieceId: workpiece.id,
 details: `当前出血: ${bleed}mm，最小建议: 3mm`
 });
 }
 if (safeMargin < 5) {
 issues.push({
 type: 'warning',
 code: `WP_${workpiece.id}_SAFE`,
 message: `${workpiece.name} 安全边距不足 (${safeMargin}mm)，建议至少 5mm`,
 workpieceId: workpiece.id,
 details: `当前安全边距: ${safeMargin}mm，最小建议: 5mm`
 });
 }
 if (bb.x < 0 || bb.y < 0 ||
 bb.x + bb.width > paperWidth ||
 bb.y + bb.height > paperHeight) {
 issues.push({
 type: 'error',
 code: `WP_${workpiece.id}_OUTSIDE`,
 message: `${workpiece.name} 超出纸张边界`,
 workpieceId: workpiece.id,
 details: `位置: (${bb.x.toFixed(1)}, ${bb.y.toFixed(1)}), 尺寸: ${bb.width.toFixed(1)}x${bb.height.toFixed(1)}`
 });
 }
 if (safeArea.width < 0 || safeArea.height < 0) {
 issues.push({
 type: 'error',
 code: `WP_${workpiece.id}_SAFE_OVERLAP`,
 message: `${workpiece.name} 安全边距过大，内容区域为负`,
 workpieceId: workpiece.id,
 details: `安全边距: ${safeMargin}mm，作品尺寸: ${toMM(workpiece.width)}x${toMM(workpiece.height)}`
 });
 }
 });
 for (let i = 0; i < config.workpieces.length; i++) {
 for (let j = i + 1; j < config.workpieces.length; j++) {
 const bb1 = calculateBoundingBox(config.workpieces[i]);
 const bb2 = calculateBoundingBox(config.workpieces[j]);
 if (doBoxesOverlap(bb1, bb2)) {
 issues.push({
 type: 'error',
 code: `WP_OVERLAP_${i}_${j}`,
 message: `${config.workpieces[i].name} 与 ${config.workpieces[j].name} 重叠`,
 workpieceId: config.workpieces[i].id
 });
 }
 }
 }
 const usage = calculatePaperUsage(config);
 if (usage.wastePercentage > 30) {
 issues.push({
 type: 'warning',
 code: 'WASTE_HIGH',
 message: `纸张浪费较高 (${usage.wastePercentage.toFixed(1)}%)`,
 details: `建议重新排版以提高利用率`
 });
 }
 const errors = issues.filter(i => i.type === 'error');
 const warnings = issues.filter(i => i.type === 'warning');
 return {
 passed: errors.length === 0,
 issues,
 warnings,
 errors
 };
}
