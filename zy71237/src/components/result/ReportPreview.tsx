import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Copy, Check } from 'lucide-react';
import { RestorationReport } from '../../types';
import { formatReportAsText } from '../../engine/gameEngine';

interface ReportPreviewProps {
  report: RestorationReport;
}

export function ReportPreview({ report }: ReportPreviewProps) {
  const [copied, setCopied] = useState(false);
  const [text, setText] = useState('');

  useEffect(() => {
    setText(formatReportAsText(report));
  }, [report]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-serif font-bold text-museum-paper flex items-center gap-2">
          <FileText size={20} className="text-museum-bronze" />
          修复报告预览
        </h3>
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-3 py-1.5 bg-museum-bronze/20 text-museum-bronzeLight rounded-lg text-sm hover:bg-museum-bronze/30 transition-colors"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? '已复制' : '复制'}
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-museum-ink rounded-lg p-4 max-h-[500px] overflow-auto scrollbar-thin"
      >
        <pre className="text-xs text-museum-paper/80 font-mono whitespace-pre leading-relaxed">
          {text}
        </pre>
      </motion.div>
    </div>
  );
}
