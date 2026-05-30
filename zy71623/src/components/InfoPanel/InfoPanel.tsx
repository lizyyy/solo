import React, { useMemo } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { baseBlocks } from '../../data/levels';
import { calculateUsedArea, getErrorIcon } from '../../engine/validator';

const InfoPanel: React.FC = () => {
  const {
    currentLevel,
    placedPolygons,
    validationResult,
    isSimulating,
    simulationResult,
    validate,
    startSimulation,
    clearBridge,
    loadSampleData
  } = useGameStore();

  const usedArea = useMemo(() => {
    if (!currentLevel) return 0;
    const allBlocks = [...currentLevel.availableBlocks, ...baseBlocks];
    return calculateUsedArea(placedPolygons, allBlocks);
  }, [currentLevel, placedPolygons]);

  const areaPercentage = currentLevel ? (usedArea / currentLevel.areaBudget) * 100 : 0;
  const isAreaOver = areaPercentage > 100;

  if (!currentLevel) {
    return (
      <div className="bg-slate-800/50 rounded-xl p-4 h-full">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <span>📊</span> 信息面板
        </h3>
        <p className="text-slate-500 text-sm">请先选择关卡</p>
      </div>
    );
  }

  const difficultyColors = {
    easy: 'bg-green-500/20 text-green-400',
    medium: 'bg-yellow-500/20 text-yellow-400',
    hard: 'bg-red-500/20 text-red-400'
  };

  const difficultyLabels = {
    easy: '简单',
    medium: '中等',
    hard: '困难'
  };

  return (
    <div className="bg-slate-800/50 rounded-xl p-4 h-full flex flex-col">
      <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
        <span>📊</span> 信息面板
      </h3>

      <div className="mb-4 p-3 bg-slate-900/50 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-300">{currentLevel.name}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${difficultyColors[currentLevel.difficulty]}`}>
            {difficultyLabels[currentLevel.difficulty]}
          </span>
        </div>
        <p className="text-xs text-slate-500">{currentLevel.description}</p>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-slate-400">面积预算</span>
          <span className={isAreaOver ? 'text-red-400' : 'text-slate-300'}>
            {usedArea.toFixed(0)} / {currentLevel.areaBudget}
          </span>
        </div>
        <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${isAreaOver ? 'bg-red-500' : 'bg-primary-500'}`}
            style={{ width: `${Math.min(areaPercentage, 100)}%` }}
          />
        </div>
        {isAreaOver && (
          <p className="text-xs text-red-400 mt-1">⚠️ 面积超出预算！</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-slate-900/50 rounded-lg p-2 text-center">
          <p className="text-lg font-mono text-white">{placedPolygons.length}</p>
          <p className="text-xs text-slate-500">已放置</p>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-2 text-center">
          <p className="text-lg font-mono text-white">{currentLevel.truck.weight}</p>
          <p className="text-xs text-slate-500">车辆载重</p>
        </div>
      </div>

      {validationResult && (
        <div className="mb-4 max-h-32 overflow-y-auto">
          {validationResult.errors.length > 0 && (
            <div className="space-y-1">
              {validationResult.errors.map((error, i) => (
                <div key={i} className="flex items-start gap-2 text-xs bg-red-500/10 p-2 rounded text-red-400">
                  <span>{getErrorIcon(error.type)}</span>
                  <span>{error.message}</span>
                </div>
              ))}
            </div>
          )}
          {validationResult.warnings.length > 0 && (
            <div className="space-y-1 mt-2">
              {validationResult.warnings.map((warning, i) => (
                <div key={i} className="flex items-start gap-2 text-xs bg-yellow-500/10 p-2 rounded text-yellow-400">
                  <span>⚠️</span>
                  <span>{warning.message}</span>
                </div>
              ))}
            </div>
          )}
          {validationResult.valid && (
            <div className="flex items-center gap-2 text-xs bg-green-500/10 p-2 rounded text-green-400">
              <span>✅</span>
              <span>校验通过！可以开始承重测试</span>
            </div>
          )}
        </div>
      )}

      {simulationResult && !validationResult && (
        <div className={`mb-4 p-3 rounded-lg ${simulationResult.success ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">{simulationResult.success ? '🎉' : '💥'}</span>
            <span className={`font-semibold ${simulationResult.success ? 'text-green-400' : 'text-red-400'}`}>
              {simulationResult.success ? '测试通过！' : '测试失败'}
            </span>
          </div>
          {simulationResult.failureReason && (
            <p className="text-xs text-red-300">{simulationResult.failureReason}</p>
          )}
          <div className="mt-2 text-xs text-slate-400">
            最大应力: {(simulationResult.maxStress * 100).toFixed(1)}%
          </div>
        </div>
      )}

      <div className="mb-4">
        <p className="text-xs text-slate-400 mb-2">📚 加载样例</p>
        <div className="grid grid-cols-1 gap-1">
          <button
            onClick={() => loadSampleData('correctSolution')}
            disabled={isSimulating}
            className="text-xs text-left px-2 py-1.5 bg-green-500/10 text-green-400 rounded hover:bg-green-500/20 transition-colors disabled:opacity-50"
          >
            ✅ 正确示例
          </button>
          <button
            onClick={() => loadSampleData('areaExceeded')}
            disabled={isSimulating}
            className="text-xs text-left px-2 py-1.5 bg-red-500/10 text-red-400 rounded hover:bg-red-500/20 transition-colors disabled:opacity-50"
          >
            ❌ 面积超限
          </button>
          <button
            onClick={() => loadSampleData('notConnected')}
            disabled={isSimulating}
            className="text-xs text-left px-2 py-1.5 bg-yellow-500/10 text-yellow-400 rounded hover:bg-yellow-500/20 transition-colors disabled:opacity-50"
          >
            ❌ 桥梁断开
          </button>
          <button
            onClick={() => loadSampleData('overlap')}
            disabled={isSimulating}
            className="text-xs text-left px-2 py-1.5 bg-orange-500/10 text-orange-400 rounded hover:bg-orange-500/20 transition-colors disabled:opacity-50"
          >
            ❌ 多边形重叠
          </button>
        </div>
      </div>

      <div className="mt-auto space-y-2">
        <button
          onClick={validate}
          disabled={isSimulating || placedPolygons.length === 0}
          className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          🔍 校验桥梁
        </button>
        <button
          onClick={startSimulation}
          disabled={isSimulating || placedPolygons.length === 0 || !validationResult?.valid}
          className="w-full py-2 bg-accent-500 hover:bg-accent-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
        >
          {isSimulating ? '⏳ 模拟中...' : '🚗 开始承重测试'}
        </button>
        <button
          onClick={clearBridge}
          disabled={isSimulating}
          className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          🗑️ 清空画布
        </button>
      </div>
    </div>
  );
};

export default InfoPanel;
