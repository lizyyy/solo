import jsPDF from 'jspdf';
import type { TransitWindow, Conflict, ViewState, BriefingData } from '@/types';
import { formatDateTime, formatDuration } from '@/utils/timeUtils';
import { downloadFile } from '@/utils/storage';
import { TIME_SOURCE_LABELS, TIME_SYSTEM_LABELS, WINDOW_STATUS_LABELS, CONFLICT_TYPE_LABELS } from '@/types';

export function generateBriefingData(
  windows: TransitWindow[],
  conflicts: Conflict[],
  viewState: ViewState
): BriefingData {
  const viewStart = new Date(viewState.startTime).getTime();
  const viewEnd = new Date(viewState.endTime).getTime();
  
  const visibleWindows = windows.filter(w => {
    const wStart = new Date(w.startTime).getTime();
    const wEnd = new Date(w.endTime).getTime();
    return wStart <= viewEnd && wEnd >= viewStart;
  });
  
  const visibleConflicts = conflicts.filter(c => {
    const w1 = windows.find(w => w.id === c.windowId1);
    const w2 = c.windowId2 ? windows.find(w => w.id === c.windowId2) : null;
    if (!w1) return false;
    const w1InView = new Date(w1.startTime).getTime() <= viewEnd && new Date(w1.endTime).getTime() >= viewStart;
    const w2InView = !w2 || (new Date(w2.startTime).getTime() <= viewEnd && new Date(w2.endTime).getTime() >= viewStart);
    return w1InView || w2InView;
  });
  
  return {
    generatedAt: new Date().toISOString(),
    viewRange: {
      startTime: viewState.startTime,
      endTime: viewState.endTime
    },
    windows: visibleWindows,
    conflicts: visibleConflicts,
    summary: {
      totalWindows: visibleWindows.length,
      normalCount: visibleWindows.filter(w => w.status === 'NORMAL').length,
      conflictCount: visibleWindows.filter(w => w.status === 'CONFLICT').length,
      resolvedCount: visibleWindows.filter(w => w.status === 'RESOLVED').length
    }
  };
}

export function exportBriefingJSON(briefing: BriefingData): void {
  const content = JSON.stringify(briefing, null, 2);
  const filename = `卫星过境任务简报_${new Date().toISOString().slice(0, 10)}.json`;
  downloadFile(content, filename, 'application/json');
}

export function exportBriefingPDF(briefing: BriefingData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let y = margin;
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('卫星过境窗口任务简报', pageWidth / 2, y, { align: 'center' });
  y += 10;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`生成时间: ${formatDateTime(briefing.generatedAt)}`, pageWidth / 2, y, { align: 'center' });
  y += 15;
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('视图时间范围', margin, y);
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`开始: ${formatDateTime(briefing.viewRange.startTime)}`, margin, y);
  y += 6;
  doc.text(`结束: ${formatDateTime(briefing.viewRange.endTime)}`, margin, y);
  y += 12;
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('统计摘要', margin, y);
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`窗口总数: ${briefing.summary.totalWindows}`, margin, y);
  y += 6;
  doc.text(`正常窗口: ${briefing.summary.normalCount}`, margin, y);
  y += 6;
  doc.text(`冲突窗口: ${briefing.summary.conflictCount}`, margin, y);
  y += 6;
  doc.text(`已解决: ${briefing.summary.resolvedCount}`, margin, y);
  y += 12;
  
  if (y > pageHeight - 60) {
    doc.addPage();
    y = margin;
  }
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('过境窗口列表', margin, y);
  y += 10;
  
  doc.setFontSize(9);
  briefing.windows.forEach((window, index) => {
    if (y > pageHeight - 40) {
      doc.addPage();
      y = margin;
    }
    
    doc.setFont('helvetica', 'bold');
    doc.text(`${index + 1}. ${window.satelliteName}`, margin, y);
    y += 5;
    
    doc.setFont('helvetica', 'normal');
    doc.text(`   时间: ${formatDateTime(window.startTime)} - ${formatDateTime(window.endTime)}`, margin, y);
    y += 4;
    doc.text(`   时长: ${formatDuration(new Date(window.endTime).getTime() - new Date(window.startTime).getTime())}`, margin, y);
    y += 4;
    doc.text(`   来源: ${TIME_SOURCE_LABELS[window.timeSource]} (${TIME_SYSTEM_LABELS[window.timeSystem]})`, margin, y);
    y += 4;
    doc.text(`   状态: ${WINDOW_STATUS_LABELS[window.status]} | 优先级: ${window.priority}`, margin, y);
    y += 4;
    if (window.description) {
      doc.text(`   描述: ${window.description}`, margin, y);
      y += 4;
    }
    y += 6;
  });
  
  if (briefing.conflicts.length > 0) {
    if (y > pageHeight - 60) {
      doc.addPage();
      y = margin;
    }
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(255, 59, 48);
    doc.text('冲突检测报告', margin, y);
    doc.setTextColor(0, 0, 0);
    y += 10;
    
    briefing.conflicts.forEach((conflict, index) => {
      if (y > pageHeight - 50) {
        doc.addPage();
        y = margin;
      }
      
      const w1 = briefing.windows.find(w => w.id === conflict.windowId1);
      const w2 = conflict.windowId2 ? briefing.windows.find(w => w.id === conflict.windowId2) : null;
      
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 59, 48);
      doc.setFontSize(10);
      doc.text(`冲突 ${index + 1}: ${CONFLICT_TYPE_LABELS[conflict.type]}`, margin, y);
      doc.setTextColor(0, 0, 0);
      y += 5;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`   涉及窗口: ${w1?.satelliteName || '-'}${w2 ? ` / ${w2.satelliteName}` : ''}`, margin, y);
      y += 4;
      doc.text(`   问题原因: ${conflict.reason}`, margin, y);
      y += 4;
      doc.text(`   处理建议: ${conflict.suggestion}`, margin, y);
      y += 4;
      doc.setTextColor(0, 122, 255);
      doc.text(`   下一步行动: ${conflict.nextStep}`, margin, y);
      doc.setTextColor(0, 0, 0);
      y += 4;
      doc.text(`   当前状态: ${conflict.status === 'DETECTED' ? '待处理' : conflict.status === 'RESOLVED' ? '已解决' : '已忽略'}`, margin, y);
      y += 8;
    });
  }
  
  const filename = `卫星过境任务简报_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}

export function getWindowClipboardText(window: TransitWindow): string {
  return [
    `卫星: ${window.satelliteName}`,
    `时间: ${formatDateTime(window.startTime)} - ${formatDateTime(window.endTime)}`,
    `来源: ${TIME_SOURCE_LABELS[window.timeSource]} (${TIME_SYSTEM_LABELS[window.timeSystem]})`,
    `状态: ${WINDOW_STATUS_LABELS[window.status]}`,
    `优先级: ${window.priority}`,
    window.description ? `描述: ${window.description}` : ''
  ].filter(Boolean).join('\n');
}
