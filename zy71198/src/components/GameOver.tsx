import { Trophy, XCircle, Download, RotateCcw, Clock } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { getScoreItemLabel, getScoreItemColor } from '@/utils/scoring';

export default function GameOver() {
  const { score, scoreBreakdown, lamps, failureReason, level, resetGame, startGame, exportReport } =
    useGameStore();

  const repaired = lamps.filter((l) => l.status === 'repaired').length;
  const timedOut = lamps.filter((l) => l.status === 'timeout').length;

  const getGrade = (): { grade: string; color: string; bgColor: string } => {
    if (score >= 900 && scoreBreakdown.timeoutPenalty === 0)
      return { grade: 'S', color: 'text-amber-400', bgColor: 'bg-amber-500/20' };
    if (score >= 750) return { grade: 'A', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' };
    if (score >= 600) return { grade: 'B', color: 'text-sky-400', bgColor: 'bg-sky-500/20' };
    if (score >= 450) return { grade: 'C', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' };
    return { grade: 'D', color: 'text-red-400', bgColor: 'bg-red-500/20' };
  };

  const gradeInfo = getGrade();

  const scoreItems = [
    { key: 'baseScore', label: '基础得分', value: scoreBreakdown.baseScore, positive: true },
    { key: 'priorityBonus', label: '优先级奖励', value: scoreBreakdown.priorityBonus, positive: true },
    { key: 'timeBonus', label: '提前完成奖励', value: scoreBreakdown.timeBonus, positive: true },
    { key: 'errorPenalty', label: '错误操作扣分', value: scoreBreakdown.errorPenalty, positive: false },
    { key: 'timeoutPenalty', label: '超时扣分', value: scoreBreakdown.timeoutPenalty, positive: false },
    { key: 'wastePenalty', label: '资源浪费扣分', value: scoreBreakdown.wastePenalty, positive: false },
  ];

  const handleExport = () => {
    const report = exportReport();
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `repair_report_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 max-w-md w-full p-6 shadow-2xl">
        <div className="text-center mb-6">
          <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full ${gradeInfo.bgColor} mb-4`}>
            <Trophy className={`w-10 h-10 ${gradeInfo.color}`} />
          </div>
          <h2 className={`text-4xl font-bold ${gradeInfo.color} mb-1`}>{gradeInfo.grade} 级</h2>
          <p className="text-3xl font-bold text-white mb-2">{score} 分</p>
          <p className="text-slate-400">关卡 {level} 结算</p>
        </div>

        <div className="bg-slate-700/50 rounded-lg p-4 mb-4">
          <h3 className="text-sm font-medium text-slate-400 mb-3">结算详情</h3>
          <div className="space-y-2">
            {scoreItems.map((item) => (
              <div key={item.key} className="flex items-center justify-between">
                <span className="text-sm text-slate-400">{item.label}</span>
                <span
                  className={`text-sm font-medium ${
                    item.positive ? getScoreItemColor(item.key, true) : getScoreItemColor(item.key, false)
                  }`}
                >
                  {item.positive ? '+' : '-'}{item.value}
                </span>
              </div>
            ))}
            <div className="border-t border-slate-600 pt-2 mt-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white">最终得分</span>
                <span className="text-lg font-bold text-emerald-400">{score}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-slate-700/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-emerald-400">{repaired}</div>
            <div className="text-xs text-slate-400">已维修</div>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-red-400">{timedOut}</div>
            <div className="text-xs text-slate-400">超时</div>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-slate-400">{lamps.length}</div>
            <div className="text-xs text-slate-400">总计</div>
          </div>
        </div>

        {failureReason && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <XCircle size={16} />
              <span>{failureReason}</span>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => startGame(level)}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-amber-500 text-slate-900 font-medium hover:bg-amber-400 transition-colors"
          >
            <RotateCcw size={18} />
            再玩一次
          </button>
          <button
            onClick={handleExport}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
          >
            <Download size={18} />
            导出
          </button>
        </div>

        <button
          onClick={resetGame}
          className="w-full mt-3 py-2 text-slate-500 hover:text-slate-300 text-sm transition-colors"
        >
          返回主菜单
        </button>
      </div>
    </div>
  );
}
