import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import {
  ExportConfig,
  Report,
  Rehearsal,
  AudioTrack,
  Misnote,
  MisnoteStatistics,
  VoicePart,
  ScoreSection,
  Comment,
  generateId,
  formatTime,
  PROBLEM_TYPE_LABELS,
  CONFIRMATION_STATUS_LABELS,
  SOURCE_TYPE_LABELS,
  INSTRUMENT_LABELS,
} from '@/types';

interface ExportContext {
  rehearsal: Rehearsal;
  audioTrack: AudioTrack;
  misnotes: Misnote[];
  statistics: MisnoteStatistics;
  voiceParts: VoicePart[];
  scoreSections: ScoreSection[];
  comments: Comment[];
}

export async function exportReport(
  config: ExportConfig,
  context: ExportContext
): Promise<Report> {
  const report: Report = {
    id: generateId(),
    rehearsalId: context.rehearsal.id,
    name: `${context.rehearsal.name} - 错音分析报告`,
    format: config.format,
    filtersApplied: JSON.stringify(config.filters),
    timeRangeStart: config.timeRange[0],
    timeRangeEnd: config.timeRange[1],
    filePath: '',
    createdAt: new Date(),
    misnoteCount: context.misnotes.length,
  };

  if (config.format === 'pdf') {
    await exportPDF(config, context, report);
  } else {
    await exportXLSX(config, context, report);
  }

  return report;
}

async function exportPDF(
  config: ExportConfig,
  context: ExportContext,
  report: Report
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = margin;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('儿童合奏错音定位报告', pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`排练: ${context.rehearsal.name}`, margin, yPos);
  yPos += 6;
  doc.text(`日期: ${context.rehearsal.date}`, margin, yPos);
  yPos += 6;
  doc.text(
    `时间范围: ${formatTime(config.timeRange[0])} - ${formatTime(config.timeRange[1])}`,
    margin,
    yPos
  );
  yPos += 6;
  doc.text(`导出时间: ${new Date().toLocaleString('zh-CN')}`, margin, yPos);
  yPos += 10;

  if (config.includeCharts) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('统计概览', margin, yPos);
    yPos += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);

    const stats = context.statistics;
    const items = [
      { label: '错音总数', value: stats.total.toString() },
      { label: '声部混叠', value: stats.byProblemType.voice_overlap.toString() },
      { label: '段落错位', value: stats.byProblemType.section_misalignment.toString() },
      { label: '噪声误判', value: stats.byProblemType.noise_misjudgment.toString() },
      { label: '已确认', value: stats.byConfirmationStatus.confirmed.toString() },
      { label: '待确认', value: stats.byConfirmationStatus.pending.toString() },
      { label: '已驳回', value: stats.byConfirmationStatus.rejected.toString() },
    ];

    const colWidth = (pageWidth - margin * 2) / 2;
    items.forEach((item, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = margin + col * colWidth;
      const y = yPos + row * 8;

      doc.setFillColor(240, 240, 240);
      doc.roundedRect(x, y, colWidth - 2, 7, 1, 1, 'F');
      doc.text(`${item.label}:`, x + 2, y + 5);
      doc.setFont('helvetica', 'bold');
      doc.text(item.value, x + colWidth - 15, y + 5, { align: 'right' });
      doc.setFont('helvetica', 'normal');
    });

    yPos += Math.ceil(items.length / 2) * 8 + 8;

    doc.setFont('helvetica', 'bold');
    doc.text('各声部统计', margin, yPos);
    yPos += 6;
    doc.setFont('helvetica', 'normal');

    Object.entries(stats.byVoicePart).forEach(([voicePartId, count]) => {
      const voicePart = context.voiceParts.find((v) => v.id === voicePartId);
      if (voicePart) {
        doc.text(
          `- ${voicePart.name} (${INSTRUMENT_LABELS[voicePart.instrument]}): ${count}个`,
          margin + 5,
          yPos
        );
        yPos += 5;
      }
    });

    yPos += 4;
    doc.setFont('helvetica', 'bold');
    doc.text('偏差分布', margin, yPos);
    yPos += 6;
    doc.setFont('helvetica', 'normal');

    stats.byDeviationRange.forEach((item) => {
      doc.text(`- ${item.range}: ${item.count}个`, margin + 5, yPos);
      yPos += 5;
    });
  }

  if (yPos > pageHeight - 40) {
    doc.addPage();
    yPos = margin;
  }

  if (config.includeMisnoteList) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('错音详情列表', margin, yPos);
    yPos += 8;

    const headers = ['时间', '声部', '问题类型', '预期音高', '实际音高', '偏差', '状态', '来源'];
    const colWidths = [22, 28, 22, 18, 18, 14, 16, 14];

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    let xPos = margin;
    headers.forEach((header, i) => {
      doc.setFillColor(200, 200, 200);
      doc.roundedRect(xPos, yPos, colWidths[i], 7, 1, 1, 'F');
      doc.text(header, xPos + 2, yPos + 5);
      xPos += colWidths[i];
    });
    yPos += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    context.misnotes.slice(0, 100).forEach((misnote) => {
      if (yPos > pageHeight - 20) {
        doc.addPage();
        yPos = margin;
      }

      const voicePart = context.voiceParts.find((v) => v.id === misnote.voicePartId);

      const row = [
        formatTime(misnote.time),
        voicePart?.name || '-',
        PROBLEM_TYPE_LABELS[misnote.problemType],
        misnote.expectedPitch,
        misnote.actualPitch,
        `${misnote.deviationCents.toFixed(0)}音分`,
        CONFIRMATION_STATUS_LABELS[misnote.confirmationStatus],
        SOURCE_TYPE_LABELS[misnote.sourceType],
      ];

      xPos = margin;
      row.forEach((cell, i) => {
        doc.text(cell, xPos + 1, yPos + 4);
        xPos += colWidths[i];
      });
      yPos += 6;
    });

    if (context.misnotes.length > 100) {
      doc.text(
        `... 还有 ${context.misnotes.length - 100} 条记录，详见Excel版本`,
        margin,
        yPos + 4
      );
    }
  }

  if (config.includeComments && context.comments.length > 0) {
    if (yPos > pageHeight - 40) {
      doc.addPage();
      yPos = margin;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('备注记录', margin, yPos);
    yPos += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    const misnoteComments = context.comments.filter((c) =>
      context.misnotes.some((m) => m.id === c.misnoteId)
    );

    misnoteComments.slice(0, 20).forEach((comment) => {
      if (yPos > pageHeight - 20) {
        doc.addPage();
        yPos = margin;
      }

      const misnote = context.misnotes.find((m) => m.id === comment.misnoteId);
      const authorLabel = comment.authorType === 'teacher' ? '老师' : '学生';

      doc.setFont('helvetica', 'bold');
      doc.text(
        `[${formatTime(misnote?.time || 0)}] ${comment.authorName}(${authorLabel}):`,
        margin,
        yPos
      );
      doc.setFont('helvetica', 'normal');
      yPos += 5;
      doc.text(comment.content, margin + 3, yPos, { maxWidth: pageWidth - margin * 2 - 3 });
      yPos += 10;
    });
  }

  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${report.name}.pdf`;
  a.click();
  URL.revokeObjectURL(url);

  report.filePath = url;
}

async function exportXLSX(
  config: ExportConfig,
  context: ExportContext,
  report: Report
): Promise<void> {
  const wb = XLSX.utils.book_new();

  const overviewData = [
    ['儿童合奏错音定位报告'],
    [''],
    ['排练名称', context.rehearsal.name],
    ['日期', context.rehearsal.date],
    ['音频文件', context.audioTrack.name],
    ['时间范围', `${formatTime(config.timeRange[0])} - ${formatTime(config.timeRange[1])}`],
    ['导出时间', new Date().toLocaleString('zh-CN')],
    [''],
    ['统计概览'],
    ['指标', '数值'],
    ['错音总数', context.statistics.total],
    ['声部混叠', context.statistics.byProblemType.voice_overlap],
    ['段落错位', context.statistics.byProblemType.section_misalignment],
    ['噪声误判', context.statistics.byProblemType.noise_misjudgment],
    ['已确认', context.statistics.byConfirmationStatus.confirmed],
    ['待确认', context.statistics.byConfirmationStatus.pending],
    ['已驳回', context.statistics.byConfirmationStatus.rejected],
  ];

  Object.entries(context.statistics.byVoicePart).forEach(([voicePartId, count]) => {
    const voicePart = context.voiceParts.find((v) => v.id === voicePartId);
    if (voicePart) {
      overviewData.push([
        `${voicePart.name}(${INSTRUMENT_LABELS[voicePart.instrument]})`,
        count,
      ]);
    }
  });

  overviewData.push(['']);
  overviewData.push(['偏差分布']);
  overviewData.push(['偏差范围', '数量']);
  context.statistics.byDeviationRange.forEach((item) => {
    overviewData.push([item.range, item.count]);
  });

  const wsOverview = XLSX.utils.aoa_to_sheet(overviewData);
  XLSX.utils.book_append_sheet(wb, wsOverview, '概览');

  const misnoteData = [
    [
      '时间',
      '声部',
      '乐器',
      '学生',
      '问题类型',
      '预期音高',
      '实际音高',
      '偏差(音分)',
      '置信度',
      '确认状态',
      '来源',
      '备注',
    ],
  ];

  context.misnotes.forEach((misnote) => {
    const voicePart = context.voiceParts.find((v) => v.id === misnote.voicePartId);
    const comments = context.comments.filter((c) => c.misnoteId === misnote.id);
    const commentText = comments.map((c) => `${c.authorName}: ${c.content}`).join('; ');

    misnoteData.push([
      formatTime(misnote.time),
      voicePart?.name || '-',
      voicePart ? INSTRUMENT_LABELS[voicePart.instrument] : '-',
      voicePart?.studentName || '-',
      PROBLEM_TYPE_LABELS[misnote.problemType],
      misnote.expectedPitch,
      misnote.actualPitch,
      misnote.deviationCents.toFixed(1),
      (misnote.confidence * 100).toFixed(0) + '%',
      CONFIRMATION_STATUS_LABELS[misnote.confirmationStatus],
      SOURCE_TYPE_LABELS[misnote.sourceType],
      commentText,
    ]);
  });

  const wsMisnotes = XLSX.utils.aoa_to_sheet(misnoteData);
  wsMisnotes['!cols'] = [
    { wch: 12 },
    { wch: 12 },
    { wch: 8 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 8 },
    { wch: 40 },
  ];
  XLSX.utils.book_append_sheet(wb, wsMisnotes, '错音详情');

  if (config.includeComments) {
    const commentData = [
      ['错音时间', '作者', '类型', '内容', '时间'],
    ];

    const misnoteComments = context.comments.filter((c) =>
      context.misnotes.some((m) => m.id === c.misnoteId)
    );

    misnoteComments.forEach((comment) => {
      const misnote = context.misnotes.find((m) => m.id === comment.misnoteId);
      commentData.push([
        formatTime(misnote?.time || 0),
        comment.authorName,
        comment.authorType === 'teacher' ? '老师' : '学生',
        comment.content,
        new Date(comment.createdAt).toLocaleString('zh-CN'),
      ]);
    });

    const wsComments = XLSX.utils.aoa_to_sheet(commentData);
    wsComments['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 50 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsComments, '备注记录');
  }

  const sectionsData = [
    ['段落名称', '开始时间', '结束时间', '预期音符', '来源'],
  ];

  context.scoreSections
    .filter(
      (s) =>
        s.endTime >= config.timeRange[0] && s.startTime <= config.timeRange[1]
    )
    .forEach((section) => {
      sectionsData.push([
        section.name,
        formatTime(section.startTime),
        formatTime(section.endTime),
        section.expectedNotes,
        SOURCE_TYPE_LABELS[section.sourceType],
      ]);
    });

  const wsSections = XLSX.utils.aoa_to_sheet(sectionsData);
  XLSX.utils.book_append_sheet(wb, wsSections, '谱面段落');

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${report.name}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);

  report.filePath = url;
}
