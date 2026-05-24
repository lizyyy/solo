import { useState } from 'react';
import { Trophy, XCircle, Download, RotateCcw, Play, BarChart3, Clock, Users, Zap, X } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';

export function ResultModal() {
  const { status, score, scoreBreakdown, defeatReason, turn, maxTurns, history, exportReport, restartGame } = useGameStore();
  const [showReplay, setShowReplay] = useState(false);
  const [replayTurn, setReplayTurn] = useState(0);

  const isVictory = status === 'victory';
  const isDefeat = status === 'defeat';

  if (!isVictory && !isDefeat) return null;

  const handleExport = () => {
    const report = exportReport();
    const blob = new Blob([report], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `grid-repair-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const scoreItems = [
    { label: '特级保障用户', value: scoreBreakdown.criticalUsers, color: 'text-red-400' },
    { label: '重要用户', value: scoreBreakdown.importantUsers, color: 'text-orange-400' },
    { label: '普通用户', value: scoreBreakdown.normalUsers, color: 'text-green-400' },
    { label: '速度奖励', value: scoreBreakdown.speedBonus, color: 'text-blue-400' },
    { label: '难度加成', value: scoreBreakdown.difficultyBonus, color: 'text-purple-400' },
    { label: '处罚扣除', value: scoreBreakdown.penalties, color: 'text-red-500' }
  ];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl border border-slate-600 shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className={`p-6 rounded-t-xl ${isVictory ? 'bg-gradient-to-r from-green-600 to-emerald-600' : 'bg-gradient-to-r from-red-600 to-rose-600'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {isVictory ? (
                <Trophy className="w-12 h-12 text-yellow-300" />
              ) : (
                <XCircle className="w-12 h-12 text-white" />
              )}
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {isVictory ? '任务完成！' : '任务失败'}
                </h2>
                <p className="text-white/80 text-sm">
                  {isVictory ? '恭喜！你成功恢复了电网供电！' : defeatReason}
                </p>
              </div>
            </div>
            <button
              className="p-2 rounded-full hover:bg-white/20 text-white transition-colors"
              onClick={restartGame}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="text-center mb-6">
            <div className="text-5xl font-bold text-yellow-400 mb-2">
              {score.toLocaleString()}
            </div>
            <div className="text-slate-400">最终得分</div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <Clock className="w-5 h-5 text-blue-400 mx-auto mb-1" />
              <div className="text-xl font-bold text-white">{turn}</div>
              <div className="text-xs text-slate-400">使用回合</div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <Users className="w-5 h-5 text-green-400 mx-auto mb-1" />
              <div className="text-xl font-bold text-white">
                {Math.round((history.length > 0 ? history[history.length - 1]?.score : score) / 10)}%
              </div>
              <div className="text-xs text-slate-400">恢复率</div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <Zap className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
              <div className="text-xl font-bold text-white">{history.length}</div>
              <div className="text-xs text-slate-400">操作记录</div>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-slate-400" />
              <span className="text-white font-medium">评分明细</span>
            </div>
            <div className="space-y-2">
              {scoreItems.map((item, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">{item.label}</span>
                  <span className={`font-mono ${item.color}`}>
                    {item.value >= 0 ? '+' : ''}{Math.round(item.value).toLocaleString()}
                  </span>
                </div>
              ))}
              <div className="border-t border-slate-600 pt-2 flex items-center justify-between">
                <span className="text-white font-medium">总计</span>
                <span className="text-xl font-bold text-yellow-400">{score.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {showReplay && (
            <div className="mb-6 bg-slate-700/30 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-white font-medium">历史回放</span>
                <span className="text-slate-400 text-sm">回合 {replayTurn + 1}</span>
              </div>
              <input
                type="range"
                min="0"
                max={Math.max(0, history.length - 1)}
                value={replayTurn}
                onChange={(e) => setReplayTurn(parseInt(e.target.value))}
                className="w-full mb-3"
              />
              {history[replayTurn] && (
                <div className="text-xs text-slate-400 space-y-1">
                  <div>天气: {history[replayTurn].weather.description}</div>
                  <div>得分: {history[replayTurn].score}</div>
                  <div>操作数: {history[replayTurn].actions.length}</div>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button
              className="flex-1 py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
              onClick={() => setShowReplay(!showReplay)}
            >
              <Play className="w-4 h-4" />
              {showReplay ? '隐藏回放' : '查看回放'}
            </button>
            <button
              className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
              onClick={handleExport}
            >
              <Download className="w-4 h-4" />
              导出报告
            </button>
            <button
              className="flex-1 py-3 px-4 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
              onClick={restartGame}
            >
              <RotateCcw className="w-4 h-4" />
              重新开始
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
