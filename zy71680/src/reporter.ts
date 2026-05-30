import fs from 'node:fs';
import path from 'node:path';
import type { Report, ProcessingResult, Conflict, ValidationResult } from './types.js';

export function generateReport(
  inputDir: string,
  outputDir: string,
  validationResults: ValidationResult[],
  processingResults: ProcessingResult[],
  conflicts: Conflict[],
  rescheduleCount: number,
  totalBookings: number,
  locks: { length: number }
): Report {
  const confirmed = processingResults.filter(r => r.status === 'confirmed').length;
  const cancelled = processingResults.filter(r => r.status === 'cancelled').length;
  const pending = processingResults.filter(r => r.status === 'pending').length;
  const inProgress = processingResults.filter(r => r.status === 'in_progress').length;

  const roomOverlaps = conflicts.filter(c => c.type === 'ROOM_OVERLAP').length;
  const engineerDoubles = conflicts.filter(c => c.type === 'ENGINEER_DOUBLE').length;
  const missingEquipment = conflicts.filter(c => c.type === 'MISSING_EQUIPMENT').length;
  const critical = conflicts.filter(c => c.severity === 'critical').length;
  const warning = conflicts.filter(c => c.severity === 'warning').length;
  const validationErrors = validationResults.filter(v => !v.valid).length;

  return {
    generatedAt: new Date().toISOString(),
    inputDirectory: inputDir,
    outputDirectory: outputDir,
    summary: {
      totalBookings,
      processedBookings: processingResults.length,
      confirmedBookings: confirmed,
      cancelledBookings: cancelled,
      pendingBookings: pending + inProgress,
      totalConflicts: conflicts.length,
      criticalConflicts: critical,
      warningConflicts: warning,
      roomOverlaps,
      engineerDoubles,
      missingEquipment,
      totalReschedules: rescheduleCount,
      validationErrors,
    },
    validationResults,
    processingResults,
    conflicts,
    rescheduleLogs: [],
    resourceLocks: [],
  };
}

export function writeReport(report: Report, outputDir: string): string[] {
  fs.mkdirSync(outputDir, { recursive: true });

  const jsonPath = path.join(outputDir, 'report.json');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8');

  const csvPath = path.join(outputDir, 'conflicts.csv');
  const csvLines = ['booking_ids,type,severity,description,affected_resources,resolution_status,detected_at,source'];
  for (const c of report.conflicts) {
    csvLines.push([
      c.bookingIds.join(';'),
      c.type,
      c.severity,
      `"${c.description.replace(/"/g, '""')}"`,
      c.affectedResources.join(';'),
      c.resolutionStatus,
      c.detectedAt,
      c.provenance.source,
    ].join(','));
  }
  fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf-8');

  const detailPath = path.join(outputDir, 'processing-detail.csv');
  const detailLines = ['processing_order,booking_id,status,conflict_count,has_reschedule,lock_count'];
  for (const r of report.processingResults) {
    detailLines.push([
      r.processingOrder,
      r.bookingId,
      r.status,
      r.conflicts.length,
      r.reschedules.length > 0 ? 'yes' : 'no',
      r.locks.length,
    ].join(','));
  }
  fs.writeFileSync(detailPath, detailLines.join('\n'), 'utf-8');

  return [jsonPath, csvPath, detailPath];
}

export function formatTerminalSummary(report: Report): string {
  const s = report.summary;
  const lines: string[] = [];

  lines.push('═══════════════════════════════════════════════════');
  lines.push('           录音棚预约冲突板 - 运行报告');
  lines.push('═══════════════════════════════════════════════════');
  lines.push('');
  lines.push(`生成时间: ${report.generatedAt}`);
  lines.push(`输入目录: ${report.inputDirectory}`);
  lines.push(`输出目录: ${report.outputDirectory}`);
  lines.push('');

  lines.push('─── 预约概览 ───────────────────────────────────────');
  lines.push(`  总预约数:        ${s.totalBookings}`);
  lines.push(`  已处理:          ${s.processedBookings}`);
  lines.push(`  ✓ 已确认:        ${s.confirmedBookings}`);
  lines.push(`  ⏳ 待定(含冲突):  ${s.pendingBookings}`);
  lines.push(`  ✗ 已取消:        ${s.cancelledBookings}`);
  lines.push('');

  lines.push('─── 冲突检测 ───────────────────────────────────────');
  lines.push(`  冲突总数:        ${s.totalConflicts}`);
  lines.push(`  🔴 严重:         ${s.criticalConflicts}`);
  lines.push(`  🟡 警告:         ${s.warningConflicts}`);
  lines.push(`  ┌ 房间重叠:      ${s.roomOverlaps}`);
  lines.push(`  ├ 工程师双约:    ${s.engineerDoubles}`);
  lines.push(`  └ 设备缺失:      ${s.missingEquipment}`);
  lines.push('');

  lines.push('─── 调度结果 ───────────────────────────────────────');
  lines.push(`  自动改期:        ${s.totalReschedules}`);
  lines.push(`  数据校验异常:    ${s.validationErrors}`);
  lines.push('');

  if (report.validationResults.filter(v => !v.valid).length > 0) {
    lines.push('─── 数据异常明细 ───────────────────────────────────');
    for (const v of report.validationResults.filter(v => !v.valid)) {
      lines.push(`  [${v.recordType}] ${v.recordId}: ${v.issues.join('; ')}`);
      lines.push(`    出处: ${v.provenance.sourceDetail} (${v.provenance.source})`);
    }
    lines.push('');
  }

  if (report.conflicts.filter(c => c.severity === 'critical').length > 0) {
    lines.push('─── 严重冲突 ───────────────────────────────────────');
    for (const c of report.conflicts.filter(c => c.severity === 'critical')) {
      lines.push(`  [${c.type}] ${c.description}`);
      lines.push(`    影响预约: ${c.bookingIds.join(', ')}`);
      lines.push(`    状态: ${c.resolutionStatus}`);
    }
    lines.push('');
  }

  lines.push('─── 处理顺序 ───────────────────────────────────────');
  const invalidIds = new Set(
    report.validationResults.filter(v => !v.valid).map(v => v.recordId)
  );
  for (const r of report.processingResults.slice(0, 20)) {
    let statusIcon: string;
    let statusNote = '';
    const hasIssue = invalidIds.has(r.bookingId);
    if (r.status === 'cancelled') {
      statusIcon = '✗';
    } else if (r.status === 'confirmed' && hasIssue) {
      statusIcon = '⚠';
      statusNote = ' [有校验异常但可调度]';
    } else if (r.status === 'confirmed') {
      statusIcon = '✓';
    } else if (hasIssue) {
      statusIcon = '⚠';
      statusNote = ' [数据异常]';
    } else {
      statusIcon = '⏳';
    }
    const conflictFlag = r.conflicts.length > 0 ? ` [${r.conflicts.length}冲突]` : '';
    const rescheduleFlag = r.reschedules.length > 0 ? ' [已改期]' : '';
    lines.push(`  #${String(r.processingOrder).padStart(2, '0')} ${statusIcon} ${r.bookingId.padEnd(16)} → ${r.status}${conflictFlag}${statusNote}${rescheduleFlag}`);
  }
  if (report.processingResults.length > 20) {
    lines.push(`  ... 还有 ${report.processingResults.length - 20} 条`);
  }
  lines.push('');
  lines.push('═══════════════════════════════════════════════════');

  return lines.join('\n');
}
