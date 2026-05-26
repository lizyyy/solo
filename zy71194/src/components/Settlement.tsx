import React from 'react';
import { Trophy, XCircle, Home, RotateCcw, Download, Play } from 'lucide-react';
import { useGameStore } from '../game/state';

export const Settlement: React.FC = () => {
  const { status, isWin, failReason, score, turn, maxTurns, team, exportReport, goToMenu, restartGame, replayData } = useGameStore();

  if (status !== 'settlement') return null;

  const handleExport = () => {
    const report = exportReport();
    const blob = new Blob([report], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `game-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const scoreItems = [
    { label: '基础分', value: score.baseScore, color: 'text-gray-700' },
    { label: '时间奖励', value: `+${score.timeBonus}`, color: 'text-green-600' },
    { label: '生命值奖励', value: `+${score.healthBonus}`, color: 'text-green-600' },
    { label: '负重奖励', value: `+${score.inventoryBonus}`, color: 'text-green-600' },
    { label: '无过期奖励', value: `+${score.noExpiredBonus}`, color: 'text-green-600' },
    { label: '补给点奖励', value: `+${score.supplyVisitedBonus}`, color: 'text-green-600' },
    { label: '事件选择奖励', value: `+${score.eventChoicesBonus}`, color: 'text-green-600' },
  ];

  const totalPenalties = score.penalties.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="game-card max-w-lg w-full my-8">
        <div className={`p-6 text-center ${isWin ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gradient-to-r from-gray-600 to-gray-700'} text-white`}>
          {isWin ? (
            <>
              <Trophy className="w-16 h-16 mx-auto mb-3 text-yellow-300" />
              <h2 className="text-3xl font-bold">🎉 任务完成!</h2>
              <p className="opacity-90 mt-1">你成功带领队伍到达了终点</p>
            </>
          ) : (
            <>
              <XCircle className="w-16 h-16 mx-auto mb-3 text-red-300" />
              <h2 className="text-3xl font-bold">💔 任务失败</h2>
              <p className="opacity-90 mt-1">{failReason}</p>
            </>
          )}
        </div>

        <div className="p-6">
          <div className="text-center mb-6">
            <div className="text-5xl font-bold text-primary-600 mb-2">{score.total}</div>
            <div className="text-gray-500">最终得分</div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-bold text-gray-700 mb-3">📊 得分明细</h3>
            <div className="space-y-2">
              {scoreItems.map((item, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span className="text-gray-600">{item.label}</span>
                  <span className={`font-medium ${item.color}`}>{item.value}</span>
                </div>
              ))}
              {totalPenalties > 0 && (
                <div className="flex justify-between text-sm text-red-500">
                  <span>扣分</span>
                  <span className="font-medium">-{totalPenalties}</span>
                </div>
              )}
              <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between font-bold">
                <span>总分</span>
                <span className="text-primary-600">{score.total}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6 text-center text-sm">
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-blue-600 font-bold text-lg">{turn}/{maxTurns}</div>
              <div className="text-gray-500">使用回合</div>
            </div>
            <div className="bg-red-50 rounded-lg p-3">
              <div className="text-red-600 font-bold text-lg">{team.health}%</div>
              <div className="text-gray-500">剩余生命</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <div className="text-green-600 font-bold text-lg">
                {isWin ? '✅' : '❌'}
              </div>
              <div className="text-gray-500">完成状态</div>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={restartGame}
              className="w-full game-btn-primary flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-5 h-5" />
              重新挑战
            </button>

            <button
              onClick={handleExport}
              className="w-full game-btn-secondary flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5" />
              导出结算报告
            </button>

            {replayData && (
              <button
                onClick={() => {}}
                className="w-full game-btn-secondary flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5" />
                观看回放 (开发中)
              </button>
            )}

            <button
              onClick={goToMenu}
              className="w-full game-btn-secondary flex items-center justify-center gap-2"
            >
              <Home className="w-5 h-5" />
              返回主菜单
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
