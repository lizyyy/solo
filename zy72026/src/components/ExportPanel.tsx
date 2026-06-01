import React, { useState } from 'react';
import { Download, Copy, Check, FileJson, FileText } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { downloadReport, copyToClipboard } from '../utils/exportUtils';
import type { SettlementReport } from '../types';

interface ExportPanelProps {
  report: SettlementReport;
}

export const ExportPanel: React.FC<ExportPanelProps> = ({ report }) => {
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);
  const { exportReport } = useGameStore();

  const handleCopy = async (format: 'json' | 'text') => {
    const content = exportReport(format);
    const success = await copyToClipboard(content);
    if (success) {
      setCopiedFormat(format);
      setTimeout(() => setCopiedFormat(null), 2000);
    }
  };

  const handleDownload = (format: 'json' | 'text') => {
    downloadReport(report, format);
  };

  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-amber-400 flex items-center gap-2">
        <Download size={18} />
        导出报告
      </h4>

      <div className="grid grid-cols-2 gap-3">
        <div className="industrial-panel p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileJson className="text-blue-400" size={20} />
            <span className="font-semibold">JSON 格式</span>
          </div>
          <p className="text-xs text-industrial-muted mb-3">
            包含完整判断链和原始数据，便于后续处理和程序读取
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => handleDownload('json')}
              className="flex-1 industrial-button-secondary text-sm py-2 flex items-center justify-center gap-1"
            >
              <Download size={14} />
              下载
            </button>
            <button
              onClick={() => handleCopy('json')}
              className="flex-1 industrial-button-secondary text-sm py-2 flex items-center justify-center gap-1"
            >
              {copiedFormat === 'json' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              {copiedFormat === 'json' ? '已复制' : '复制'}
            </button>
          </div>
        </div>

        <div className="industrial-panel p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="text-emerald-400" size={20} />
            <span className="font-semibold">文本格式</span>
          </div>
          <p className="text-xs text-industrial-muted mb-3">
            "人话版"可读报告，适合老师复盘和后续人员查看
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => handleDownload('text')}
              className="flex-1 industrial-button-secondary text-sm py-2 flex items-center justify-center gap-1"
            >
              <Download size={14} />
              下载
            </button>
            <button
              onClick={() => handleCopy('text')}
              className="flex-1 industrial-button-secondary text-sm py-2 flex items-center justify-center gap-1"
            >
              {copiedFormat === 'text' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              {copiedFormat === 'text' ? '已复制' : '复制'}
            </button>
          </div>
        </div>
      </div>

      <div className="industrial-panel p-4">
        <h5 className="text-sm font-semibold text-industrial-muted mb-2">文本报告预览</h5>
        <div className="bg-industrial-bg p-3 rounded max-h-60 overflow-y-auto scrollbar-thin font-mono text-xs whitespace-pre-wrap text-industrial-text">
          {report.humanReadableSummary}
        </div>
      </div>
    </div>
  );
};
