import { useState } from 'react';
import { FileText, Download, FileSpreadsheet, Copy, Check } from 'lucide-react';
import { usePendulumStore } from '@/store/usePendulumStore';
import { exportToPDF, exportToExcel, generateReportContent } from '@/utils/export';

export default function ReportGenerator() {
  const { data, result, studentName, experimentDate, chartRefs } = usePendulumStore();
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);

  const handleExportPDF = async () => {
    setExporting('pdf');
    try {
      await exportToPDF(data, result, studentName, experimentDate, chartRefs);
    } catch (err) {
      console.error('PDF导出失败:', err);
      alert('PDF导出失败，请重试');
    } finally {
      setExporting(null);
    }
  };

  const handleExportExcel = () => {
    setExporting('excel');
    try {
      exportToExcel(data, result);
    } catch (err) {
      console.error('Excel导出失败:', err);
      alert('Excel导出失败，请重试');
    } finally {
      setExporting(null);
    }
  };

  const handleCopyReport = async () => {
    const content = generateReportContent(data, result, studentName);
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  const canExport = data.length > 0;

  return (
    <div className="bg-slate-800/50 rounded-2xl p-6 backdrop-blur-sm border border-slate-700/50">
      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <FileText className="w-5 h-5 text-green-400" />
        实验报告
      </h2>

      <div className="space-y-3">
        <button
          onClick={handleExportPDF}
          disabled={!canExport || exporting !== null}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-5 h-5" />
          {exporting === 'pdf' ? '导出中...' : '导出 PDF 报告'}
        </button>

        <button
          onClick={handleExportExcel}
          disabled={!canExport || exporting !== null}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FileSpreadsheet className="w-5 h-5" />
          {exporting === 'excel' ? '导出中...' : '导出 Excel 数据'}
        </button>

        <button
          onClick={handleCopyReport}
          disabled={!canExport}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {copied ? (
            <>
              <Check className="w-5 h-5 text-green-400" />
              已复制到剪贴板
            </>
          ) : (
            <>
              <Copy className="w-5 h-5" />
              复制报告文本
            </>
          )}
        </button>
      </div>

      {!canExport && (
        <p className="text-center text-slate-500 text-sm mt-4">
          请先输入实验数据以生成报告
        </p>
      )}

      <div className="mt-4 p-3 bg-slate-700/30 rounded-lg">
        <p className="text-xs text-slate-400 font-medium mb-2">报告包含内容：</p>
        <ul className="text-xs text-slate-500 space-y-1">
          <li>• 实验基本信息（姓名、日期）</li>
          <li>• 完整的实验数据表格</li>
          <li>• 重力加速度计算结果</li>
          <li>• 拟合参数与统计指标</li>
          <li>• 误差来源分析与改进建议</li>
          <li>• （PDF包含数据可视化图表）</li>
        </ul>
      </div>
    </div>
  );
}
