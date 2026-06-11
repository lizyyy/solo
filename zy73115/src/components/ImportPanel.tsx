import React, { useState } from 'react';
import { Upload, RefreshCw, FileText, CheckCircle, XCircle, AlertTriangle, History, Trash2 } from 'lucide-react';
import { useReviewStore } from '../store/useReviewStore';

export const ImportPanel: React.FC = () => {
  const [isImporting, setIsImporting] = useState(false);
  const [lastResult, setLastResult] = useState<{
    added: number;
    skipped: number;
    collisions: number;
  } | null>(null);

  const { session, importDemoData, initDemoSession } = useReviewStore();

  const handleImportDemoData = async () => {
    setIsImporting(true);
    setLastResult(null);

    await new Promise(resolve => setTimeout(resolve, 800));

    const result = importDemoData();
    setLastResult(result);
    setIsImporting(false);
  };

  const handleResetData = () => {
    if (confirm('确定要重置所有数据吗？这将清除当前会话并重新加载演示数据。')) {
      localStorage.removeItem('review-session');
      initDemoSession();
      setLastResult(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!session) return null;

  return (
    <div className="p-4 bg-slate-900 border-b border-slate-700">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-blue-400" />
            <span className="text-sm font-medium text-slate-200">{session.name}</span>
          </div>
          <div className="text-xs text-slate-500 font-mono">
            图层: {session.layers.length} | 碰撞: {session.collisions.length} | 导入批次: {session.importHistory.length}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleImportDemoData}
            disabled={isImporting}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
          >
            {isImporting ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Upload size={14} />
            )}
            测试重复导入
          </button>

          <button
            onClick={handleResetData}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded transition-colors"
          >
            <Trash2 size={14} />
            重置数据
          </button>
        </div>
      </div>

      {lastResult && (
        <div className="mt-3 p-3 bg-slate-800/50 rounded border border-slate-600">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={16} className="text-green-400" />
            <span className="text-sm font-medium text-slate-200">导入完成</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="p-2 bg-green-500/10 rounded text-center">
              <div className="text-lg font-bold text-green-400">{lastResult.added}</div>
              <div className="text-[10px] text-green-400/80">新增图层</div>
            </div>
            <div className="p-2 bg-amber-500/10 rounded text-center">
              <div className="text-lg font-bold text-amber-400">{lastResult.skipped}</div>
              <div className="text-[10px] text-amber-400/80">重复跳过</div>
            </div>
            <div className="p-2 bg-blue-500/10 rounded text-center">
              <div className="text-lg font-bold text-blue-400">{lastResult.collisions}</div>
              <div className="text-[10px] text-blue-400/80">新增碰撞</div>
            </div>
          </div>
          {lastResult.skipped > 0 && (
            <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded text-xs text-amber-300 flex items-start gap-2">
              <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-medium">去重机制生效：</span>
                检测到 {lastResult.skipped} 个重复图层，已自动跳过。
                人工备注和已有状态均已保留，未被覆盖。
              </div>
            </div>
          )}
        </div>
      )}

      {session.importHistory.length > 0 && (
        <div className="mt-3">
          <div className="flex items-center gap-2 mb-2 text-xs text-slate-400">
            <History size={12} />
            导入历史
          </div>
          <div className="flex flex-wrap gap-2">
            {session.importHistory.map((record) => (
              <div
                key={record.batchId}
                className="px-2 py-1 bg-slate-800 rounded text-[10px] text-slate-400 font-mono border border-slate-700"
              >
                <div className="text-slate-300">{record.fileName}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span>{formatDate(record.importedAt)}</span>
                  <span className="text-green-400">+{record.layerCount}</span>
                  <span className="text-red-400">!{record.collisionCount}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
