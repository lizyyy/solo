import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { PitchDeviation, RecordingBatch, Student, VoicePart, Note, CategoryStats } from '../types';
import { getCategoryLabel, getNoteSourceLabel } from './classification';

export async function exportToPDF(
  elementId: string,
  batch: RecordingBatch | undefined,
  stats: CategoryStats,
  fileName?: string
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) return;

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#faf8f3',
    logging: false,
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth - 20;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(26, 58, 58);
  pdf.text('音准趋势小报', pageWidth / 2, 15, { align: 'center' });

  if (batch) {
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 100, 100);
    pdf.text(
      `${batch.songName} | ${batch.title} | ${batch.rehearsalDate}`,
      pageWidth / 2,
      22,
      { align: 'center' }
    );
  }

  pdf.setFontSize(9);
  pdf.setTextColor(127, 140, 141);
  const summaryY = 30;
  pdf.text(`持续跑偏: ${stats.persistent}处`, 15, summaryY);
  pdf.text(`偶发失误: ${stats.occasional}处`, 60, summaryY);
  pdf.text(`未复核: ${stats.unreviewed}处`, 105, summaryY);
  pdf.text(`正常: ${stats.normal}处`, 150, summaryY);

  const chartY = 38;
  pdf.addImage(imgData, 'PNG', 10, chartY, imgWidth, imgHeight);

  const footerY = chartY + imgHeight + 8;
  pdf.setFontSize(8);
  pdf.setTextColor(150, 150, 150);
  pdf.text(
    `导出时间: ${new Date().toLocaleString('zh-CN')}`,
    pageWidth - 15,
    footerY,
    { align: 'right' }
  );

  const outputFileName = fileName || `音准趋势小报_${batch?.rehearsalDate || '未命名'}.pdf`;
  pdf.save(outputFileName);
}

export function generateReportText(
  batch: RecordingBatch | undefined,
  deviations: PitchDeviation[],
  students: Student[],
  voiceParts: VoicePart[],
  notes: Note[]
): string {
  if (!batch) return '';

  const batchDeviations = deviations.filter(d => d.batchId === batch.id);
  const batchNotes = notes.filter(n => n.batchId === batch.id);

  let report = `========================================\n`;
  report += `          音准趋势分析报告\n`;
  report += `========================================\n\n`;
  report += `曲目: ${batch.songName}\n`;
  report += `排练: ${batch.title}\n`;
  report += `日期: ${batch.rehearsalDate}\n`;
  report += `调性: ${batch.keySignature}`;
  if (batch.keyChanged) report += ` (由${batch.previousKey}转调)`;
  report += `\n`;
  report += `录音文件: ${batch.recordingFileName || '无'}\n`;
  report += `\n----------------------------------------\n\n`;

  voiceParts.forEach(vp => {
    const partStudents = students.filter(s => s.voicePartId === vp.id);
    const partDeviations = batchDeviations.filter(d => 
      partStudents.some(s => s.id === d.studentId)
    );

    const persistent = partDeviations.filter(d => d.category === 'persistent').length;
    const occasional = partDeviations.filter(d => d.category === 'occasional').length;
    const unreviewed = partDeviations.filter(d => d.category === 'unreviewed').length;

    report += `【${vp.displayName}】\n`;
    report += `  持续跑偏: ${persistent}处\n`;
    report += `  偶发失误: ${occasional}处\n`;
    report += `  未复核: ${unreviewed}处\n`;

    const issues = partDeviations.filter(d => 
      d.category === 'persistent' || d.category === 'occasional'
    );

    if (issues.length > 0) {
      report += `  问题详情:\n`;
      issues.forEach(d => {
        const student = students.find(s => s.id === d.studentId);
        const anomalyNote = d.isAnomaly ? ` [${d.anomalyReason || '异常'}]` : '';
        report += `    - ${student?.name || '未知'} 第${d.measure}小节: `;
        report += `${d.deviationCents > 0 ? '+' : ''}${d.deviationCents}音分`;
        report += ` (${getCategoryLabel(d.category)})${anomalyNote}\n`;
      });
    }
    report += `\n`;
  });

  if (batchNotes.length > 0) {
    report += `----------------------------------------\n`;
    report += `备注记录:\n\n`;
    batchNotes.forEach(n => {
      report += `[${getNoteSourceLabel(n.source)}] ${n.author}\n`;
      report += `  ${n.content}\n`;
      if (n.relatedMeasure) report += `  相关小节: 第${n.relatedMeasure}小节\n`;
      report += `  时间: ${n.createdAt}\n\n`;
    });
  }

  report += `========================================\n`;
  report += `导出时间: ${new Date().toLocaleString('zh-CN')}\n`;

  return report;
}

export function downloadTextReport(
  content: string,
  fileName?: string
): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName || `音准分析报告_${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
