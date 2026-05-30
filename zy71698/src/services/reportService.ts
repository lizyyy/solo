import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import type { CheckSnapshot, Issue, TimelineAlignment, Project, Material } from '@/types';
import { MATERIAL_TYPE_LABELS } from '@/types';
import { formatDate, downloadFile } from '@/utils/helpers';
import { formatTimecodeFromSeconds } from '@/utils/timecode';
import { getIssueSeverityColor } from './checkService';

export function generateReport(
  project: Project,
  snapshot: CheckSnapshot,
  issues: Issue[],
  alignments: TimelineAlignment[],
  materials: Material[]
): string {
  const lines: string[] = [];

  lines.push('='.repeat(60));
  lines.push('电影配乐Cue点核对报告');
  lines.push('='.repeat(60));
  lines.push('');

  lines.push(`项目名称：${project.name}`);
  lines.push(`项目描述：${project.description || '无'}`);
  lines.push(`报告版本：v${snapshot.versionNumber}`);
  lines.push(`生成时间：${formatDate(snapshot.createdAt)}`);
  lines.push('');

  lines.push('-'.repeat(60));
  lines.push('一、核对摘要');
  lines.push('-'.repeat(60));
  lines.push(snapshot.summary);
  lines.push(`错误数量：${snapshot.errorCount}`);
  lines.push(`警告数量：${snapshot.warningCount}`);
  lines.push(`对齐通过率：${snapshot.alignmentPassRate}%`);
  lines.push('');

  lines.push('-'.repeat(60));
  lines.push('二、使用材料');
  lines.push('-'.repeat(60));
  for (const m of snapshot.materials) {
    const label = MATERIAL_TYPE_LABELS[m.type];
    lines.push(`[${label}] ${m.fileName} (指纹: ${m.fingerprint.substring(0, 8)}...)`);
  }
  lines.push('');

  lines.push('-'.repeat(60));
  lines.push('三、问题列表');
  lines.push('-'.repeat(60));
  if (issues.length === 0) {
    lines.push('未发现任何问题。');
  } else {
    const sortedIssues = [...issues].sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === 'error' ? -1 : 1;
      return (a.timecode || 0) - (b.timecode || 0);
    });

    for (let i = 0; i < sortedIssues.length; i++) {
      const issue = sortedIssues[i];
      lines.push('');
      lines.push(`${i + 1}. [${issue.severity === 'error' ? '错误' : '警告'}] ${issue.description}`);
      lines.push(`   位置：${issue.location}`);
      lines.push(`   检测：${issue.detectionStep}`);
      lines.push(`   建议：${issue.suggestion}`);
      if (issue.timecode !== undefined) {
        lines.push(`   时间码：${formatTimecodeFromSeconds(issue.timecode)}`);
      }
    }
  }
  lines.push('');

  lines.push('-'.repeat(60));
  lines.push('四、时间轴对齐详情');
  lines.push('-'.repeat(60));
  lines.push('时间码'.padEnd(14) + '  对齐状态  备注');
  lines.push('-'.repeat(60));
  for (const alignment of alignments) {
    const tc = formatTimecodeFromSeconds(alignment.timecode);
    const status = alignment.isAligned ? '✓ 对齐' : '✗ 错位';
    const note = alignment.issues.join('; ') || '';
    lines.push(`${tc.padEnd(14)}  ${status.padEnd(8)}  ${note}`);
  }
  lines.push('');

  lines.push('-'.repeat(60));
  lines.push('五、材料解析详情');
  lines.push('-'.repeat(60));
  for (const m of materials) {
    const label = MATERIAL_TYPE_LABELS[m.type];
    lines.push('');
    lines.push(`[${label}] ${m.fileName}`);
    lines.push(`  格式：${m.fileFormat.toUpperCase()}`);
    lines.push(`  状态：${m.parseStatus === 'success' ? '解析成功' : m.parseStatus === 'failed' ? '解析失败' : '待解析'}`);
    if (m.parsedData?.cuePoints) {
      lines.push(`  Cue数量：${m.parsedData.cuePoints.length}`);
    }
    if (m.parseErrors.length > 0) {
      lines.push(`  解析错误：${m.parseErrors.length} 个`);
      for (const err of m.parseErrors) {
        lines.push(`    - ${err.friendlyMessage}`);
        lines.push(`      建议：${err.suggestion}`);
      }
    }
  }

  lines.push('');
  lines.push('='.repeat(60));
  lines.push('报告结束');
  lines.push('='.repeat(60));

  return lines.join('\n');
}

export function exportAsText(reportContent: string, projectName: string, version: number): void {
  const fileName = `${projectName}_核对报告_v${version}.txt`;
  downloadFile(reportContent, fileName, 'text/plain;charset=utf-8');
}

export function exportAsJson(
  project: Project,
  snapshot: CheckSnapshot,
  issues: Issue[],
  alignments: TimelineAlignment[],
  materials: Material[]
): void {
  const exportData = {
    exportTime: new Date().toISOString(),
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
    },
    snapshot: {
      versionNumber: snapshot.versionNumber,
      createdAt: snapshot.createdAt,
      summary: snapshot.summary,
      errorCount: snapshot.errorCount,
      warningCount: snapshot.warningCount,
      alignmentPassRate: snapshot.alignmentPassRate,
    },
    issues: issues.map(i => ({
      type: i.type,
      severity: i.severity,
      detectionStep: i.detectionStep,
      location: i.location,
      description: i.description,
      suggestion: i.suggestion,
      timecode: i.timecode !== undefined ? formatTimecodeFromSeconds(i.timecode) : undefined,
    })),
    alignments: alignments.map(a => ({
      timecode: formatTimecodeFromSeconds(a.timecode),
      isAligned: a.isAligned,
      issues: a.issues,
    })),
    materials: snapshot.materials.map(m => ({
      type: MATERIAL_TYPE_LABELS[m.type],
      fileName: m.fileName,
      fingerprint: m.fingerprint,
    })),
  };

  const fileName = `${project.name}_核对报告_v${snapshot.versionNumber}.json`;
  downloadFile(JSON.stringify(exportData, null, 2), fileName, 'application/json');
}

export function exportAsExcel(
  project: Project,
  snapshot: CheckSnapshot,
  issues: Issue[],
  alignments: TimelineAlignment[]
): void {
  const wb = XLSX.utils.book_new();

  const summaryData = [
    ['电影配乐Cue点核对报告'],
    [],
    ['项目名称', project.name],
    ['项目描述', project.description || '无'],
    ['报告版本', `v${snapshot.versionNumber}`],
    ['生成时间', formatDate(snapshot.createdAt)],
    [],
    ['核对摘要'],
    ['错误数量', snapshot.errorCount],
    ['警告数量', snapshot.warningCount],
    ['对齐通过率', `${snapshot.alignmentPassRate}%`],
    ['总体结论', snapshot.summary],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, '摘要');

  if (issues.length > 0) {
    const issuesData = [
      ['序号', '类型', '严重程度', '检测步骤', '位置', '描述', '建议', '时间码'],
      ...issues.sort((a, b) => {
        if (a.severity !== b.severity) return a.severity === 'error' ? -1 : 1;
        return (a.timecode || 0) - (b.timecode || 0);
      }).map((issue, idx) => [
        idx + 1,
        issue.type === 'timecode' ? '时间码' : issue.type === 'version' ? '版本' : '冲突',
        issue.severity === 'error' ? '错误' : '警告',
        issue.detectionStep,
        issue.location,
        issue.description,
        issue.suggestion,
        issue.timecode !== undefined ? formatTimecodeFromSeconds(issue.timecode) : '',
      ]),
    ];
    const wsIssues = XLSX.utils.aoa_to_sheet(issuesData);
    XLSX.utils.book_append_sheet(wb, wsIssues, '问题列表');
  }

  const alignmentData = [
    ['时间码', '对齐状态', '备注'],
    ...alignments.map(a => [
      formatTimecodeFromSeconds(a.timecode),
      a.isAligned ? '对齐' : '错位',
      a.issues.join('; ') || '',
    ]),
  ];
  const wsAlignment = XLSX.utils.aoa_to_sheet(alignmentData);
  XLSX.utils.book_append_sheet(wb, wsAlignment, '时间轴对齐');

  const fileName = `${project.name}_核对报告_v${snapshot.versionNumber}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

export function exportAsPDF(
  project: Project,
  snapshot: CheckSnapshot,
  issues: Issue[],
  _alignments: TimelineAlignment[],
  reportContent: string
): void {
  const doc = new jsPDF();
  let y = 20;
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('电影配乐Cue点核对报告', margin, y);
  y += 15;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`项目：${project.name}`, margin, y);
  y += 8;
  doc.text(`版本：v${snapshot.versionNumber}`, margin, y);
  y += 8;
  doc.text(`生成时间：${formatDate(snapshot.createdAt)}`, margin, y);
  y += 12;

  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(margin, y, 195, y);
  y += 10;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('核对摘要', margin, y);
  y += 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`错误：${snapshot.errorCount} 个`, margin, y);
  doc.text(`警告：${snapshot.warningCount} 个`, 80, y);
  doc.text(`对齐率：${snapshot.alignmentPassRate}%`, 140, y);
  y += 8;
  doc.text(snapshot.summary, margin, y);
  y += 12;

  if (issues.length > 0) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('问题列表', margin, y);
    y += 10;

    const sortedIssues = [...issues].sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === 'error' ? -1 : 1;
      return (a.timecode || 0) - (b.timecode || 0);
    });

    for (let i = 0; i < sortedIssues.length; i++) {
      if (y > pageHeight - 30) {
        doc.addPage();
        y = 20;
      }

      const issue = sortedIssues[i];
      const isError = issue.severity === 'error';

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');

      const severityColor = getIssueSeverityColor(issue.severity);
      if (severityColor.includes('error')) {
        doc.setTextColor(239, 68, 68);
      } else {
        doc.setTextColor(245, 158, 11);
      }

      doc.text(`${i + 1}. [${isError ? '错误' : '警告'}] ${issue.description}`, margin, y);
      doc.setTextColor(0);
      y += 6;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`   位置：${issue.location}`, margin, y);
      y += 5;
      doc.text(`   检测：${issue.detectionStep}`, margin, y);
      y += 5;
      doc.text(`   建议：${issue.suggestion}`, margin, y);
      y += 8;
    }
  }

  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(128, 128, 128);
  doc.text('本报告由电影配乐Cue点核对工具自动生成', margin, pageHeight - 20);

  const fileName = `${project.name}_核对报告_v${snapshot.versionNumber}.pdf`;
  doc.save(fileName);
}

export function printReport(reportContent: string): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('请允许弹出窗口以进行打印');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>核对报告 - 打印预览</title>
      <style>
        body {
          font-family: 'Microsoft YaHei', 'SimHei', sans-serif;
          line-height: 1.6;
          padding: 40px;
          max-width: 800px;
          margin: 0 auto;
          background: white;
          color: #333;
        }
        pre {
          font-family: 'Consolas', 'Monaco', monospace;
          white-space: pre-wrap;
          word-wrap: break-word;
          font-size: 13px;
          line-height: 1.5;
        }
        @media print {
          body { padding: 0; }
        }
      </style>
    </head>
    <body>
      <pre>${reportContent}</pre>
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 250);
}
