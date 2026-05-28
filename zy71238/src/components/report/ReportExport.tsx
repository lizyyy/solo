import React from 'react';
import { Download, FileText, FileSpreadsheet } from 'lucide-react';
import { generateReportData, generateHtmlReport, downloadHtmlReport, exportOperationLogsCsv } from '../../utils/reportGenerator';
import type { OperationLog, Warning } from '../../types';

interface ReportExportProps {
  rounds: number;
  trackingErrorHistory: number[];
  netValueHistory: number[];
  indexValueHistory: number[];
  operationLogs: OperationLog[];
  warnings: Warning[];
}

export const ReportExport: React.FC<ReportExportProps> = ({
  rounds,
  trackingErrorHistory,
  netValueHistory,
  indexValueHistory,
  operationLogs,
  warnings,
}) => {
  const handleExportHtml = () => {
    const reportData = generateReportData(
      rounds,
      trackingErrorHistory,
      netValueHistory,
      indexValueHistory,
      operationLogs,
      warnings
    );
    const html = generateHtmlReport(reportData);
    downloadHtmlReport(html, `指数基金复制挑战-复盘报告-${new Date().toLocaleDateString('zh-CN')}.html`);
  };

  const handleExportLogs = () => {
    exportOperationLogsCsv(operationLogs);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">📥 导出报告</h3>
      
      <div className="space-y-3">
        <button
          onClick={handleExportHtml}
          className="w-full flex items-center justify-center gap-2 py-3 bg-slate-800 text-white rounded font-medium hover:bg-slate-700 transition-colors"
        >
          <FileText size={18} />
          导出完整复盘报告 (HTML)
        </button>
        
        <button
          onClick={handleExportLogs}
          disabled={operationLogs.length === 0}
          className="w-full flex items-center justify-center gap-2 py-3 bg-white border border-gray-300 text-gray-700 rounded font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FileSpreadsheet size={18} />
          导出操作日志 (CSV)
        </button>
      </div>
      
      <div className="mt-4 p-3 bg-gray-50 rounded text-sm text-gray-600">
        <p className="font-medium mb-1">💡 报告包含：</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>最终跟踪误差及评级</li>
          <li>问题汇总与学习建议</li>
          <li>操作日志明细</li>
          <li>回合成绩统计</li>
        </ul>
      </div>
    </div>
  );
};
