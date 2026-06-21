import html2canvas from 'html2canvas';
import type { CrackRecord, Scheme, RecordStatus } from '../types';
import {
  STATUS_LABELS,
  SOURCE_LABELS,
  CRACK_TYPE_LABELS,
  RISK_LABELS,
  LOCATION_LABELS
} from '../types';

export const exportScreenshot = async (
  elementId: string,
  filename: string = '风电叶片裂纹标注'
): Promise<void> => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error('Element not found for export');
    return;
  }

  const canvases = element.querySelectorAll('canvas');
  canvases.forEach(canvas => {
    (canvas as any).dataset.wlCORS = 'true';
  });

  try {
    const canvas = await html2canvas(element, {
      backgroundColor: '#0f172a',
      scale: 2,
      useCORS: true,
      logging: false,
      allowTaint: true,
      foreignObjectRendering: false
    });

    const link = document.createElement('a');
    link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (e) {
    console.error('Failed to export screenshot:', e);
    throw e;
  }
};

const generateStatistics = (records: CrackRecord[]) => {
  const total = records.length;
  const statusCounts: Record<RecordStatus, number> = {
    pending: 0,
    processing: 0,
    completed: 0,
    confirmed: 0
  };
  const sourceCounts: Record<string, number> = {};
  const riskCounts: Record<string, number> = {};
  const oldCaliberCount = records.filter(r => r.isOldCaliber).length;

  records.forEach(r => {
    statusCounts[r.status]++;
    sourceCounts[r.source] = (sourceCounts[r.source] || 0) + 1;
    riskCounts[r.riskLevel] = (riskCounts[r.riskLevel] || 0) + 1;
  });

  return {
    total,
    statusCounts,
    sourceCounts,
    riskCounts,
    oldCaliberCount
  };
};

export const exportSchemeAsJSON = (
  scheme: Scheme,
  filename: string = '标注方案'
): void => {
  const dataStr = JSON.stringify(scheme, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const link = document.createElement('a');
  link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.json`;
  link.href = URL.createObjectURL(blob);
  link.click();
  URL.revokeObjectURL(link.href);
};

export const exportAllRecordsAsJSON = (
  records: CrackRecord[],
  filename: string = '全部标注记录'
): void => {
  const dataStr = JSON.stringify(records, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const link = document.createElement('a');
  link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.json`;
  link.href = URL.createObjectURL(blob);
  link.click();
  URL.revokeObjectURL(link.href);
};

export const exportReportAsText = (
  records: CrackRecord[],
  schemeName?: string,
  filename: string = '标注报告'
): void => {
  const stats = generateStatistics(records);
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');

  let report = '';
  report += '═'.repeat(60) + '\n';
  report += '        风电叶片裂纹标注报告\n';
  report += '═'.repeat(60) + '\n\n';
  
  if (schemeName) {
    report += `方案名称：${schemeName}\n`;
  }
  report += `生成时间：${now}\n`;
  report += `记录总数：${stats.total} 条\n\n`;

  report += '┌───────────────────────────────────────────────────────┐\n';
  report += '│  统计汇总                                              │\n';
  report += '├───────────────────────────────────────────────────────┤\n';
  report += `│  待处理：${String(stats.statusCounts.pending).padEnd(2)} 条    处理中：${String(stats.statusCounts.processing).padEnd(2)} 条    已处理：${String(stats.statusCounts.completed).padEnd(2)} 条    已确认：${String(stats.statusCounts.confirmed).padEnd(2)} 条  │\n`;
  report += `│  旧口径待复核：${stats.oldCaliberCount} 条                                    │\n`;
  report += '├───────────────────────────────────────────────────────┤\n';
  report += '│  风险等级：                                            │\n';
  Object.entries(stats.riskCounts).forEach(([level, count]) => {
    const label = RISK_LABELS[level as keyof typeof RISK_LABELS] || level;
    report += `│    ${label}：${count} 条${' '.repeat(48 - label.length * 2 - String(count).length * 2)}│\n`;
  });
  report += '├───────────────────────────────────────────────────────┤\n';
  report += '│  数据来源：                                            │\n';
  Object.entries(stats.sourceCounts).forEach(([source, count]) => {
    const label = SOURCE_LABELS[source as keyof typeof SOURCE_LABELS] || source;
    report += `│    ${label}：${count} 条${' '.repeat(48 - label.length * 2 - String(count).length * 2)}│\n`;
  });
  report += '└───────────────────────────────────────────────────────┘\n\n';

  report += '─'.repeat(60) + '\n';
  report += '  详细记录\n';
  report += '─'.repeat(60) + '\n\n';

  records.forEach((record, idx) => {
    report += `【${idx + 1}】${record.code}\n`;
    report += `${'─'.repeat(56)}\n`;
    report += `  部位：${LOCATION_LABELS[record.location]}    类型：${CRACK_TYPE_LABELS[record.crackType]}\n`;
    report += `  坐标：X=${record.position3D.x.toFixed(2)}  Y=${record.position3D.y.toFixed(2)}  Z=${record.position3D.z.toFixed(2)}\n`;
    report += `  状态：${STATUS_LABELS[record.status]}    风险：${RISK_LABELS[record.riskLevel]}\n`;
    report += `  来源：${SOURCE_LABELS[record.source]}    ${record.isOldCaliber ? '⚠️ 旧口径' : ''}\n`;
    report += `\n  描述：${record.description}\n`;
    report += `\n  处理建议：\n    ${record.suggestion.split('\n').join('\n    ')}\n`;
    if (record.remark) {
      report += `\n  处理备注：\n    ${record.remark.split('\n').join('\n    ')}\n`;
    }
    report += `\n  来源追溯：${record.sourceInfo.sourceRef}\n`;
    if (record.sourceInfo.sourceFile || record.sourceInfo.sourceRow) {
      report += `  来源文件：${record.sourceInfo.sourceFile || '-'}`;
      if (record.sourceInfo.sourceRow) {
        report += `    来源行号：第 ${record.sourceInfo.sourceRow} 行`;
      }
      report += '\n';
    }
    if (record.sourceInfo.importTime || record.sourceInfo.importOperator) {
      report += `  导入信息：`;
      if (record.sourceInfo.importOperator) report += `${record.sourceInfo.importOperator} `;
      if (record.sourceInfo.importTime) report += `于 ${record.sourceInfo.importTime}`;
      report += '\n';
    }
    report += `  创建时间：${record.createdAt}    更新时间：${record.updatedAt}\n`;
    
    if (record.history.length > 0) {
      report += `\n  操作历史（${record.history.length} 条）：\n`;
      record.history.forEach(h => {
        report += `    [${h.timestamp.slice(5, 16)}] ${h.operator} - ${h.detail}\n`;
        if (h.diff && h.diff.length > 0) {
          h.diff.forEach(d => {
            const fieldLabel = { status: '状态', remark: '备注', riskLevel: '风险等级', description: '描述' }[d.field] || d.field;
            report += `       ↳ ${fieldLabel}：${d.oldValue || '(空)'} → ${d.newValue}\n`;
          });
        }
      });
    }
    report += '\n\n';
  });

  report += '═'.repeat(60) + '\n';
  report += '  报告结束\n';
  report += '═'.repeat(60) + '\n';

  const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement('a');
  link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.txt`;
  link.href = URL.createObjectURL(blob);
  link.click();
  URL.revokeObjectURL(link.href);
};

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    console.error('Failed to copy to clipboard:', e);
    return false;
  }
};
