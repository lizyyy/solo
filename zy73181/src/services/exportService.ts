import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import type { Problem, ReviewResult, FilterCriteria } from '@/types';
import { generateFilterSummary, reviewStatusLabel, difficultyLabel, constraintTypeLabel, reviewResultStatusLabel, unitCheckResultLabel, findProblematicRows } from './filterService';

interface ExportOptions {
  problems: Problem[];
  reviewResults: ReviewResult[];
  filterCriteria: FilterCriteria;
  groupId: 'A' | 'B';
}

export function exportToCSV(options: ExportOptions): void {
  const { problems, reviewResults, filterCriteria, groupId } = options;
  const filterSummary = generateFilterSummary(filterCriteria);
  const problematicRows = findProblematicRows(problems, reviewResults);

  const headerRow = [
    '筛选口径：', filterSummary, '', '', '', '', '', '',
  ].join(',') + '\n';

  const problemRows = [
    '题目ID',
    '原始行号',
    '题干摘要',
    '约束类型',
    '难度',
    '知识点',
    '边界值',
    '单位',
    '复核状态',
    '单位问题',
    '偏差',
    '单位校验结果',
    '备注',
    '后补备注',
  ].join(',') + '\n';

  const dataRows = problems
    .map((p) => {
      const result = reviewResults.find((r) => r.problemId === p.id);
      return [
        p.id,
        p.originalRow,
        `"${p.title}"`,
        constraintTypeLabel(p.constraintType),
        difficultyLabel(p.difficulty),
        p.knowledgePoint,
        p.boundaryValue,
        p.boundaryUnit || '',
        result ? reviewResultStatusLabel(result.status) : reviewStatusLabel(p.reviewStatus),
        p.hasUnitIssue ? '是' : '否',
        result ? (result.deviation * 100).toFixed(2) + '%' : '-',
        result ? unitCheckResultLabel(result.unitCheckResult) : '-',
        `"${p.remark}"`,
        p.isRemarkSupplementary ? '是' : '否',
      ].join(',');
    })
    .join('\n');

  let problematicSection = '\n\n问题行定位（按偏差降序）：\n';
  problematicSection += ['行号', '题目ID', '题干', '偏差'].join(',') + '\n';
  problematicRows.forEach((row) => {
    problematicSection += [row.rowNumber, row.problemId, `"${row.title}"`, (row.deviation * 100).toFixed(2) + '%'].join(',') + '\n';
  });

  const csvContent = '\uFEFF' + headerRow + '\n' + problemRows + dataRows + problematicSection;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  saveAs(blob, `约束规划边界复核_${groupId}组_${formatDate(new Date())}.csv`);
}

export function exportToExcel(options: ExportOptions): void {
  const { problems, reviewResults, filterCriteria, groupId } = options;
  const filterSummary = generateFilterSummary(filterCriteria);
  const problematicRows = findProblematicRows(problems, reviewResults);

  const wb = XLSX.utils.book_new();

  const summaryData = [
    ['约束规划边界复核报告'],
    [],
    ['导出时间', new Date().toLocaleString('zh-CN')],
    ['参数组', `${groupId}组`],
    ['筛选口径', filterSummary],
    ['题目总数', problems.length],
    ['正常数', problems.filter((p) => p.reviewStatus === 'normal').length],
    ['异常数', problems.filter((p) => p.reviewStatus === 'abnormal').length],
    ['单位问题数', problems.filter((p) => p.hasUnitIssue).length],
    ['待复核数', problems.filter((p) => p.reviewStatus === 'pending').length],
    [],
    ['问题行定位（按偏差降序）'],
    ['行号', '题目ID', '题干摘要', '偏差'],
    ...problematicRows.map((r) => [r.rowNumber, r.problemId, r.title, (r.deviation * 100).toFixed(2) + '%']),
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, '报告摘要');

  const detailData = [
    [
      '题目ID',
      '原始行号',
      '题干摘要',
      '约束类型',
      '难度',
      '知识点',
      '边界值',
      '单位',
      '复核状态',
      '单位问题',
      '偏差(%)',
      '单位校验',
      '备注',
      '后补备注',
    ],
    ...problems.map((p) => {
      const result = reviewResults.find((r) => r.problemId === p.id);
      return [
        p.id,
        p.originalRow,
        p.title,
        constraintTypeLabel(p.constraintType),
        difficultyLabel(p.difficulty),
        p.knowledgePoint,
        p.boundaryValue,
        p.boundaryUnit || '',
        result ? reviewResultStatusLabel(result.status) : reviewStatusLabel(p.reviewStatus),
        p.hasUnitIssue ? '是' : '否',
        result ? (result.deviation * 100).toFixed(2) : '-',
        result ? unitCheckResultLabel(result.unitCheckResult) : '-',
        p.remark,
        p.isRemarkSupplementary ? '是' : '否',
      ];
    }),
  ];

  const wsDetail = XLSX.utils.aoa_to_sheet(detailData);
  XLSX.utils.book_append_sheet(wb, wsDetail, '题目明细');

  const unitIssueData = problems
    .filter((p) => p.hasUnitIssue)
    .map((p) => {
      const result = reviewResults.find((r) => r.problemId === p.id);
      return [
        p.id,
        p.originalRow,
        p.title,
        p.boundaryUnit || '(缺失)',
        result ? unitCheckResultLabel(result.unitCheckResult) : '未知',
        p.remark,
      ];
    });

  if (unitIssueData.length > 0) {
    const wsUnit = XLSX.utils.aoa_to_sheet([
      ['题目ID', '原始行号', '题干摘要', '当前单位', '校验结果', '备注'],
      ...unitIssueData,
    ]);
    XLSX.utils.book_append_sheet(wb, wsUnit, '单位问题');
  }

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `约束规划边界复核_${groupId}组_${formatDate(new Date())}.xlsx`);
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

export function getExportPreview(options: ExportOptions): {
  filterSummary: string;
  totalCount: number;
  normalCount: number;
  abnormalCount: number;
  unitIssueCount: number;
  pendingCount: number;
  problematicRows: { rowNumber: number; problemId: string; title: string; deviation: number }[];
} {
  const { problems, reviewResults, filterCriteria } = options;

  return {
    filterSummary: generateFilterSummary(filterCriteria),
    totalCount: problems.length,
    normalCount: problems.filter((p) => p.reviewStatus === 'normal').length,
    abnormalCount: problems.filter((p) => p.reviewStatus === 'abnormal').length,
    unitIssueCount: problems.filter((p) => p.hasUnitIssue).length,
    pendingCount: problems.filter((p) => p.reviewStatus === 'pending').length,
    problematicRows: findProblematicRows(problems, reviewResults),
  };
}
