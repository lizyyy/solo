import { ClipboardList, FileText, Download, Copy } from 'lucide-react';
import { useState } from 'react';
import type { InspectionReport } from '../../utils/reportGenerator';
import { formatReportAsText } from '../../utils/reportGenerator';

interface ReportFormProps {
  report: InspectionReport;
  onClose: () => void;
}

export function ReportForm({ report, onClose }: ReportFormProps) {
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-slate-800 rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-industrial-blue" />
            <h3 className="text-xl font-bold text-white">{report.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin bg-slate-900 rounded-lg p-4 font-mono text-sm">
          <pre className="text-slate-300 whitespace-pre-wrap">{reportText}</pre>
        </div>

        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <ClipboardList className="w-4 h-4" />
            <span>得分: {report.score}</span>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              <Copy className="w-4 h-4" />
              {copied ? '已复制' : '复制'}
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 bg-industrial-blue hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              下载
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
