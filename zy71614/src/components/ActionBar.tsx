import { Save, Undo2, History, Download, Loader2 } from 'lucide-react';

interface ActionBarProps {
  onSave: () => void;
  onWithdraw: () => void;
  onHistory: () => void;
  onExport?: () => void;
  showExport?: boolean;
  saving?: boolean;
}

export default function ActionBar({ onSave, onWithdraw, onHistory, onExport, showExport, saving }: ActionBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 px-6 py-3 flex items-center justify-end gap-3 z-40">
      <button
        onClick={onHistory}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-zinc-600 rounded-lg hover:bg-zinc-100 transition-colors"
      >
        <History size={16} />
        历史
      </button>
      <button
        onClick={onWithdraw}
        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-zinc-700 border border-zinc-300 rounded-lg hover:bg-zinc-50 shadow-sm hover:shadow transition-all"
      >
        <Undo2 size={16} />
        撤回
      </button>
      {showExport && onExport && (
        <button
          onClick={onExport}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg shadow-sm hover:shadow-md transition-all"
          style={{ backgroundColor: '#10b981' }}
        >
          <Download size={16} />
          导出Excel
        </button>
      )}
      <button
        onClick={onSave}
        disabled={saving}
        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg shadow-sm hover:shadow-md transition-all disabled:opacity-60"
        style={{ backgroundColor: '#1e3a5f' }}
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        保存
      </button>
    </div>
  );
}
