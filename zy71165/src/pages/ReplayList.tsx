import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Play, Trophy, XCircle, Clock, ChevronRight } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { getFailureTypeLabel } from '../utils/report';

export const ReplayList: React.FC = () => {
  const navigate = useNavigate();
  const { gameRecords, loadRecords } = useGameStore();

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              📋 历史记录
            </h1>
            <p className="text-slate-400">查看过往游戏记录和操作回放</p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-slate-300 hover:text-white transition-all"
          >
            <Home className="w-5 h-5" />
            <span>返回首页</span>
          </button>
        </div>

        {gameRecords.length === 0 ? (
          <div className="bg-slate-800/80 rounded-2xl p-12 text-center border border-slate-700">
            <div className="text-6xl mb-4">🎮</div>
            <h3 className="text-xl font-semibold text-white mb-2">
              暂无游戏记录
            </h3>
            <p className="text-slate-400 mb-6">
              完成一局游戏后，记录将显示在这里
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-white font-medium transition-all"
            >
              开始游戏
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {gameRecords.map((record) => (
            <div
                key={record.id}
                onClick={() => navigate(`/replay/${record.id}`)}
                className="bg-slate-800/80 rounded-2xl p-6 border border-slate-700 hover:border-blue-500/50 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                        record.success
                          ? 'bg-gradient-to-br from-green-500 to-emerald-600'
                          : 'bg-gradient-to-br from-red-500 to-rose-600'
                      }`}
                    >
                      {record.success ? (
                        <Trophy className="w-8 h-8 text-white" />
                      ) : (
                        <XCircle className="w-8 h-8 text-white" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-xl font-bold text-white">
                          {record.levelName}
                        </h3>
                        {record.success && (
                          <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                            成功
                          </span>
                        )}
                        {!record.success && (
                          <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">
                            失败
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {formatDate(record.timestamp)}
                        </span>
                        <span className="text-yellow-400 font-mono font-bold">
                          得分: {record.score}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {record.settlementResult.failureReasons.length > 0 && (
                      <div className="text-right">
                        <div className="text-xs text-slate-500 mb-1">失败原因</div>
                        <div className="text-sm text-red-400">
                          {getFailureTypeLabel(
                            record.settlementResult.failureReasons[0].type
                          )}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-blue-400 group-hover:translate-x-1 transition-transform">
                      <span className="text-sm font-medium">查看回放</span>
                      <ChevronRight className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-700 grid grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-400 font-mono">
                      {record.settlementResult.report.isolatedLeaks.length}
                      <span className="text-sm text-slate-500">
                        /
                        {record.operations.length > 0
                          ? record.settlementResult.report.finalState.isolatedLeaks +
                            record.settlementResult.report.isolatedLeaks.length
                          : '?'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">已隔离漏点</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-400 font-mono">
                      {record.settlementResult.report.affectedUserAreas.length}
                    </div>
                    <div className="text-xs text-slate-500">受影响区域</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-400 font-mono">
                      {record.operations.length}
                    </div>
                    <div className="text-xs text-slate-500">操作步数</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-cyan-400 font-mono">
                      {Math.round(record.settlementResult.report.finalState.elapsedTime)}s
                    </div>
                    <div className="text-xs text-slate-500">用时</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
