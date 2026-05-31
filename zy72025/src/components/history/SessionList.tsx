import { useState } from 'react';
import { Play, Trash2, Search, Clock, User, AlertCircle, Award, ChevronRight } from 'lucide-react';
import type { GameSession } from '@/types';
import { STATUS_LABELS, STATUS_COLORS } from '@/types';
import { formatDateTime } from '@/utils/helpers';

interface SessionListProps {
  sessions: GameSession[];
  selectedSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
  onPlay: (sessionId: string) => void;
  isLoading?: boolean;
}

export function SessionList({
  sessions,
  selectedSessionId,
  onSelect,
  onDelete,
  onPlay,
  isLoading = false,
}: SessionListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const filteredSessions = sessions.filter((session) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      session.playerName.toLowerCase().includes(query) ||
      (session.levelName?.toLowerCase() || '').includes(query)
    );
  });

  const handleDelete = (sessionId: string) => {
    if (deleteConfirmId === sessionId) {
      onDelete(sessionId);
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(sessionId);
      setTimeout(() => setDeleteConfirmId(null), 3000);
    }
  };

  if (sessions.length === 0) {
    return (
      <div className="card">
        <div className="text-center py-12 text-white/50">
          <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg mb-2">暂无历史记录</p>
          <p className="text-sm">完成游戏后会在这里显示</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-accent-400">历史记录</h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索玩家或关卡..."
            className="pl-10 pr-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 w-64"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-white/50">加载中...</div>
      ) : filteredSessions.length === 0 ? (
        <div className="text-center py-8 text-white/50">没有找到匹配的记录</div>
      ) : (
        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
          {filteredSessions.map((session) => {
            const isSelected = selectedSessionId === session.id;
            const score = session.scoreResult;
            const scorePercent = score ? Math.round((score.totalScore / score.maxScore) * 100) : null;

            return (
              <div
                key={session.id}
                className={`p-4 rounded-lg border transition-all cursor-pointer group ${
                  isSelected
                    ? 'bg-accent-500/20 border-accent-500'
                    : 'bg-white/5 border-white/10 hover:border-white/30'
                }`}
                onClick={() => onSelect(session.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <User className="w-4 h-4 text-accent-400 shrink-0" />
                      <span className="font-medium text-white truncate">
                        {session.playerName}
                      </span>
                      <span
                        className={`w-2 h-2 rounded-full ${STATUS_COLORS[session.status]}`}
                      />
                      <span className="text-xs text-white/50">
                        {STATUS_LABELS[session.status]}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      <span className="text-white/60">{session.levelName}</span>
                      {score && (
                        <span className="text-accent-400 font-medium">
                          <Award className="w-3 h-3 inline mr-1" />
                          {score.totalScore}分 ({scorePercent}%
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-white/40">
                      <span>{formatDateTime(session.startTime)}</span>
                      <span>{session.stepHistory.length} 步</span>
                      {session.conflicts.length > 0 && (
                        <span className="text-warning-400">
                          <AlertCircle className="w-3 h-3 inline mr-1" />
                          {session.conflicts.length} 处冲突
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlay(session.id);
                      }}
                      className="p-2 rounded-lg bg-success-600/30 text-success-300 hover:bg-success-600/50 transition-colors"
                      title="回放"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(session.id);
                      }}
                      className={`p-2 rounded-lg transition-colors ${
                        deleteConfirmId === session.id
                          ? 'bg-danger-600 text-white'
                          : 'bg-danger-600/30 text-danger-300 hover:bg-danger-600/50'
                      }`}
                      title={deleteConfirmId === session.id ? '再次点击确认删除' : '删除'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <ChevronRight className="w-5 h-5 text-white/30" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
