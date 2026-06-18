import React, { useMemo, useState } from 'react';
import { X, Copy, Download, Check, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import useAppStore from '../../store/useAppStore';
import { generateMarkdownReport } from '../../utils/markdownGenerator';
import { copyToClipboard, downloadFile, formatDateTime } from '../../utils/helpers';

const ReportModal: React.FC = () => {
  const { showReport, toggleReport, stations, selectedStationId, records, sourceChains, remarks } = useAppStore();
  const [copied, setCopied] = useState(false);

  const station = stations.find(s => s.id === selectedStationId);
  const stationRecords = records.filter(r => r.stationId === selectedStationId);

  const markdown = useMemo(() => {
    if (!station) return '';
    return generateMarkdownReport({
      station,
      records: stationRecords,
      sourceChains,
      remarks,
      reportTime: formatDateTime(new Date().toISOString()),
    });
  }, [station, stationRecords, sourceChains, remarks]);

  if (!showReport) return null;

  const handleCopy = async () => {
    await copyToClipboard(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const filename = `潮汐能站复核报告_${station?.name || '未知站点'}_${formatDateTime(new Date().toISOString()).replace(/[: ]/g, '-')}.md`;
    downloadFile(filename, markdown);
  };

  const confirmedCount = stationRecords.filter(r => r.status === 'confirmed').length;
  const pendingCount = stationRecords.filter(r => r.status === 'pending').length;
  const returnedCount = stationRecords.filter(r => r.status === 'returned').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => toggleReport(false)}
      />
      <div className="relative w-full max-w-4xl h-[85vh] glass-panel rounded-2xl overflow-hidden border border-ocean-400/20 shadow-2xl flex flex-col animate-[fadeIn_0.25s_ease-out]">
        <style>{`@keyframes fadeIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }`}</style>

        <div className="px-6 py-4 border-b border-ocean-400/15 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-ocean-500 to-ocean-400 flex items-center justify-center shadow-lg shadow-ocean-500/30">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-ocean-300">
                复核报告预览
              </h3>
              <p className="text-xs text-slate-400">
                {station?.name} · 共 {stationRecords.length} 条记录
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-3 mr-4 text-xs">
              <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#2D6A4F]/20 text-[#52b788]">
                已确认 {confirmedCount}
              </span>
              <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#FFB627]/20 text-[#FFB627]">
                待补件 {pendingCount}
              </span>
              <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#C92A2A]/20 text-[#fa5252]">
                退回 {returnedCount}
              </span>
            </div>

            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-deep-sea-700 hover:bg-deep-sea-600 border border-ocean-400/20 hover:border-ocean-400/40 text-slate-200 rounded-lg text-sm transition-all"
            >
              {copied ? <Check className="w-4 h-4 text-[#52b788]" /> : <Copy className="w-4 h-4" />}
              {copied ? '已复制' : '复制'}
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-ocean-500 to-ocean-400 hover:from-ocean-400 hover:to-ocean-300 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-ocean-500/20"
            >
              <Download className="w-4 h-4" />
              下载 .md
            </button>
            <button
              onClick={() => toggleReport(false)}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-deep-sea-700 transition-all ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex">
          <div className="flex-1 overflow-y-auto p-6 markdown-content">
            <ReactMarkdown>{markdown}</ReactMarkdown>
          </div>

          <div className="w-72 border-l border-ocean-400/15 bg-deep-sea-950/50 p-4 overflow-y-auto">
            <h4 className="text-xs font-semibold text-ocean-400 uppercase tracking-wider mb-3">
              Markdown 源文本
            </h4>
            <pre className="text-[10px] leading-relaxed text-slate-400 font-mono whitespace-pre-wrap break-words">
              {markdown}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportModal;
