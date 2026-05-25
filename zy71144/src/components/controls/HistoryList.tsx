import { History, Trash2, Play, FileText } from 'lucide-react';
import type { TrainingSession } from '../../types';

interface HistoryListProps {
  sessions: TrainingSession[];
  currentSessionId: string | null;
  onLoad: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
}

export function HistoryList({
  sessions,
  currentSessionId,
  onLoad,
  onDelete,
}: HistoryListProps) {
  const sortedSessions = [...sessions].sort((a, b) => b.endTime - a.endTime);

  return (
    <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700">
      <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
        <History className="w-5 h-5 text-blue-400" />
        历史记录
        <span className="text-sm font-normal text-slate-400">({sessions.length})</span>
      </h3>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {sortedSessions.map((session) => {
          const isCurrent = session.id === currentSessionId;
          const date = new Date(session.endTime);

          return (
            <div
              key={session.id}
              className={`p-3 rounded-lg border transition-all ${
                isCurrent
                  ? 'bg-blue-500/20 border-blue-500/50'
                  : 'bg-slate-700/50 border-slate-600 hover:border-slate-500'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <span className="text-white text-sm font-medium truncate max-w-32">
                    {session.buildingName}
                  </span>
                </div>
                {isCurrent && (
                  <span className="text-xs bg-blue-500/30 text-blue-300 px-2 py-0.5 rounded">
                    当前
                  </span>
                )}
              </div>

              <div className="text-xs text-slate-400 mb-2">
                {date.toLocaleDateString('zh-CN')} {date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-300 mb-2">
                <span>{session.result.totalLength.toFixed(0)}m</span>
                <span className="text-slate-500">|</span>
                <span>{session.result.cornerCount}转角</span>
                <span className="text-slate-500">|</span>
                <span className={session.result.isValid ? 'text-green-400' : 'text-red-400'}>
                  {session.result.isValid ? '合格' : '不合格'}
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => onLoad(session.id)}
                  disabled={isCurrent}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs transition-all
                    disabled:opacity-50 disabled:cursor-not-allowed
                    bg-blue-600 hover:bg-blue-500 text-white"
                >
                  <Play className="w-3 h-3" />
                  {isCurrent ? '已加载' : '加载'}
                </button>
                <button
                  onClick={() => {
                    if (confirm('确定要删除这条记录吗？')) {
                      onDelete(session.id);
                    }
                  }}
                  className="flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs transition-all
                    bg-red-500/20 hover:bg-red-500/30 text-red-400"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
