import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { generateReport } from '@/utils/reportGenerator';
import { Copy, Download, Check, FileText } from 'lucide-react';

export default function Report() {
  const { result } = useStore();
  const [copied, setCopied] = useState(false);

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <p className="text-sm">尚未执行核验，请先在工作台加载数据并核验</p>
      </div>
    );
  }

  const report = generateReport(result);

  const handleCopy = () => {
    navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-verify-${result.machineId}-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderedReport = report.split('\n').map((line, i) => {
    if (line.startsWith('# ')) {
      return <h1 key={i} className="text-lg font-bold text-white mt-4 mb-2">{line.slice(2)}</h1>;
    }
    if (line.startsWith('## ')) {
      const text = line.slice(3);
      let colorClass = 'text-white';
      if (text.includes('必须研发介入')) colorClass = 'text-accent-purple';
      else if (text.includes('需补备份')) colorClass = 'text-accent-red';
      else if (text.includes('可忽略')) colorClass = 'text-accent-amber';
      return <h2 key={i} className={`text-base font-bold mt-4 mb-2 ${colorClass}`}>{text}</h2>;
    }
    if (line.startsWith('### ')) {
      return <h3 key={i} className="text-sm font-semibold text-accent-cyan mt-3 mb-1">{line.slice(4)}</h3>;
    }
    if (line.startsWith('```')) return null;
    if (line.startsWith('---')) return <hr key={i} className="border-navy-500/30 my-4" />;
    if (line.startsWith('- **')) {
      const match = line.match(/^- \*\*(.+?)\*\*: (.+)$/);
      if (match) {
        return (
          <p key={i} className="text-xs text-slate-400 ml-3">
            <span className="font-medium text-slate-300">{match[1]}</span>: {match[2]}
          </p>
        );
      }
    }
    if (line.startsWith('_') && line.endsWith('_')) {
      return <p key={i} className="text-xs text-slate-600 italic">{line.slice(1, -1)}</p>;
    }
    if (line.trim() === '') return <div key={i} className="h-1" />;
    if (line.startsWith('**')) {
      const match = line.match(/\*\*(.+?)\*\*:? (.*)/);
      if (match) {
        return (
          <p key={i} className="text-sm text-slate-300">
            <span className="font-semibold">{match[1]}</span>{match[2] ? `: ${match[2]}` : ''}
          </p>
        );
      }
    }
    return <p key={i} className="text-xs text-slate-400 font-mono whitespace-pre-wrap">{line}</p>;
  }).filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">报告导出</h2>
          <p className="text-sm text-slate-500 mt-1">核验结果报告，可直接粘贴到值班群</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-cyan/10 text-accent-cyan text-sm border border-accent-cyan/30 hover:bg-accent-cyan/20 transition-colors"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? '已复制' : '复制到剪贴板'}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-navy-600 text-slate-300 text-sm border border-navy-500/50 hover:bg-navy-500 transition-colors"
          >
            <Download className="w-4 h-4" />
            下载 .md
          </button>
        </div>
      </div>

      <div className="bg-navy-800/80 rounded-xl border border-navy-500/30 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-navy-500/20 flex items-center gap-2 bg-navy-700/30">
          <FileText className="w-4 h-4 text-slate-500" />
          <span className="text-xs text-slate-400">
            核验报告 — {result.machineId} — {new Date(result.timestamp).toLocaleDateString('zh-CN')}
          </span>
        </div>
        <div className="p-5 max-h-[600px] overflow-y-auto">
          {renderedReport}
        </div>
      </div>
    </div>
  );
}
