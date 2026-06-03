import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import type { ReportData, InspectionMark, ConflictRecord, ZAxisAbnormal, SelfCheckReport } from '@/types';

export async function exportToPDF(reportData: ReportData): Promise<Blob> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('水下管线巡检标记报告', pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`任务编号: ${reportData.task.taskNo}`, 20, yPos);
  yPos += 8;
  doc.text(`项目名称: ${reportData.task.projectName}`, 20, yPos);
  yPos += 8;
  doc.text(`巡检日期: ${reportData.task.inspectionDate}`, 20, yPos);
  yPos += 8;
  doc.text(`巡检人员: ${reportData.task.inspector}`, 20, yPos);
  yPos += 15;

  doc.setFont('helvetica', 'bold');
  doc.text('一、巡检标记数据', 20, yPos);
  yPos += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('序号', 20, yPos);
  doc.text('X坐标', 40, yPos);
  doc.text('Y坐标', 60, yPos);
  doc.text('Z坐标', 80, yPos);
  doc.text('管线类型', 100, yPos);
  doc.text('管径', 130, yPos);
  doc.text('障碍物', 150, yPos);
  yPos += 7;

  for (const mark of reportData.marks.slice(0, 15)) {
    doc.text(String(mark.sequenceNo), 20, yPos);
    doc.text(mark.x.toFixed(2), 40, yPos);
    doc.text(mark.y.toFixed(2), 60, yPos);
    doc.text(mark.z.toFixed(2), 80, yPos);
    doc.text(mark.pipelineType, 100, yPos);
    doc.text(mark.diameter, 130, yPos);
    doc.text(mark.obstacleType || '-', 150, yPos);
    yPos += 7;

    if (reportData.includeRawData && mark.originalNotes.length > 0) {
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      for (const note of mark.originalNotes) {
        doc.text(`  [原始备注] ${note.content}`, 25, yPos);
        yPos += 6;
      }
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
    }

    if (yPos > 270) {
      doc.addPage();
      yPos = 20;
    }
  }

  if (reportData.conflicts.length > 0) {
    doc.addPage();
    yPos = 20;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('二、冲突处理记录', 20, yPos);
    yPos += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    for (const conflict of reportData.conflicts) {
      doc.text(`冲突类型: ${getConflictTypeLabel(conflict.conflictType)}`, 20, yPos);
      yPos += 7;
      doc.text(`巡检标记证据: ${conflict.evidenceFromMark}`, 25, yPos);
      yPos += 7;
      doc.text(`草图证据: ${conflict.evidenceFromSketch}`, 25, yPos);
      yPos += 7;
      if (conflict.decision) {
        doc.text(`裁决: ${conflict.decision.decisionType === 'confirm' ? '确认' : '驳回'} - ${conflict.decision.reason}`, 25, yPos);
        yPos += 7;
        doc.text(`裁决人: ${conflict.decision.engineerName}`, 25, yPos);
        yPos += 10;
      } else {
        doc.text('状态: 待处理', 25, yPos);
        yPos += 10;
      }
    }
  }

  if (reportData.abnormalities.length > 0) {
    doc.addPage();
    yPos = 20;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('三、Z轴异常复核记录', 20, yPos);
    yPos += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    for (const abnormal of reportData.abnormalities) {
      doc.text(`检测Z值: ${abnormal.detectedZ.toFixed(2)}, 预期Z值: ${abnormal.expectedZ.toFixed(2)}`, 20, yPos);
      yPos += 7;
      doc.text(`异常原因: ${abnormal.suspicionReason}`, 25, yPos);
      yPos += 7;
      doc.text(`复核状态: ${getReviewStatusLabel(abnormal.reviewStatus)}`, 25, yPos);
      yPos += 10;
    }
  }

  doc.addPage();
  yPos = 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('四、自检报告', 20, yPos);
  yPos += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  for (const check of reportData.selfCheckReports) {
    doc.text(`检查项: ${getCheckTypeLabel(check.checkType)}`, 20, yPos);
    yPos += 7;
    doc.text(`结果: ${getCheckResultLabel(check.result)}`, 25, yPos);
    yPos += 7;
    doc.text(`详情: ${check.details}`, 25, yPos);
    yPos += 10;
  }

  doc.text(`报告生成时间: ${reportData.generatedAt}`, 20, yPos);

  return doc.output('blob');
}

export async function exportToExcel(reportData: ReportData): Promise<Blob> {
  const wb = XLSX.utils.book_new();

  const marksData = reportData.marks.map(mark => ({
    '序号': mark.sequenceNo,
    'X坐标': mark.x,
    'Y坐标': mark.y,
    'Z坐标': mark.z,
    '管线类型': mark.pipelineType,
    '管径(mm)': mark.diameter,
    '障碍物类型': mark.obstacleType || '',
    '是否障碍物': mark.isObstacle ? '是' : '否',
    '材料类型': getMaterialTypeLabel(mark.materialType),
    '原始备注': mark.originalNotes.map(n => n.content).join('; ')
  }));
  const ws1 = XLSX.utils.json_to_sheet(marksData);
  XLSX.utils.book_append_sheet(wb, ws1, '巡检标记');

  if (reportData.includeRawData) {
    const rawData = reportData.marks.flatMap(mark =>
      mark.originalNotes.map(note => ({
        '标记序号': mark.sequenceNo,
        '备注内容': note.content,
        '备注类型': getNoteTypeLabel(note.noteType),
        '是否存疑': note.isAmbiguous ? '是' : '否',
        '来源文件': note.sourceFile,
        '行号': note.lineNumber || ''
      }))
    );
    const ws2 = XLSX.utils.json_to_sheet(rawData);
    XLSX.utils.book_append_sheet(wb, ws2, '原始备注');
  }

  const conflictsData = reportData.conflicts.map(conflict => ({
    '冲突类型': getConflictTypeLabel(conflict.conflictType),
    '巡检标记证据': conflict.evidenceFromMark,
    '草图证据': conflict.evidenceFromSketch,
    '状态': getConflictStatusLabel(conflict.status),
    '裁决': conflict.decision ? (conflict.decision.decisionType === 'confirm' ? '确认' : '驳回') : '',
    '裁决理由': conflict.decision?.reason || '',
    '裁决人': conflict.decision?.engineerName || '',
    '裁决时间': conflict.decision?.decidedAt || ''
  }));
  const ws3 = XLSX.utils.json_to_sheet(conflictsData);
  XLSX.utils.book_append_sheet(wb, ws3, '冲突记录');

  const abnormalData = reportData.abnormalities.map(abnormal => ({
    '检测Z值': abnormal.detectedZ,
    '预期Z值': abnormal.expectedZ,
    '异常原因': abnormal.suspicionReason,
    '复核状态': getReviewStatusLabel(abnormal.reviewStatus),
    '复核人': abnormal.reviewRecord?.reviewerName || '',
    '复核结果': abnormal.reviewRecord?.reviewResult || ''
  }));
  const ws4 = XLSX.utils.json_to_sheet(abnormalData);
  XLSX.utils.book_append_sheet(wb, ws4, 'Z轴异常');

  const checkData = reportData.selfCheckReports.map(check => ({
    '检查项': getCheckTypeLabel(check.checkType),
    '结果': getCheckResultLabel(check.result),
    '详情': check.details,
    '执行时间': check.executedAt
  }));
  const ws5 = XLSX.utils.json_to_sheet(checkData);
  XLSX.utils.book_append_sheet(wb, ws5, '自检报告');

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function verifyExportConsistency(
  exportedData: unknown,
  originalData: unknown
): { consistent: boolean; differences: string[] } {
  const differences: string[] = [];
  const exportedStr = JSON.stringify(exportedData);
  const originalStr = JSON.stringify(originalData);

  if (exportedStr !== originalStr) {
    differences.push('导出数据与原始数据存在差异');
  }

  return {
    consistent: differences.length === 0,
    differences
  };
}

function getConflictTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    obstacle_mismatch: '障碍物不匹配',
    position_mismatch: '位置不匹配',
    diameter_mismatch: '管径不匹配'
  };
  return labels[type] || type;
}

function getConflictStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: '待处理',
    confirmed: '已确认',
    rejected: '已驳回'
  };
  return labels[status] || status;
}

function getReviewStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: '待复核',
    approved: '复核通过',
    corrected: '已修正'
  };
  return labels[status] || status;
}

function getCheckTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    duplicate_import: '重复导入检查',
    z_axis_check: 'Z轴方向检查',
    recalculation: '补录后重算',
    export_consistency: '导出一致性检查'
  };
  return labels[type] || type;
}

function getCheckResultLabel(result: string): string {
  const labels: Record<string, string> = {
    pass: '通过',
    fail: '未通过',
    warning: '警告'
  };
  return labels[result] || result;
}

function getMaterialTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    normal: '正常材料',
    wrong_diameter: '错口径材料',
    supplementary: '补录材料'
  };
  return labels[type] || type;
}

function getNoteTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    handwritten: '手写备注',
    photo: '照片记录',
    typed: '录入备注',
    ambiguous: '存疑备注'
  };
  return labels[type] || type;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
