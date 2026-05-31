import { Upload, Download, RefreshCw } from 'lucide-react';

interface BatchActionsProps {
  onImport: () => void;
  onExport: () => void;
  onReset: () => void;
}

export function BatchActions({ onImport, onExport, onReset }: BatchActionsProps) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onImport}
        className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
      >
        <Upload className="w-4 h-4" />
        导入数据
      </button>
      <button
        onClick={onExport}
        className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
      >
        <Download className="w-4 h-4" />
        导出全部
      </button>
      <button
        onClick={onReset}
        className="flex items-center gap-2 px-4 py-2 bg-white text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-700 transition-colors"
      >
        <RefreshCw className="w-4 h-4" />
        重置示例
      </button>
    </div>
  );
}
