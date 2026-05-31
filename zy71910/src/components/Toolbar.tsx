import { Undo2, Redo2, CheckSquare, Download, History } from 'lucide-react';
import { useAppStore } from '../store';
import { useNavigate } from 'react-router-dom';

interface ToolbarProps {
  onBatchConfirm?: () => void;
  onExport?: () => void;
}

export function Toolbar({ onBatchConfirm, onExport }: ToolbarProps) {
  const { undo, redo, history, historyIndex, segments, currentTrack } = useAppStore();
  const navigate = useNavigate();

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;
  const pendingCount = segments.filter(s => s.status === 'pending').length;
  const confirmedCount = segments.filter(s => s.status === 'confirmed').length;

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 pr-3 border-r border-slate-200">
          <button
            onClick={undo}
            disabled={!canUndo}
            className={`p-2 rounded-lg transition-colors ${
              canUndo 
                ? 'hover:bg-slate-100 text-slate-600' 
                : 'text-slate-300 cursor-not-allowed'
            }`}
            title={canUndo ? `撤回：${history[historyIndex]?.description}` : '没有可撤回的操作'}
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className={`p-2 rounded-lg transition-colors ${
              canRedo 
                ? 'hover:bg-slate-100 text-slate-600' 
                : 'text-slate-300 cursor-not-allowed'
            }`}
            title="重做"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {currentTrack && (
          <span className="text-sm text-slate-500 ml-3">
            当前：<span className="text-slate-700 font-medium">{currentTrack.name}</span>
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-4 text-xs text-slate-500 mr-4">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            待确认 {pendingCount}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            已确认 {confirmedCount}
          </span>
        </div>

        {pendingCount > 0 && (
          <button
            onClick={onBatchConfirm}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
          >
            <CheckSquare className="w-4 h-4" />
            全部确认
          </button>
        )}

        <button
          onClick={() => navigate('/history')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <History className="w-4 h-4" />
          历史
        </button>

        <button
          onClick={onExport}
          disabled={confirmedCount === 0}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
            confirmedCount > 0
              ? 'text-white bg-sky-500 hover:bg-sky-600'
              : 'text-slate-400 bg-slate-100 cursor-not-allowed'
          }`}
        >
          <Download className="w-4 h-4" />
          导出
        </button>
      </div>
    </div>
  );
}
