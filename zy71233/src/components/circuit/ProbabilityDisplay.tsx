import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useGameStore } from '@/store/gameStore';
import { simulateCircuit } from '@/utils/quantum/quantumEngine';
import { formatProbability } from '@/utils/validation/validator';

export const ProbabilityDisplay = () => {
  const { currentLevel, currentCircuit, isSimulating } = useGameStore();

  const probabilities = useMemo(() => {
    if (!currentLevel || !currentCircuit) return null;

    const gatesForSimulation = currentCircuit.gates.map((g) => ({
      type: g.type,
      qubit: g.position.qubit,
      slot: g.position.slot,
      controlQubit: g.controlQubit,
    }));

    const noiseForSimulation = currentCircuit.noiseCards.map((n) => ({
      type: n.type,
      qubit: n.position.qubit,
      slot: n.position.slot,
      probability: n.probability,
    }));

    const result = simulateCircuit(
      currentCircuit.qubits,
      gatesForSimulation,
      noiseForSimulation,
      currentCircuit.measurementBasis
    );

    return result;
  }, [currentLevel, currentCircuit]);

  if (!currentLevel || !currentCircuit || !probabilities) return null;

  const chartData = Object.entries(probabilities.probabilities).map(([state, prob]) => ({
    state: `|${state}⟩`,
    probability: prob * 100,
    target: (currentLevel.targetProbabilities[state] || 0) * 100,
  }));

  const probabilitySum = probabilities.probabilitySum;
  const isNormalized = Math.abs(probabilitySum - 1) <= 0.001;

  return (
    <div className="bg-slate-800/50 rounded-xl p-6 backdrop-blur-sm border border-slate-700">
      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <span className="w-2 h-2 bg-green-400 rounded-full"></span>
        测量概率分布
      </h3>

      <div className="h-64 mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="state" stroke="#94a3b8" fontSize={12} />
            <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: 'white',
              }}
              formatter={(value: number) => [`${value.toFixed(2)}%`, '实际概率']}
            />
            <Bar dataKey="probability" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => {
                const diff = Math.abs(entry.probability - entry.target);
                const color = diff < 5 ? '#22c55e' : diff < 15 ? '#eab308' : '#ef4444';
                return <Cell key={`cell-${index}`} fill={color} />;
              })}
            </Bar>
            <Bar dataKey="target" fill="#3b82f6" radius={[4, 4, 0, 0]} opacity={0.3} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-900/50 rounded-lg p-3">
          <div className="text-xs text-slate-400 mb-1">概率总和</div>
          <div className={`text-lg font-bold ${isNormalized ? 'text-green-400' : 'text-red-400'}`}>
            {(probabilitySum * 100).toFixed(2)}%
          </div>
          <div className={`text-xs ${isNormalized ? 'text-green-500' : 'text-red-500'}`}>
            {isNormalized ? '✓ 已归一化' : '✗ 未归一化'}
          </div>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-3">
          <div className="text-xs text-slate-400 mb-1">已放置门数</div>
          <div className="text-lg font-bold text-cyan-400">{currentCircuit.gates.length}</div>
          <div className="text-xs text-slate-500">共 {currentCircuit.qubits * currentCircuit.slots} 个槽位</div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-slate-700">
        <div className="text-xs text-slate-400 mb-2">概率详情</div>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(probabilities.probabilities).map(([state, prob]) => (
            <div key={state} className="flex items-center justify-between text-sm">
              <span className="text-slate-300">|{state}⟩:</span>
              <span className="font-mono text-white">{formatProbability(prob)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const ValidationResultPanel = () => {
  const { validationResult, currentLevel } = useGameStore();

  if (!validationResult || !currentLevel) return null;

  const gradeColors: Record<string, string> = {
    S: 'from-yellow-400 to-yellow-600',
    A: 'from-green-400 to-green-600',
    B: 'from-cyan-400 to-cyan-600',
    C: 'from-blue-400 to-blue-600',
    D: 'from-orange-400 to-orange-600',
    F: 'from-red-400 to-red-600',
  };

  const totalPenalties =
    validationResult.gateOrderErrors.reduce((sum, e) => sum + e.penalty, 0) +
    (validationResult.normalizationError?.penalty || 0) +
    (validationResult.noiseError?.penalty || 0) +
    (validationResult.probabilityMismatchError?.penalty || 0);

  return (
    <div className="bg-slate-800/50 rounded-xl p-6 backdrop-blur-sm border border-slate-700">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-white">验证结果</h3>
        <div
          className={`w-16 h-16 rounded-full bg-gradient-to-br ${gradeColors[validationResult.grade]} flex items-center justify-center text-2xl font-bold text-white shadow-lg`}
        >
          {validationResult.grade}
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-slate-400">得分</span>
          <span className="text-white font-bold">
            {validationResult.score} / {validationResult.maxScore}
          </span>
        </div>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-400 to-green-400 transition-all duration-500"
            style={{ width: `${(validationResult.score / validationResult.maxScore) * 100}%` }}
          />
        </div>
      </div>

      {totalPenalties > 0 && (
        <div className="mb-6 p-4 bg-red-900/20 rounded-lg border border-red-500/30">
          <div className="text-red-400 font-semibold mb-2">扣分详情 (-{totalPenalties})</div>

          {validationResult.gateOrderErrors.length > 0 && (
            <div className="mb-3">
              <div className="text-sm text-red-300 mb-1">
                门顺序错误 ({validationResult.gateOrderErrors.length} 项)
              </div>
              {validationResult.gateOrderErrors.map((error, index) => (
                <div key={index} className="text-xs text-slate-400 ml-2 mb-1">
                  • {error.message} <span className="text-red-400">(-{error.penalty}分)</span>
                </div>
              ))}
            </div>
          )}

          {validationResult.normalizationError && (
            <div className="mb-3">
              <div className="text-sm text-red-300 mb-1">概率未归一</div>
              <div className="text-xs text-slate-400 ml-2">
                • {validationResult.normalizationError.message}{' '}
                <span className="text-red-400">(-{validationResult.normalizationError.penalty}分)</span>
              </div>
            </div>
          )}

          {validationResult.noiseError && (
            <div className="mb-3">
              <div className="text-sm text-red-300 mb-1">噪声未扣除</div>
              <div className="text-xs text-slate-400 ml-2">
                • {validationResult.noiseError.message}{' '}
                <span className="text-red-400">(-{validationResult.noiseError.penalty}分)</span>
              </div>
            </div>
          )}

          {validationResult.probabilityMismatchError && (
            <div>
              <div className="text-sm text-red-300 mb-1">
                概率不匹配 ({validationResult.probabilityMismatchError.mismatches.length} 项)
              </div>
              {validationResult.probabilityMismatchError.mismatches.slice(0, 4).map((m, i) => (
                <div key={i} className="text-xs text-slate-400 ml-2 mb-1">
                  • |{m.state}⟩: 实际 {(m.actual * 100).toFixed(1)}%, 目标{' '}
                  {(m.target * 100).toFixed(1)}%, 偏差 {(m.diff * 100).toFixed(1)}%
                </div>
              ))}
              {validationResult.probabilityMismatchError.mismatches.length > 4 && (
                <div className="text-xs text-slate-500 ml-2">
                  • 还有 {validationResult.probabilityMismatchError.mismatches.length - 4} 项偏差...
                </div>
              )}
              <div className="text-xs text-slate-400 ml-2 mt-1">
                <span className="text-red-400">
                  (-{validationResult.probabilityMismatchError.penalty}分)
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {validationResult.suggestions.length > 0 && (
        <div className="p-4 bg-cyan-900/20 rounded-lg border border-cyan-500/30">
          <div className="text-cyan-400 font-semibold mb-2">改进建议</div>
          {validationResult.suggestions.map((suggestion, index) => (
            <div key={index} className="text-sm text-slate-300 mb-1">
              💡 {suggestion}
            </div>
          ))}
        </div>
      )}

      {validationResult.isValid && (
        <div className="mt-4 p-4 bg-green-900/20 rounded-lg border border-green-500/30 text-center">
          <div className="text-2xl mb-2">🎉</div>
          <div className="text-green-400 font-bold">恭喜通关！</div>
          <div className="text-sm text-slate-400 mt-1">你成功构建了正确的量子电路</div>
        </div>
      )}
    </div>
  );
};
