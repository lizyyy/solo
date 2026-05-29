import React, { useState } from 'react';
import { usePatternStore } from '@/store/patternStore';
import { History, Clock, User, RefreshCcw, AlertOctagon, ChevronDown, ChevronUp } from 'lucide-react';

export const HistoryPanel: React.FC = () => {
  const { history, restoreVersion, pattern } = usePatternStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const getTrackDiff = (snapshot: typeof pattern) => {
    const changes: string[] = [];
    if (snapshot.bpm !== pattern.bpm) {
      changes.push(`BPM: ${pattern.bpm} → ${snapshot.bpm}`);
    }
    if (snapshot.steps !== pattern.steps) {
      changes.push(`步数: ${pattern.steps} → ${snapshot.steps}`);
    }
    snapshot.tracks.forEach((track) => {
      const currentTrack = pattern.tracks.find((t) => t.id === track.id);
      if (currentTrack) {
        const noteCount = track.notes.filter((n) => n.isActive).length;
        const currentCount = currentTrack.notes.filter((n) => n.isActive).length;
        if (noteCount !== currentCount) {
          changes.push(`${track.name}: ${currentCount} → ${noteCount} 音符`);
        }
      }
    });
    return changes.slice(0, 5);
  };

  return (
    <div className="bg-dark-800 rounded-xl p-4 border border-dark-600 h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-neon-blue flex items-center gap-2">
          <History size={20} />
          版本历史
        </h2>
        <span className="text-xs text-gray-500">{history.length} 个版本</span>
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-thin">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-500">
            <History size={32} className="mb-2 opacity-50" />
            <p>暂无保存的版本</p>
            <p className="text-xs mt-1">点击保存按钮创建第一个版本</p>
          </div>
        ) : (
          history.map((version, index) => {
            const isExpanded = expandedId === version.id;
            const diff = getTrackDiff(version.snapshot);

            return (
              <div
                key={version.id}
                className={`rounded-lg border transition-all ${
                  version.isConflict
                    ? 'border-neon-red/30 bg-neon-red/5'
                    : 'border-dark-600 bg-dark-700/50 hover:border-dark-500'
                }`}
              >
                <div
                  className="p-3 cursor-pointer flex items-center justify-between"
                  onClick={() => toggleExpand(version.id)}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{
                        backgroundColor: index === 0 ? '#00F0FF' : '#32324A',
                        color: index === 0 ? '#0A0A0F' : '#888',
                      }}
                    >
                      {history.length - index}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{version.message}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {formatTime(version.timestamp)}
                        </span>
                        <span className="flex items-center gap-1">
                          <User size={12} />
                          {version.author}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {version.isConflict && (
                      <AlertOctagon size={14} className="text-neon-red animate-pulse" />
                    )}
                    {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-3 pb-3 pt-0 border-t border-dark-600">
                    {diff.length > 0 && (
                      <div className="py-2">
                        <p className="text-xs text-gray-500 mb-1">与当前版本差异:</p>
                        <ul className="text-xs text-gray-400 space-y-1">
                          {diff.map((change, i) => (
                            <li key={i} className="flex items-center gap-1">
                              <span className="text-neon-blue">•</span>
                              {change}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        restoreVersion(version.id);
                      }}
                      className="w-full mt-2 py-2 px-3 bg-dark-600 hover:bg-neon-blue hover:text-dark-900 rounded text-sm transition-colors flex items-center justify-center gap-2"
                    >
                      <RefreshCcw size={14} />
                      恢复此版本
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
