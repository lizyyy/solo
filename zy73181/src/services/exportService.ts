import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import type {
  Problem,
  ReviewResult,
  FilterCriteria,
  ExportReport,
  ProblematicRowInfo,
  ReviewStatus,
} from '@/types';
import {
  generateFilterSummary,
  reviewStatusLabel,
  difficultyLabel,
  constraintTypeLabel,
  reviewResultStatusLabel,
  unitCheckResultLabel,
  findProblematicRows,
  findUnitIssueRows,
  remarkStatusLabel,
  unitStatusLabel,
  judgmentLabel,
} from './filterService';

interface ExportOptions {
  problems: Problem[];
  reviewResultsA: ReviewResult[];
  reviewResultsB: ReviewResult[];
  filterCriteria: FilterCriteria;
  activeGroup: 'A' | 'B';
}

function resolveResultStatus(problem: Problem, result?: ReviewResult): ReviewStatus {
  if (!result) return problem.reviewStatus;
  if (result.status === 'unit_issue') return 'unit_issue';
  if (result.status === 'abnormal') return 'abnormal';
  if (result.status === 'normal') return 'normal';
  return problem.reviewStatus;
}

function computeStatistics(problems: Problem[], results: ReviewResult[]) {
  let normal = 0;
  let abnormal = 0;
  let unitIssue = 0;
  let pending = 0;
  problems.forEach((p) => {
    const r = results.find((x) => x.problemId === p.id);
    const s = resolveResultStatus(p, r);
    if (s === 'normal') normal++;
    else if (s === 'abnormal') abnormal++;
    else if (s === 'unit_issue') unitIssue++;
    else pending++;
  });
  return { total: problems.length, normal, abnormal, unitIssue, pending };
}

export function buildExportReport(options: ExportOptions): ExportReport {
  const { problems, reviewResultsA, reviewResultsB, filterCriteria, activeGroup } = options;
  const activeResults = activeGroup === 'A' ? reviewResultsA : reviewResultsB;
  const statistics = computeStatistics(problems, activeResults);
  const problematicRows = findProblematicRows(problems, reviewResultsA, reviewResultsB, activeGroup);
  const unitIssueRows = findUnitIssueRows(problems, reviewResultsA, reviewResultsB, activeGroup);

  const records = problems.map((problem) => {
    const result = activeResults.find((r) => r.problemId === problem.id)!;
    return { problem, result };
  });

  return {
    exportTime: new Date().toLocaleString('zh-CN'),
    activeGroup,
    filterCriteria,
    filterSummary: generateFilterSummary(filterCriteria),
    statistics,
    problematicRows,
    unitIssueRows,
    records,
  };
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

export function exportToCSV(options: ExportOptions): void {
  const { activeGroup } = options;
  const report = buildExportReport(options);
  const { statistics, problematicRows, unitIssueRows, records, filterSummary } = report;

  let csv = '\uFEFF';

  csv += `筛选口径：,${filterSummary}\n`;
  csv += `导出时间：,${report.exportTime}\n`;
  csv += `参数组：,${activeGroup}组\n`;
  csv += `题目总数,${statistics.total}\n`;
  csv += `复核正常,${statistics.normal}\n`;
  csv += `边界异常,${statistics.abnormal}\n`;
  csv += `单位问题,${statistics.unitIssue}\n`;
  csv += `待复核,${statistics.pending}\n`;
  csv += '\n';

  csv += ['题目ID', '原始行号', '题干摘要', '约束类型', '难度', '知识点', '边界值', '单位',
    '复核状态', '单位问题', '偏差', '单位校验', '备注', '后补备注'].join(',') + '\n';
  records.forEach(({ problem: p, result }) => {
    csv += [
      p.id,
      p.originalRow,
      `"${p.title}"`,
      constraintTypeLabel(p.constraintType),
      difficultyLabel(p.difficulty),
      p.knowledgePoint,
      p.boundaryValue ?? '',
      p.boundaryUnit || '',
      reviewResultStatusLabel(result.status),
      p.hasUnitIssue ? '是' : '否',
      result.status === 'unit_issue' ? '-' : (result.deviation * 100).toFixed(2) + '%',
      unitCheckResultLabel(result.unitCheckResult),
      `"${p.remark ?? ''}"`,
      p.isRemarkSupplementary ? '是' : '否',
    ].join(',') + '\n';
  });

  csv += '\n\n';
  csv += '拖偏复核边界的异常行（按偏差降序）：\n';
  csv += ['行号', '题目编号', '备注状态', '单位状态', '原始值', '原始单位', '换算值', '换算单位',
    'A组判定', 'B组判定', '判定变化', '偏差', '题干摘要'].join(',') + '\n';
  problematicRows.forEach((r: ProblematicRowInfo) => {
    csv += [
      r.originalRow,
      r.problemId,
      remarkStatusLabel(r.remarkStatus),
      unitStatusLabel(r.unitStatus),
      r.rawBoundaryValue ?? '-',
      r.rawBoundaryUnit ?? '-',
      r.convertedValue ?? '-',
      r.convertedUnit ?? '-',
      judgmentLabel(r.judgmentA),
      judgmentLabel(r.judgmentB),
      r.judgmentChanged ? `${judgmentLabel(r.judgmentA)}→${judgmentLabel(r.judgmentB)}` : '无变化',
      (r.deviation * 100).toFixed(2) + '%',
      `"${r.title}"`,
    ].join(',') + '\n';
  });

  if (unitIssueRows.length > 0) {
    csv += '\n\n';
    csv += '单位缺失/不匹配清单：\n';
    csv += ['行号', '题目编号', '备注状态', '单位状态', '原始单位', '当前判定', '原因', '题干摘要'].join(',') + '\n';
    unitIssueRows.forEach((r: ProblematicRowInfo) => {
      const reason = r.unitStatus === 'missing'
        ? '单位字段缺失，已独立标记未参与正常/异常统计'
        : '单位与约束要求不匹配，需人工确认';
      csv += [
        r.originalRow,
        r.problemId,
        remarkStatusLabel(r.remarkStatus),
        unitStatusLabel(r.unitStatus),
        r.rawBoundaryUnit ?? '(缺失)',
        judgmentLabel(r.judgmentA),
        reason,
        `"${r.title}"`,
      ].join(',') + '\n';
    });
  }

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  saveAs(blob, `约束规划边界复核_${activeGroup}组_${formatDate(new Date())}.csv`);
}

export function exportToExcel(options: ExportOptions): void {
  const { activeGroup } = options;
  const report = buildExportReport(options);
  const { statistics, problematicRows, unitIssueRows, records, filterSummary } = report;

  const wb = XLSX.utils.book_new();

  const summaryData = [
    ['约束规划边界复核报告'],
    [],
    ['导出时间', report.exportTime],
    ['参数组', `${activeGroup}组`],
    ['筛选口径', filterSummary],
    [],
    ['题目总数', statistics.total],
    ['复核正常', statistics.normal],
    ['边界异常', statistics.abnormal],
    ['单位问题', statistics.unitIssue],
    ['待复核', statistics.pending],
    [],
    ['拖偏复核边界的异常行（按偏差降序）'],
    ['行号', '题目编号', '备注状态', '单位状态', '原始值', '原始单位', '换算值', '换算单位',
      'A组判定', 'B组判定', '判定变化', '偏差', '题干摘要'],
    ...problematicRows.map((r) => [
      r.originalRow,
      r.problemId,
      remarkStatusLabel(r.remarkStatus),
      unitStatusLabel(r.unitStatus),
      r.rawBoundaryValue ?? '-',
      r.rawBoundaryUnit ?? '-',
      r.convertedValue ?? '-',
      r.convertedUnit ?? '-',
      judgmentLabel(r.judgmentA),
      judgmentLabel(r.judgmentB),
      r.judgmentChanged ? `${judgmentLabel(r.judgmentA)}→${judgmentLabel(r.judgmentB)}` : '无变化',
      (r.deviation * 100).toFixed(2) + '%',
      r.title,
    ]),
  ];

  if (unitIssueRows.length > 0) {
    summaryData.push([]);
    summaryData.push(['单位缺失/不匹配清单']);
    summaryData.push(['行号', '题目编号', '备注状态', '单位状态', '原始单位', '当前判定', '原因', '题干摘要']);
    unitIssueRows.forEach((r) => {
      const reason = r.unitStatus === 'missing'
        ? '单位字段缺失，已独立标记未参与正常/异常统计'
        : '单位与约束要求不匹配，需人工确认';
      summaryData.push([
        r.originalRow,
        r.problemId,
        remarkStatusLabel(r.remarkStatus),
        unitStatusLabel(r.unitStatus),
        r.rawBoundaryUnit ?? '(缺失)',
        judgmentLabel(r.judgmentA),
        reason,
        r.title,
      ]);
    });
  }

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), '报告摘要');

  const detailData = [
    ['题目ID', '原始行号', '题干摘要', '约束类型', '难度', '知识点', '边界值', '单位',
      '复核状态', '单位问题', '偏差(%)', '单位校验', '备注', '后补备注'],
    ...records.map(({ problem: p, result }) => [
      p.id,
      p.originalRow,
      p.title,
      constraintTypeLabel(p.constraintType),
      difficultyLabel(p.difficulty),
      p.knowledgePoint,
      p.boundaryValue ?? '-',
      p.boundaryUnit ?? '',
      reviewResultStatusLabel(result.status),
      p.hasUnitIssue ? '是' : '否',
      result.status === 'unit_issue' ? '-' : (result.deviation * 100).toFixed(2),
      unitCheckResultLabel(result.unitCheckResult),
      p.remark ?? '',
      p.isRemarkSupplementary ? '是' : '否',
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(detailData), '题目明细');

  if (unitIssueRows.length > 0) {
    const unitSheet = [
      ['行号', '题目编号', '备注状态', '单位状态', '原始单位', '原始值', '当前判定', '原因', '题干摘要'],
      ...unitIssueRows.map((r) => [
        r.originalRow,
        r.problemId,
        remarkStatusLabel(r.remarkStatus),
        unitStatusLabel(r.unitStatus),
        r.rawBoundaryUnit ?? '(缺失)',
        r.rawBoundaryValue ?? '-',
        judgmentLabel(r.judgmentA),
        r.unitStatus === 'missing'
          ? '单位字段缺失，已独立标记未参与正常/异常统计'
          : '单位与约束要求不匹配，需人工确认',
        r.title,
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(unitSheet), '单位问题');
  }

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `约束规划边界复核_${activeGroup}组_${formatDate(new Date())}.xlsx`);
}

export function getExportPreview(options: ExportOptions): {
  filterSummary: string;
  statistics: ExportReport['statistics'];
  problematicRows: ProblematicRowInfo[];
  unitIssueRows: ProblematicRowInfo[];
} {
  const report = buildExportReport(options);
  return {
    filterSummary: report.filterSummary,
    statistics: report.statistics,
    problematicRows: report.problematicRows,
    unitIssueRows: report.unitIssueRows,
  };
}
