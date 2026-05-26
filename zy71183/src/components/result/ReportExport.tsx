import { FileText, Download, Copy, RefreshCw, Home } from 'lucide-react';
import { useState } from 'react';
import type { InspectionReport } from '../../utils/reportGenerator';
import { formatReportAsText } from '../../utils/reportGenerator';

interface ReportExportProps {
  report: InspectionReport;
  onBackToMenu: () => void;
  onPlayAgain: () => void;
}

export function ReportExport({ report, onBackToMenu, onPlayAgain }: ReportExportProps) {
  const [copied, setCopied] = useState(false);
  const reportText = formatReportAsText(report);

  const handleCopy = () => {
    navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `巡检报告_${report.levelName}_${new Date().toLocaleDateString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900 rounded-xl p-6 border border-slate-700">
      <h2 className="text-xl font-semibold text-white mb-4">巡检报告</h2>
      
      <div className="bg-slate-800 rounded-lg p-4 mb-4 max-h-48 overflow-y-auto scrollbar-thin font-mono text-sm">
        <pre className="text-slate-300 whitespace-pre-wrap">{reportText}</pre>
      </div>
      
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            <Copy className="w-4 h-4" />
            {copied ? '已复制' : '复制报告'}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 bg-industrial-blue hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            下载报告
          </button>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={onPlayAgain}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            再玩一次
          </button>
          <button
            onClick={onBackToMenu}
            className="flex items-center gap-2 px-4 py-2 bg-industrial-blue hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Home className="w-4 h-4" />
            返回主页
          </button>
        </div>
      </div>
    </div>
  );
}
