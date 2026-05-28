import React, { useState, useEffect } from 'react';
import type { GameHistory, GameState } from '../types/game';
import { loadGameHistory, loadFullGameRecord, downloadGameReport } from '../utils/storage';
import { calculateGameStats } from '../utils/gameLogic';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose }) => {
  const [history, setHistory] = useState<GameHistory>({ games: [] });
  const [selectedGame, setSelectedGame] = useState<GameState | null>(null);

  useEffect(() => {
    if (isOpen && !selectedGame) {
      setHistory(loadGameHistory());
    }
  }, [isOpen, selectedGame]);

  const handleLoadGame = (gameId: string) => {
    const game = loadFullGameRecord(gameId);
    if (game) {
      setSelectedGame(game);
    }
  };

  const handleBackToList = () => {
    setSelectedGame(null);
    setHistory(loadGameHistory());
  };

  const handleClose = () => {
    setSelectedGame(null);
    onClose();
  };

  if (!isOpen) return null;

  if (selectedGame) {
    const stats = calculateGameStats(selectedGame);
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
            <button
              onClick={handleBackToList}
              className="text-sm text-blue-600 hover:underline flex items-center gap-1"
            >
              ← 返回列表
            </button>
            <h2 className="text-lg font-bold text-gray-800">历史对局详情</h2>
            <button
              onClick={handleClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
            >
              ✕
            </button>
          </div>
          <div className="p-4">
            <div className="text-center mb-6">
              <p className="text-sm text-gray-500">
                游戏ID: {selectedGame.gameId}
              </p>
              <p className="text-sm text-gray-500">
                {new Date(selectedGame.createdAt).toLocaleString()}
              </p>
              <p className="text-4xl font-bold mt-2">
                {stats.isWin ? '🎉 经营成功' : '😢 经营结束'}
              </p>
              {selectedGame.gameOverReason && (
                <p className="text-sm text-gray-500 mt-1">{selectedGame.gameOverReason}</p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <p className="text-sm text-gray-500">最终现金</p>
                <p className="text-2xl font-bold text-gray-800">¥{selectedGame.cash}</p>
              </div>
              <div className={`p-4 rounded-lg text-center ${stats.profit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <p className="text-sm text-gray-500">总利润</p>
                <p className={`text-2xl font-bold ${stats.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ¥{stats.profit}
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <p className="text-sm text-gray-500">经营天数</p>
                <p className="text-2xl font-bold text-gray-800">{selectedGame.day - 1}天</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-xs text-blue-600 mb-1">总营收</p>
                <p className="text-2xl font-bold text-blue-700">¥{stats.totalRevenue}</p>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <p className="text-xs text-orange-600 mb-1">总投入</p>
                <p className="text-2xl font-bold text-orange-700">¥{stats.totalCost}</p>
              </div>
            </div>

            {stats.bestSelling && stats.bestSelling.sold > 0 && (
              <div className="mb-4">
                <h4 className="font-medium text-gray-700 mb-2">🏆 最畅销唱片</h4>
                <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <img
                    src={stats.bestSelling.record.imageUrl}
                    alt={stats.bestSelling.record.title}
                    className="w-12 h-12 rounded object-cover"
                  />
                  <div>
                    <p className="font-medium">{stats.bestSelling.record.title}</p>
                    <p className="text-sm text-gray-500">
                      售出 {stats.bestSelling.sold} 张
                    </p>
                  </div>
                </div>
              </div>
            )}

            <h3 className="font-bold text-gray-800 mb-3">📊 每日经营数据</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {selectedGame.dailyReports.map((report, idx) => (
                <div key={idx} className="bg-gray-50 p-3 rounded-lg text-sm">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">第 {report.day} 天</span>
                    <span className={report.endingCash >= report.startingCash ? 'text-green-600' : 'text-red-600'}>
                      ¥{report.startingCash} → ¥{report.endingCash}
                    </span>
                  </div>
                  <div className="flex gap-4 mt-1 text-gray-500 text-xs">
                    <span>销售 {report.sales.length} 笔</span>
                    <span>进货 {report.purchases.length} 种</span>
                    <span>到访 {report.customerVisits.length} 人</span>
                  </div>
                  {report.events.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <p className="text-xs text-gray-500 mb-1">关键事件:</p>
                      {report.events.slice(0, 3).map((event, eidx) => (
                        <p key={eidx} className="text-xs text-gray-600 pl-2">
                          • {event.message}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => downloadGameReport(selectedGame)}
                className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
              >
                📥 导出完整报告
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">📜 历史对局</h2>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            ✕
          </button>
        </div>
        <div className="p-4">
          {history.games.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">📭</p>
              <p className="text-gray-500">暂无历史记录</p>
              <p className="text-sm text-gray-400 mt-1">完成一局游戏后记录会保存到这里</p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.games.map((game) => (
                <div
                  key={game.gameId}
                  className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-all"
                  onClick={() => handleLoadGame(game.gameId)}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-sm text-gray-500">
                        {new Date(game.date).toLocaleString()}
                      </span>
                      <p className="text-xs text-gray-400 mt-0.5">ID: {game.gameId.slice(0, 8)}...</p>
                    </div>
                    <span className={`text-sm font-medium ${game.isWin ? 'text-green-600' : 'text-red-600'}`}>
                      {game.isWin ? '✅ 成功' : '❌ 失败'}
                    </span>
                  </div>
                  <div className="flex justify-between mt-2">
                    <span className="font-medium">最终现金: ¥{game.finalCash}</span>
                    <span className={game.profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                      利润: ¥{game.profit}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">经营 {game.totalDays} 天</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
