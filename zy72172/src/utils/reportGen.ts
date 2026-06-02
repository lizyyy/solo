import { SignalPoint, Feedback, PlanVersion, ReviewReport } from '../types';
import { checkAllConflicts } from './conflictCheck';

export function generatePointReport(
  point: SignalPoint,
  feedbacks: Feedback[],
  versions: PlanVersion[],
  allPoints: SignalPoint[]
): ReviewReport {
  const conflicts = checkAllConflicts(point, allPoints);
  const realConflicts = conflicts.filter(c => c.hasConflict);
  
  let summary = `【${point.name}】公交优先信号复核报告\n\n`;
  summary += `点位位置：${point.location}\n`;
  summary += `所属街道：${point.street}\n`;
  summary += `数据来源：${point.sourceType === 'legacy' ? '旧口径台账' : point.sourceType === 'manual' ? '手工录入' : '当前系统'}\n\n`;
  
  if (point.capacity !== undefined && point.designCapacity !== undefined) {
    const rate = Math.round((point.capacity / point.designCapacity) * 100);
    summary += `容量情况：实际 ${point.capacity} 辆/小时，设计 ${point.designCapacity} 辆/小时，利用率 ${rate}%\n`;
  }
  
  if (point.timeSlot) {
    summary += `高峰时段：${point.timeSlot}\n`;
  }
  
  let exceptionNote = '';
  if (realConflicts.length > 0) {
    exceptionNote = '⚠️ 例外情况说明：\n\n';
    realConflicts.forEach((c, i) => {
      exceptionNote += `${i + 1}. ${c.humanReadable}\n\n`;
    });
  } else {
    exceptionNote = '✓ 无例外情况，各项指标符合要求。';
  }
  
  if (feedbacks.length > 0) {
    summary += `\n居民反馈：共 ${feedbacks.length} 条记录\n`;
    feedbacks.forEach(fb => {
      const typeLabel = fb.type === 'complaint' ? '投诉' : fb.type === 'suggestion' ? '建议' : '信息';
      summary += `  - [${typeLabel}] ${fb.residentName}：${fb.content}\n`;
    });
  }
  
  if (versions.length > 0) {
    summary += `\n方案版本：共 ${versions.length} 个版本\n`;
    versions.forEach(v => {
      summary += `  - ${v.version}${v.isLegacy ? ' (历史)' : ''}：${v.changeLog} - ${v.author}\n`;
    });
  }
  
  return {
    id: `report-${Date.now()}`,
    pointId: point.id,
    summary,
    exceptionNote,
    status: realConflicts.length > 0 ? (point.manualNote ? 'approved' : 'pending') : 'approved',
    createdAt: new Date().toISOString()
  };
}

export function generateBatchReport(points: SignalPoint[]): string {
  const total = points.length;
  const approved = points.filter(p => p.status === 'approved').length;
  const pending = points.filter(p => p.status === 'pending').length;
  const conflict = points.filter(p => p.status === 'conflict').length;
  const legacy = points.filter(p => p.status === 'legacy').length;
  const hasConflicts = points.filter(p => p.hasConflict).length;
  
  let report = '═══════════════════════════════════════════\n';
  report += '       公交优先信号复核汇总报告\n';
  report += '═══════════════════════════════════════════\n\n';
  report += `生成时间：${new Date().toLocaleString('zh-CN')}\n\n`;
  
  report += '【总体统计】\n';
  report += `  点位总数：${total} 个\n`;
  report += `  复核通过：${approved} 个\n`;
  report += `  待人工确认：${pending} 个\n`;
  report += `  存在冲突：${conflict} 个\n`;
  report += `  历史版本：${legacy} 个\n\n`;
  
  const conflictPoints = points.filter(p => p.hasConflict);
  if (conflictPoints.length > 0) {
    report += '【例外详情】（以下情况需要重点关注）\n\n';
    conflictPoints.forEach((p, i) => {
      report += `${i + 1}. ${p.name}\n`;
      report += `   状态：${p.conflictNote || '存在未说明的冲突'}\n`;
      if (p.manualNote) {
        report += `   人工备注：${p.manualNote}\n`;
      }
      report += '\n';
    });
  } else {
    report += '【例外详情】\n  全部点位复核通过，无例外情况。\n\n';
  }
  
  report += '【交接说明】\n';
  report += '  本报告用于市政设计交接，请重点关注"例外详情"中列出的问题点位。\n';
  report += '  所有数据已保存至本地，刷新后可继续查阅。\n\n';
  report += '═══════════════════════════════════════════\n';
  
  return report;
}

export function downloadReport(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
