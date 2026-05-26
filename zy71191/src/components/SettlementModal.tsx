import { useGameStore } from '@/store/gameStore';
import { LEVELS } from '@/data/levels';

interface Props {
  onGoToMenu?: () => void;
}

export default function SettlementModal({ onGoToMenu }: Props) {
  const state = useGameStore();

  const isVictory = state.inspections.every((i) => i.passed);
  const scoreBreakdown = state.scoreBreakdown;

  const getRating = (score: number) => {
    if (score >= 150) return { text: 'S', color: 'text-amber-400' };
    if (score >= 120) return { text: 'A', color: 'text-emerald-400' };
    if (score >= 80) return { text: 'B', color: 'text-sky-400' };
    if (score >= 50) return { text: 'C', color: 'text-slate-400' };
    return { text: 'D', color: 'text-red-400' };
  };

  const rating = getRating(scoreBreakdown.total);

  const getFailureReasons = () => {
    const reasons: string[] = [];
    if (!state.inspections[2].passed && !isVictory) {
      reasons.push('未能在限定回合内完成消防验收');
    }
    if (scoreBreakdown.inspectionPenalty < 0) {
      reasons.push(`验收失败 ${Math.abs(scoreBreakdown.inspectionPenalty / 15)} 次`);
    }
    if (scoreBreakdown.emergencyPenalty < 0) {
      reasons.push(`使用紧急补货 ${state.emergencyUsed} 次`);
    }
    if (scoreBreakdown.overtimePenalty < 0) {
      reasons.push(`超时 ${Math.abs(scoreBreakdown.overtimePenalty / 5)} 回合`);
    }
    return reasons;
  };

  const exportReport = () => {
    const report = {
      level: LEVELS.find((l) => l.id === state.currentLevel),
      timestamp: new Date().toISOString(),
      result: isVictory ? 'victory' : 'defeat',
      finalTurn: state.currentTurn,
      maxTurns: state.maxTurns,
      score: scoreBreakdown.total,
      scoreBreakdown,
      booths: state.booths.map((b) => ({
        name: b.name,
        utilitiesProgress: b.utilitiesProgress,
        structureProgress: b.structureProgress,
        fireSafetyProgress: b.fireSafetyProgress,
      })),
      history: state.history.length,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `exhibition-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const scoreItems = [
    { label: '按时完成', value: scoreBreakdown.onTimeBonus, positive: true },
    { label: '提前完成', value: scoreBreakdown.earlyCompletion, positive: true },
    { label: '验收一次通过', value: scoreBreakdown.firstTryPass, positive: true },
    { label: '材料无延误', value: scoreBreakdown.noDelayBonus, positive: true },
    { label: '无施工冲突', value: scoreBreakdown.noConflictBonus, positive: true },
    { label: '验收失败扣分', value: scoreBreakdown.inspectionPenalty, positive: false },
    { label: '紧急补货扣分', value: scoreBreakdown.emergencyPenalty, positive: false },
    { label: '超时扣分', value: scoreBreakdown.overtimePenalty, positive: false },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl border border-slate-600 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white text-center">
            {isVictory ? '🎉 项目成功！' : '⏰ 项目失败'}
          </h2>
          <div className="flex items-center justify-center mt-4">
            <span className={`text-6xl font-bold ${rating.color}`}>
              {rating.text}
            </span>
          </div>
          <div className="text-center mt-2">
            <span className="text-slate-400 text-sm">总得分</span>
            <span className={`text-2xl font-bold ml-2 ${isVictory ? 'text-emerald-400' : 'text-red-400'}`}>
              {scoreBreakdown.total}
            </span>
          </div>
        </div>

        <div className="p-6">
          <h3 className="text-sm font-semibold text-slate-400 mb-3">得分明细</h3>
          <div className="space-y-2">
            {scoreItems.map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-slate-300 text-sm">{item.label}</span>
                <span className={`font-mono text-sm ${item.positive ? (item.value > 0 ? 'text-emerald-400' : 'text-slate-500') : (item.value < 0 ? 'text-red-400' : 'text-slate-500')}`}>
                  {item.value > 0 ? `+${item.value}` : item.value}
                </span>
              </div>
            ))}
            <div className="border-t border-slate-700 pt-2 flex items-center justify-between">
              <span className="text-white font-semibold">总分</span>
              <span className={`font-mono font-bold text-lg ${isVictory ? 'text-emerald-400' : 'text-red-400'}`}>
                {scoreBreakdown.total}
              </span>
            </div>
          </div>

          {getFailureReasons().length > 0 && (
            <>
              <h3 className="text-sm font-semibold text-slate-400 mt-6 mb-3">失败原因</h3>
              <ul className="space-y-1">
                {getFailureReasons().map((reason, i) => (
                  <li key={i} className="text-sm text-red-400 flex items-start gap-2">
                    <span>•</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <h3 className="text-sm font-semibold text-slate-400 mt-6 mb-3">完成情况</h3>
          <div className="grid grid-cols-3 gap-2">
            {state.inspections.map((inspection) => {
              const labels: Record<string, string> = {
                utilities: '水电',
                structure: '展架',
                fire: '消防',
              };
              return (
                <div
                  key={inspection.type}
                  className={`p-3 rounded text-center ${
                    inspection.passed
                      ? 'bg-emerald-900/50 text-emerald-400'
                      : 'bg-slate-700/50 text-slate-400'
                  }`}
                >
                  <div className="text-xs">{labels[inspection.type]}</div>
                  <div className="text-lg">{inspection.passed ? '✓' : '✗'}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-6 border-t border-slate-700 flex gap-3">
          <button
            onClick={state.restartGame}
            className="flex-1 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded font-medium transition-all"
          >
            重新开始
          </button>
          <button
            onClick={() => {
              state.goToMenu();
              onGoToMenu?.();
            }}
            className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded font-medium transition-all"
          >
            返回菜单
          </button>
          <button
            onClick={exportReport}
            className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium transition-all"
          >
            导出报告
          </button>
        </div>
      </div>
    </div>
  );
}
