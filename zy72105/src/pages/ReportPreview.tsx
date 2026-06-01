import { useAppStore } from '../store/useAppStore';
import { BatchSelector } from '../components/common/BatchSelector';
import { exportReport } from '../utils/exporter';
import { generateReportContent } from '../utils/exporter';
import { FileText, Download, FileJson, FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';

export const ReportPreview = () => {
  const { currentBatchId, batches } = useAppStore();
  const currentBatch = batches.find((b) => b.id === currentBatchId);
  const [reportContent, setReportContent] = useState<string | null>(null);

  const handleGenerateReport = () => {
    if (!currentBatch) return;
    setReportContent(generateReportContent(currentBatch));
  };

  const handleExport = (format: 'txt' | 'csv' | 'json') => {
    if (!currentBatch) return;
    exportReport(currentBatch, format);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">报告预览</h2>
          <p className="text-slate-500 text-sm mt-1">汇总报告 + 明细附表 + 决策链附录一体化</p>
        </div>
      </div>

      <BatchSelector />

      {currentBatch && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleGenerateReport}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-md shadow-blue-600/20"
          >
            <FileText className="w-4 h-4" />
            生成报告
          </button>
          <button
            onClick={() => handleExport('txt')}
            disabled={!reportContent}
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            导出TXT
          </button>
          <button
            onClick={() => handleExport('csv')}
            disabled={!reportContent}
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-all disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            导出CSV
          </button>
          <button
            onClick={() => handleExport('json')}
            disabled={!reportContent}
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-all disabled:opacity-50"
          >
            <FileJson className="w-4 h-4" />
            导出JSON
          </button>
        </div>
      )}

      {reportContent && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-700 to-emerald-600 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold">无人机旋翼噪声预测报告</h3>
                <p className="text-emerald-200 text-sm">
                  报告与明细数据同源，杜绝两套说法
                </p>
              </div>
            </div>
          </div>

          <div className="p-5">
            <pre className="bg-slate-900 text-green-400 p-6 rounded-lg text-sm font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
              {reportContent}
            </pre>
          </div>
        </div>
      )}

      {!reportContent && currentBatch && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center text-slate-400">
          <FileText className="w-16 h-16 mx-auto mb-3 text-slate-300" />
          <p className="font-medium text-slate-600">点击"生成报告"预览完整报告</p>
          <p className="text-sm mt-1">报告包含汇总页、明细附表、决策链附录</p>
        </div>
      )}

      {!currentBatch && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center text-slate-400">
          <FileText className="w-16 h-16 mx-auto mb-3 text-slate-300" />
          <p className="font-medium">请先选择一个批次</p>
        </div>
      )}
    </div>
  );
};
