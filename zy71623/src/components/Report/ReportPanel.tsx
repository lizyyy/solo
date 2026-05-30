import React, { useEffect, useRef } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { baseBlocks } from '../../data/levels';
import { calculateUsedArea } from '../../engine/validator';

const ReportPanel: React.FC = () => {
  const {
    simulationResult,
    currentLevel,
    placedPolygons,
    replayFrameIndex,
    isPlaying,
    setReplayFrameIndex,
    setIsPlaying,
    setCurrentView,
    saveRecord,
    exportRecord,
    generateReport
  } = useGameStore();

  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPlaying && simulationResult) {
      const totalFrames = simulationResult.replayData.length;
      if (replayFrameIndex >= totalFrames - 1) {
        setIsPlaying(false);
        return;
      }
      intervalRef.current = window.setInterval(() => {
        setReplayFrameIndex(replayFrameIndex + 1);
      }, 50);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, replayFrameIndex, simulationResult, setReplayFrameIndex, setIsPlaying]);

  const handlePlayPause = () => {
    if (!simulationResult) return;
    if (replayFrameIndex >= simulationResult.replayData.length - 1) {
      setReplayFrameIndex(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const handleExport = () => {
    const data = exportRecord();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bridge-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const report = generateReport();

  if (!simulationResult || !currentLevel || !report) {
    return null;
  }

  const allBlocks = [...currentLevel.availableBlocks, ...baseBlocks];
  const usedArea = calculateUsedArea(placedPolygons, allBlocks);
  const progress = simulationResult.replayData.length > 0
    ? (replayFrameIndex / simulationResult.replayData.length) * 100
    : 0;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-700">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              {simulationResult.success ? '🎉' : '💥'}
              <span>
                {simulationResult.success ? '恭喜通关！' : '挑战失败'}
              </span>
            </h2>
            <button
              onClick={() => {
                setCurrentView('game');
                setIsPlaying(false);
              }}
              className="text-slate-400 hover:text-white transition-colors text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={handlePlayPause}
              className="w-12 h-12 rounded-full bg-accent-500 hover:bg-accent-600 flex items-center justify-center text-white text-xl transition-colors"
            >
              {isPlaying ? '⏸' : '▶'}
            </button>
            <div className="flex-1">
              <input
                type="range"
                min="0"
                max={simulationResult.replayData.length - 1}
                value={replayFrameIndex}
                onChange={(e) => setReplayFrameIndex(Number(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <span className="text-sm text-slate-400 w-16 text-right">
              {progress.toFixed(0)}%
            </span>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="bg-slate-800 rounded-xl p-4 text-center">
              <p className="text-3xl font-mono text-white">
                {((usedArea / currentLevel.areaBudget) * 100).toFixed(1)}%
              </p>
              <p className="text-sm text-slate-400">面积使用率</p>
            </div>
            <div className="bg-slate-800 rounded-xl p-4 text-center">
              <p className="text-3xl font-mono text-white">
                {(simulationResult.maxStress * 100).toFixed(1)}%
              </p>
              <p className="text-sm text-slate-400">最大应力</p>
            </div>
            <div className="bg-slate-800 rounded-xl p-4 text-center">
              <p className={`text-3xl font-mono ${simulationResult.success ? 'text-green-400' : 'text-red-400'}`}>
                {report.efficiency.toFixed(0)}
              </p>
              <p className="text-sm text-slate-400">效率评分</p>
            </div>
            <div className="bg-slate-800 rounded-xl p-4 text-center">
              <p className="text-3xl font-mono text-white">
                {placedPolygons.length}
              </p>
              <p className="text-sm text-slate-400">使用块数</p>
            </div>
          </div>

          {!simulationResult.success && simulationResult.failureReason && (
            <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4">
              <h3 className="text-red-400 font-semibold mb-2 flex items-center gap-2">
                <span>🔍</span> 失败原因分析
              </h3>
              <p className="text-red-300 text-sm">
                {simulationResult.failureReason}
              </p>
              <div className="mt-3 p-3 bg-slate-800/50 rounded-lg">
                <p className="text-xs text-slate-400 mb-1">
                  💡 改进建议：
                </p>
                <ul className="text-xs text-slate-300 space-y-1">
                  {report.suggestions.slice(0, 3).map((s, i) => (
                    <li key={i}>• {s}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {simulationResult.success && (
            <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-4">
              <h3 className="text-green-400 font-semibold mb-2 flex items-center gap-2">
                <span>🏆</span> 做得好！
              </h3>
              <p className="text-green-300 text-sm">
                你成功设计了一座稳固的桥梁！
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400">承重能力：</span>
                  <span className="text-green-300">{simulationResult.maxLoad} 单位</span>
                </div>
                <div>
                  <span className="text-slate-400">面积效率：</span>
                  <span className="text-green-300">
                    {((1 - usedArea / currentLevel.areaBudget) * 100).toFixed(1)}% 剩余
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="bg-slate-800 rounded-xl p-4">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <span>📋</span> 应力分布
            </h3>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {placedPolygons.map((p, i) => {
                const block = allBlocks.find(b => b.id === p.blockId);
                const stress = simulationResult.stressMap[p.instanceId] || 0;
                const stressPercent = stress * 100;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: block?.color }}
                    />
                    <span className="text-sm text-slate-300 w-24 truncate">
                      {block?.name}
                    </span>
                    <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full transition-all duration-300"
                        style={{
                          width: `${Math.min(stressPercent, 100)}%`,
                          backgroundColor: stressPercent >= 70 ? '#ef4444' :
                            stressPercent >= 40 ? '#f97316' : '#22c55e'
                        }}
                      />
                    </div>
                    <span className={`text-xs w-12 text-right ${
                      stressPercent >= 70 ? 'text-red-400' :
                      stressPercent >= 40 ? 'text-orange-400' : 'text-green-400'
                    }`}>
                      {stressPercent.toFixed(0)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                saveRecord();
                setCurrentView('game');
                setIsPlaying(false);
              }}
              className="flex-1 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-xl transition-colors font-medium"
            >
              🔄 再试一次
            </button>
            <button
              onClick={handleExport}
              className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors font-medium"
            >
              📥 导出报告
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportPanel;
