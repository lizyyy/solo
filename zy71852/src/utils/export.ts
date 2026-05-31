import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { Experiment, StepRecord, ScoreSheet, ScriptVersion, Anomaly } from '@/types';
import { formatDateTime, formatDate } from './date';

export interface ExportOptions {
  includeAnomalies: boolean;
  includeVersionHistory: boolean;
  includeSourceMarks: boolean;
}

export async function exportToExcel(
  experiment: Experiment,
  stepRecords: StepRecord[],
  scoreSheet: ScoreSheet | undefined,
  anomalies: Anomaly[],
  scriptVersions: ScriptVersion[],
  options: ExportOptions
): Promise<void> {
  const wb = XLSX.utils.book_new();

  const summaryData = [
    ['桥梁受力拼装实验报告 - 数据一致性说明'],
    [],
    ['基本信息'],
    ['实验编号', experiment.id],
    ['班级', experiment.className],
    ['学生姓名', experiment.studentName],
    ['学号', experiment.studentId],
    ['实验日期', formatDate(experiment.experimentDate)],
    ['学生记录到达时间', formatDateTime(experiment.studentRecordArrivedAt)],
    ['评分表到达时间', experiment.scoreSheetArrivedAt ? formatDateTime(experiment.scoreSheetArrivedAt) : '未到达'],
    ['当前脚本版本', experiment.currentScriptVersion],
    ['实验状态', getStatusText(experiment.status)],
    [],
    ['数据一致性校验'],
    ['步骤总数', Math.max(...stepRecords.map((s) => s.stepNumber))],
    ['异常数量', anomalies.length],
    ['已解决异常', anomalies.filter((a) => a.resolved).length],
    ['待解决异常', anomalies.filter((a) => !a.resolved).length],
    [],
    ['数据来源说明'],
    ['[学生记录]', '学生实验过程中实时记录的数据'],
    ['[评分表]', '教师课后录入的评分数据'],
    ['[补录]', '事后补充的数据'],
    ['[脚本修改]', '演示脚本的修改记录'],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, '汇总');

  const studentStepsData = [
    ['学生操作记录'],
    ['步骤号', '步骤名称', '内容', '实际发生时间', '记录时间', '状态', '是否补录', '操作人'],
    ...stepRecords
      .filter((s) => s.source === 'student')
      .map((s) => [
        s.stepNumber,
        s.stepName,
        options.includeSourceMarks ? `[学生记录] ${s.content}` : s.content,
        formatDateTime(s.actualOccurredAt),
        formatDateTime(s.recordedAt),
        getStepStatusText(s.status),
        s.isSupplementary ? '是' : '否',
        s.operator || '',
      ]),
  ];
  const wsStudent = XLSX.utils.aoa_to_sheet(studentStepsData);
  XLSX.utils.book_append_sheet(wb, wsStudent, '学生记录');

  if (scoreSheet) {
    const scoreData = [
      ['评分表'],
      ['总分', scoreSheet.totalScore],
      ['评分人', scoreSheet.grader],
      ['评分时间', formatDateTime(scoreSheet.gradedAt)],
      ['结论是否修改', scoreSheet.conclusionChanged ? '是' : '否'],
      scoreSheet.conclusionChanged ? ['修改原因', scoreSheet.conclusionChangeReason || ''] : [],
      scoreSheet.conclusionChanged ? ['原始结论', scoreSheet.originalConclusion || ''] : [],
      ['最终结论', options.includeSourceMarks ? `[评分表] ${scoreSheet.conclusion}` : scoreSheet.conclusion],
      [],
      ['步骤评分'],
      ['步骤号', '得分', '备注'],
      ...scoreSheet.stepScores.map((s) => [s.stepNumber, s.score, s.comment || '']),
    ].filter((row) => row.length > 0);
    const wsScore = XLSX.utils.aoa_to_sheet(scoreData);
    XLSX.utils.book_append_sheet(wb, wsScore, '评分表');
  }

  if (options.includeAnomalies && anomalies.length > 0) {
    const anomalyData = [
      ['异常记录'],
      ['异常类型', '描述', '来源', '责任人', '下一步措施', '是否解决', '创建时间'],
      ...anomalies.map((a) => [
        getAnomalyTypeText(a.type),
        a.description,
        getSourceText(a.source),
        a.responsiblePerson,
        a.nextAction,
        a.resolved ? '是' : '否',
        formatDateTime(a.createdAt),
      ]),
    ];
    const wsAnomaly = XLSX.utils.aoa_to_sheet(anomalyData);
    XLSX.utils.book_append_sheet(wb, wsAnomaly, '异常记录');
  }

  if (options.includeVersionHistory && scriptVersions.length > 0) {
    const versionData = [
      ['脚本版本历史'],
      ['版本号', '修改原因', '修改人', '修改时间', '父版本'],
      ...scriptVersions.map((v) => [
        v.version,
        v.changeReason,
        v.modifiedBy,
        formatDateTime(v.modifiedAt),
        v.parentVersion || '',
      ]),
    ];
    const wsVersion = XLSX.utils.aoa_to_sheet(versionData);
    XLSX.utils.book_append_sheet(wb, wsVersion, '版本历史');
  }

  XLSX.writeFile(wb, `桥梁实验_${experiment.studentName}_${formatDate(experiment.experimentDate)}.xlsx`);
}

export async function exportToPDF(elementId: string, fileName: string): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) throw new Error('Element not found');

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = canvas.width;
  const imgHeight = canvas.height;
  const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
  const imgX = (pdfWidth - imgWidth * ratio) / 2;
  const imgY = 0;

  pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
  pdf.save(`${fileName}.pdf`);
}

function getStatusText(status: string): string {
  const map: Record<string, string> = {
    normal: '正常',
    pending_score: '待补评分表',
    has_anomaly: '有异常',
    incomplete: '不完整',
  };
  return map[status] || status;
}

function getStepStatusText(status: string): string {
  const map: Record<string, string> = {
    completed: '完成',
    skipped: '跳过',
    pending: '待补',
  };
  return map[status] || status;
}

function getAnomalyTypeText(type: string): string {
  const map: Record<string, string> = {
    step_skip: '步骤跳过',
    conclusion_diff: '结论差异',
    timing_diff: '时序差异',
    missing_data: '数据缺失',
  };
  return map[type] || type;
}

function getSourceText(source: string): string {
  const map: Record<string, string> = {
    student: '学生记录',
    score_sheet: '评分表',
    manual: '手工补录',
    script_mod: '脚本修改',
  };
  return map[source] || source;
}

export interface ConsistencyCheckResult {
  passed: boolean;
  issues: {
    severity: 'error' | 'warning' | 'info';
    message: string;
  }[];
}

export function checkConsistency(
  stepRecords: StepRecord[],
  scoreSheet: ScoreSheet | undefined
): ConsistencyCheckResult {
  const issues: ConsistencyCheckResult['issues'] = [];

  const studentRecords = stepRecords.filter((s) => s.source === 'student');
  const scoreRecords = stepRecords.filter((s) => s.source === 'score_sheet');

  const allStepNumbers = new Set([
    ...studentRecords.map((s) => s.stepNumber),
    ...scoreRecords.map((s) => s.stepNumber),
    ...(scoreSheet?.stepScores.map((s) => s.stepNumber) || []),
  ]);

  for (const stepNum of allStepNumbers) {
    const studentRec = studentRecords.find((s) => s.stepNumber === stepNum);
    const scoreRec = scoreRecords.find((s) => s.stepNumber === stepNum);
    const scoreStep = scoreSheet?.stepScores.find((s) => s.stepNumber === stepNum);

    if (!studentRec) {
      issues.push({
        severity: 'warning',
        message: `步骤${stepNum}：学生记录缺失`,
      });
    }
    if (!scoreRec && scoreStep) {
      issues.push({
        severity: 'warning',
        message: `步骤${stepNum}：评分表步骤记录缺失`,
      });
    }
    if (studentRec && scoreRec && studentRec.status !== scoreRec.status) {
      issues.push({
        severity: 'error',
        message: `步骤${stepNum}：状态不一致（学生记录：${studentRec.status}，评分表：${scoreRec.status}）`,
      });
    }
  }

  if (scoreSheet?.conclusionChanged) {
    issues.push({
      severity: 'info',
      message: `结论已修改：${scoreSheet.conclusionChangeReason}`,
    });
  }

  return {
    passed: issues.filter((i) => i.severity === 'error').length === 0,
    issues,
  };
}
