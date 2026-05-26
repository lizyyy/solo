import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Download, RotateCcw, Home, AlertTriangle, CheckCircle, XCircle, Play } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { generateSummaryReport, exportGameReport } from '../utils/export';
import { getFinalEvaluation } from '../engine/rules';

export default function ResultPage() {
  const navigate = useNavigate();
  const gameState = useGameStore();

  const hasGameData = gameState.racks.length > 0 && gameState.gamePhase !== 'playing' && gameState.gamePhase !== 'paused';

  const evaluation = useMemo(() => {
    if (!hasGameData) return null;
    return getFinalEvaluation(
      gameState.turnState.score,
      gameState.totalTurns,
      gameState.turnState.turn - 1,
      gameState.racks,
      gameState.turnState.totalCost,
      gameState.turnState.budget,
    );
  }, [gameState, hasGameData]);

  const summary = useMemo(() => {
    if (!hasGameData) return null;
    return generateSummaryReport(gameState);
  }, [gameState, hasGameData]);

  const gradeColors: Record<string, string> = {
    S: 'from-yellow-400 to-orange-500',
    A: 'from-green-400 to-cyan-500',
    B: 'from-blue-400 to-cyan-500',
    C: 'from-slate-400 to-slate-500',
    D: 'from-red-400 to-orange-500',
  };

  if (!hasGameData) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center px-4">
        <div className="text-center">
          <AlertTriangle size={48} className="text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">暂无游戏数据</h2>
          <p className="text-slate-400 mb-6">请先完成一局游戏后查看结算报告</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold rounded-xl transition-colors"
          >
            返回主菜单
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center px-4 py-8">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <div className={`inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-b ${gradeColors[evaluation!.grade]} mb-4 shadow-lg`}>
            <span className="text-5xl font-black text-slate-900">{evaluation!.grade}</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">
            {gameState.gamePhase === 'won' ? (
              <span className="text-green-400 flex items-center justify-center gap-2">
                <CheckCircle /> 挑战成功！
              </span>
            ) : (
              <span className="text-red-400 flex items-center justify-center gap-2">
                <XCircle /> 挑战失败
              </span>
            )}
          </h1>
          {gameState.failReason && (
            <p className="text-red-300 flex items-center justify-center gap-2">
              <AlertTriangle size={16} />
              {gameState.failReason}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-slate-800/50 rounded-xl p-6 text-center border border-slate-700/50">
            <div className="text-slate-400 text-sm mb-2">最终得分</div>
            <div className="text-4xl font-bold text-cyan-400 flex items-center justify-center gap-2">
              <Trophy />
              {gameState.turnState.score}
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-6 text-center border border-slate-700/50">
            <div className="text-slate-400 text-sm mb-2">累计电费</div>
            <div className="text-4xl font-bold text-green-400">
              ¥{gameState.turnState.totalCost.toFixed(0)}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              预算 ¥{gameState.turnState.budget.toFixed(0)} ({((gameState.turnState.totalCost / gameState.turnState.budget) * 100).toFixed(0)}%)
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden mb-6">
          <div className="p-4 border-b border-slate-700/50">
            <h2 className="text-lg font-bold text-slate-200">详细统计</h2>
          </div>
          <div className="divide-y divide-slate-700/30">
            {summary!.sections.map((section, idx) => (
              <div key={idx} className="p-4">
                <h3 className="text-sm text-slate-400 mb-3">{section.title}</h3>
                <div className="grid grid-cols-2 gap-2">
                  {section.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-slate-500">{item.label}</span>
                      <span className="text-slate-200 font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4 mb-6">
          <h3 className="text-sm text-slate-400 mb-3">评价</h3>
          <div className="space-y-2">
            {evaluation!.comments.map((comment, i) => (
              <p key={i} className="text-slate-300 text-sm flex items-start gap-2">
                <span className="text-cyan-400 mt-1">•</span>
                {comment}
              </p>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => exportGameReport(gameState)}
            className="w-full flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold py-3 rounded-xl transition-colors"
          >
            <Download size={18} />
            导出运行报告 (CSV)
          </button>
          <button
            onClick={() => navigate(`/replay/${gameState.gameId}`)}
            className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold py-3 rounded-xl transition-colors"
          >
            <Play size={18} />
            查看历史回放
          </button>
          <div className="flex gap-3">
            <button
              onClick={() => navigate(`/game/${gameState.levelId}`)}
              className="flex-1 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold py-3 rounded-xl transition-colors"
            >
              <RotateCcw size={18} />
              重新开始
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex-1 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold py-3 rounded-xl transition-colors"
            >
              <Home size={18} />
              返回主菜单
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
