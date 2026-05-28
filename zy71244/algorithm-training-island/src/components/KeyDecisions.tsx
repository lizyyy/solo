import { useGame } from '../context/GameContext';
import type { KeyDecision } from '../types';

const decisionTypeNames: Record<KeyDecision['type'], string> = {
  activity: '训练安排',
  strategy: '战略决策',
  adjustment: '调整措施',
};

const decisionTypeIcons: Record<KeyDecision['type'], string> = {
  activity: '📋',
  strategy: '🎯',
  adjustment: '🔧',
};

const riskLevelColors: Record<KeyDecision['riskLevel'], string> = {
  low: 'bg-blue-900/50 border-blue-700 text-blue-400',
  medium: 'bg-yellow-900/50 border-yellow-700 text-yellow-400',
  high: 'bg-red-900/50 border-red-700 text-red-400',
};

const riskLevelNames: Record<KeyDecision['riskLevel'], string> = {
  low: '低',
  medium: '中',
  high: '高',
};

export const KeyDecisions: React.FC = () => {
  const { state } = useGame();

  const highRiskDecisions = state.keyDecisions.filter(d => d.riskLevel === 'high');
  const recentDecisions = state.keyDecisions.slice(-15).reverse();

  return (
    <div className="bg-slate-800/80 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
      <h2 className="text-xl font-bold text-white mb-4">🎯 关键决策</h2>

      {highRiskDecisions.length > 0 && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-red-400">⚠️</span>
            <span className="font-semibold text-white">高风险决策 ({highRiskDecisions.length})</span>
          </div>
          <div className="text-sm text-slate-300">
            {highRiskDecisions.length > 3 
              ? `共做出了 ${highRiskDecisions.length} 次高风险决策，请在结算页查看详细影响分析`
              : '最近有高风险决策，请注意风险控制'}
          </div>
        </div>
      )}

      <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
        {recentDecisions.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <div className="text-4xl mb-2">📝</div>
            <p>还没有关键决策记录</p>
            <p className="text-sm">开始训练后将记录关键决策</p>
          </div>
        ) : (
          recentDecisions.map((decision, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg border animate-slide-in ${riskLevelColors[decision.riskLevel]}`}
            >
              <div className="flex items-start gap-3">
                <div className="text-xl">{decisionTypeIcons[decision.type]}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-white">
                      {decision.description}
                    </span>
                    <span className={`badge ${
                      decision.riskLevel === 'high' ? 'badge-danger' : 
                      decision.riskLevel === 'medium' ? 'badge-warning' : 'badge-info'
                    }`}>
                      {riskLevelNames[decision.riskLevel]}风险
                    </span>
                  </div>
                  <p className="text-sm opacity-90">{decision.impact}</p>
                  <div className="mt-1 text-xs opacity-75">
                    第 {decision.day} 天 · {decisionTypeNames[decision.type]}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-slate-700 grid grid-cols-3 gap-4 text-center text-sm">
        <div>
          <div className="text-2xl font-bold text-blue-400">
            {state.keyDecisions.filter(d => d.type === 'activity').length}
          </div>
          <div className="text-slate-400">训练安排</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-purple-400">
            {state.keyDecisions.filter(d => d.type === 'strategy').length}
          </div>
          <div className="text-slate-400">战略决策</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-orange-400">
            {state.keyDecisions.filter(d => d.type === 'adjustment').length}
          </div>
          <div className="text-slate-400">调整措施</div>
        </div>
      </div>
    </div>
  );
};
