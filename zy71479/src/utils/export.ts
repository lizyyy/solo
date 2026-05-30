import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import type { CornerData, ExportReport } from '../types';

export const generateExportReport = (corners: CornerData[]): ExportReport => {
  const validCorners = corners.filter((c) => !c.tire.isMissing);

  const summary = {
    totalCorners: corners.length,
    normalCount: corners.filter((c) => c.status === 'normal').length,
    warningCount: corners.filter((c) => c.status === 'warning').length,
    dangerCount: corners.filter((c) => c.status === 'danger').length,
    incompleteCount: corners.filter((c) => c.status === 'incomplete').length,
  };

  const calculations = {
    maxCentripetalForce: Math.max(...validCorners.map((c) => c.centripetalForce), 0),
    avgGripUtilization:
      validCorners.length > 0
        ? Math.round(
            validCorners.reduce((sum, c) => sum + c.gripUtilization, 0) / validCorners.length
          )
        : 0,
    cornerComparisons: corners.map((c) => ({
      cornerName: c.cornerName,
      speed: c.speed.value,
      radius: c.radius.value,
      gripUtilization: c.gripUtilization,
    })),
  };

  return {
    exportTime: new Date().toISOString(),
    dataset: corners,
    summary,
    calculations,
  };
};

export const exportToJSON = (corners: CornerData[], filename: string = 'grip-analysis') => {
  const report = generateExportReport(corners);
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  saveAs(blob, `${filename}-${new Date().toISOString().slice(0, 10)}.json`);
};

export const exportToExcel = (corners: CornerData[], filename: string = 'grip-analysis') => {
  const report = generateExportReport(corners);

  const summaryData = [
    { 指标: '总弯道数', 值: report.summary.totalCorners },
    { 指标: '抓地匹配良好', 值: report.summary.normalCount },
    { 指标: '接近抓地阈值', 值: report.summary.warningCount },
    { 指标: '超出抓地阈值', 值: report.summary.dangerCount },
    { 指标: '数据待补充', 值: report.summary.incompleteCount },
    { 指标: '最大向心力(G)', 值: report.calculations.maxCentripetalForce },
    { 指标: '平均抓地利用率(%)', 值: report.calculations.avgGripUtilization },
  ];

  const cornerData = corners.map((c) => ({
    弯道编号: c.cornerNumber,
    弯道名称: c.cornerName,
    车速_kmh: c.speed.value,
    车速来源: c.speed.source,
    车速置信度: c.speed.confidence,
    转弯半径_米: c.radius.value,
    '原始半径_米(如修正)': c.radius.originalValue || '',
    半径来源: c.radius.source,
    半径置信度: c.radius.confidence,
    轮胎类型: c.tire.type || '缺失',
    轮胎配方: c.tire.compound || '缺失',
    轮胎来源: c.tire.source || '缺失',
    向心力_G: c.centripetalForce,
    抓地阈值_G: c.gripThreshold,
    抓地利用率_百分比: c.gripUtilization,
    状态: c.status,
    历史记录数: c.history.length,
  }));

  const historyData = corners.flatMap((c) =>
    c.history.map((h) => ({
      弯道名称: c.cornerName,
      记录时间: h.timestamp,
      记录类型: h.type,
      涉及字段: h.field,
      原值: h.oldValue !== undefined ? String(h.oldValue) : '',
      新值: h.newValue !== undefined ? String(h.newValue) : '',
      操作人: h.operator,
      原因说明: h.reason,
    }))
  );

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), '汇总统计');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cornerData), '弯道详情');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(historyData), '历史记录');

  XLSX.writeFile(wb, `${filename}-${new Date().toISOString().slice(0, 10)}.xlsx`);
};
