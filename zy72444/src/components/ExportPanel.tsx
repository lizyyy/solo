import { useState } from 'react';
import { Download, FileJson, FileSpreadsheet, Check, Copy } from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import type { ExportBundle } from '@/types';

interface ExportPanelProps {
  batchId: string;
  batchName: string;
}

export default function ExportPanel({ batchId, batchName }: ExportPanelProps) {
  const { exportBundle, exportAttendanceCSV } = useAppStore();
  const [copied, setCopied] = useState(false);

  const safeName = batchName.replace(/[\\/:*?"<>|]/g, '_');

  const downloadJSON = () => {
    const bundle: ExportBundle = exportBundle(batchId);
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}·完整数据包·${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCSV = () => {
    const csv = '\uFEFF' + exportAttendanceCSV(batchId);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}·签到记录(含追溯ID)·${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyDedupKey = () => {
    const bundle = exportBundle(batchId);
    const lines = bundle.records.map((r) => `${r.id} | ${r.name} | ${r.dedupKey} | ${r.importSessionId || ''}`);
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="glass rounded-2xl p-5 border border-white/50">
      <div className="flex items-center gap-2 mb-4">
        <Download className="w-5 h-5 text-primary-600" />
        <h3 className="font-display font-semibold text-primary-900">导出与追溯</h3>
        <p className="ml-2 text-xs text-primary-400">导出文件与页面使用同一记录ID / 去重Key</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={downloadJSON}
          className="flex flex-col items-center gap-2 p-3 rounded-xl bg-primary-50 hover:bg-primary-100 transition-colors text-primary-700 border border-primary-100"
        >
          <FileJson className="w-5 h-5" />
          <span className="text-xs font-medium">完整数据包(JSON)</span>
          <span className="text-[10px] text-primary-500">含导入/变更/参数链路</span>
        </button>
        <button
          onClick={downloadCSV}
          className="flex flex-col items-center gap-2 p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 transition-colors text-emerald-700 border border-emerald-100"
        >
          <FileSpreadsheet className="w-5 h-5" />
          <span className="text-xs font-medium">签到表(CSV)</span>
          <span className="text-[10px] text-emerald-600">每行带记录ID/去重Key</span>
        </button>
        <button
          onClick={copyDedupKey}
          className="flex flex-col items-center gap-2 p-3 rounded-xl bg-accent-50 hover:bg-accent-100 transition-colors text-accent-700 border border-accent-100"
        >
          {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
          <span className="text-xs font-medium">{copied ? '已复制' : '复制追溯ID'}</span>
          <span className="text-[10px] text-accent-600">ID | 姓名 | 去重Key | 会话</span>
        </button>
      </div>
    </div>
  );
}
