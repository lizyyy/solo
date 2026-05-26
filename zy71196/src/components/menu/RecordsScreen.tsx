import { useState } from 'react';
import { loadGameRecords, deleteGameRecord, clearGameRecords } from '../../game/replay';
import type { GameRecord } from '../../game/types';
import { getScoreGrade } from '../../game/scoring';

interface RecordsScreenProps {
  onBack: () => void;
  onViewReplay: (record: GameRecord) => void;
}

export function RecordsScreen({ onBack, onViewReplay }: RecordsScreenProps) {
  const [records, setRecords] = useState<GameRecord[]>(loadGameRecords());
  const [confirmClear, setConfirmClear] = useState(false);

  const handleDelete = (id: string) => {
    deleteGameRecord(id);
    setRecords(loadGameRecords());
  };

  const handleClearAll = () => {
    clearGameRecords();
    setRecords([]);
    setConfirmClear(false);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">历史记录</h1>
            <p className="text-slate-400">查看过往游戏记录和回放</p>
          </div>
          <div className="flex gap-3">
            {records.length > 0 && (
              <button
                onClick={() => setConfirmClear(true)}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
              >
                清空记录
              </button>
            )}
            <button
              onClick={onBack}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              返回主菜单
            </button>
          </div>
        </div>

        {confirmClear && (
          <div className="bg-red-900/30 border border-red-800 rounded-xl p-6 mb-6">
            <p className="text-red-300 mb-4">确定要清空所有历史记录吗？此操作不可撤销。</p>
            <div className="flex gap-3">
              <button
                onClick={handleClearAll}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
              >
                确认清空
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        )}

        {records.length === 0 ? (
          <div className="bg-slate-800 rounded-xl p-12 text-center">
            <p className="text-slate-400 text-lg">暂无游戏记录</p>
            <p className="text-slate-500 mt-2">完成游戏后记录将显示在这里</p>
          </div>
        ) : (
          <div className="space-y-4">
            {records
              .sort((a, b) => b.timestamp - a.timestamp)
              .map((record) => {
                const { grade, color } = getScoreGrade(record.score);
                return (
                  <div
                    key={record.id}
                    className="bg-slate-800 rounded-xl p-6 border border-slate-700"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-slate-700">
                          <span className={`text-2xl font-bold ${color}`}>{grade}</span>
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-white mb-1">
                            {record.levelName}
                          </h3>
                          <p className="text-slate-400 text-sm">
                            {formatDate(record.timestamp)}
                          </p>
                          <div className="flex items-center gap-4 mt-2">
                            <span className="text-yellow-400 font-bold">
                              {record.score} 分
                            </span>
                            <span className="text-slate-400 text-sm">
                              {record.completedRounds}/{record.totalRounds} 回合
                            </span>
                            {record.failed ? (
                              <span className="text-red-400 text-sm">任务失败</span>
                            ) : (
                              <span className="text-green-400 text-sm">任务完成</span>
                            )}
                            {record.leakCount > 0 && (
                              <span className="text-red-400 text-sm">
                                {record.leakCount} 处漏水
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => onViewReplay(record)}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                        >
                          查看回放
                        </button>
                        <button
                          onClick={() => handleDelete(record.id)}
                          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
