import React, { useState, useEffect } from 'react';
import { History, Play, Trash2, Trophy, XCircle, Calendar } from 'lucide-react';
import { ReplayData } from '../game/types';
import { useGameStore } from '../game/state';

export const HistorySection: React.FC = () => {
  const { startReplay } = useGameStore();
  const [replays, setReplays] = useState<ReplayData[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('firstAidReplays');
    if (saved) {
      setReplays(JSON.parse(saved));
    }
  }, []);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const clearHistory = () => {
    if (confirm('确定要清空所有历史记录吗？')) {
      localStorage.removeItem('firstAidReplays');
      setReplays([]);
    }
  };

  return (
    <div id="history-section" className="py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <History className="w-8 h-8 text-primary-600" />
            <h2 className="text-2xl font-bold text-gray-800">历史记录</h2>
          </div>
          {replays.length > 0 && (
            <button
              onClick={clearHistory}
              className="flex items-center gap-2 text-sm text-red-500 hover:text-red-600"
            >
              <Trash2 className="w-4 h-4" />
              清空记录
            </button>
          )}
        </div>

        {replays.length === 0 ? (
          <div className="game-card p-8 text-center">
            <div className="text-4xl mb-4">📭</div>
            <p className="text-gray-500">暂无游戏记录，快去完成一局游戏吧！</p>
          </div>
        ) : (
          <div className="space-y-4">
            {replays.map((replay, index) => (
              <div key={index} className="game-card p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {replay.isWin ? (
                        <Trophy className="w-6 h-6 text-yellow-500" />
                      ) : (
                        <XCircle className="w-6 h-6 text-gray-400" />
                      )}
                      <h3 className="font-bold text-gray-800">{replay.levelName}</h3>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${replay.isWin ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}>
                        {replay.isWin ? '胜利' : '失败'}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-3">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(replay.timestamp)}
                      </div>
                      <div>⏱️ {formatDuration(replay.duration)}</div>
                      <div>🏆 {replay.finalScore.total} 分</div>
                    </div>

                    {!replay.isWin && replay.failReason && (
                      <p className="text-sm text-red-500">失败原因: {replay.failReason}</p>
                    )}
                  </div>

                  <button
                    onClick={() => startReplay(replay)}
                    className="game-btn-primary flex items-center gap-2 text-sm"
                  >
                    <Play className="w-4 h-4" />
                    回放
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
