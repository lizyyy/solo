import React from 'react';
import { FlaskConical, Timer, PlayCircle, SkipForward, Pause, RotateCcw, Home } from 'lucide-react';
import { Level, WaterQuality } from '../../types';
import { calculateOptimalDose } from '../../utils/simulation';

interface ControlPanelProps {
  level: Level;
  waterQuality: WaterQuality;
  selectedChemicalAmount: number;
  selectedStirringTime: number;
  isProcessing: boolean;
  isPaused: boolean;
  onChemicalChange: (amount: number) => void;
  onStirringChange: (time: number) => void;
  onExecute: () => void;
  onNextRound: () => void;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  level,
  waterQuality,
  selectedChemicalAmount,
  selectedStirringTime,
  isProcessing,
  isPaused,
  onChemicalChange,
  onStirringChange,
  onExecute,
  onNextRound,
  onPause,
  onResume,
  onRestart,
  onQuit
}) => {
  const optimalDose = calculateOptimalDose(waterQuality, level.targetThresholds, level.parameters);
  const estimatedChemicalCost = selectedChemicalAmount * level.chemicalCost;
  const estimatedStirringCost = selectedStirringTime * level.stirringCostPerSecond;
  const estimatedTotalCost = estimatedChemicalCost + estimatedStirringCost;

  const isOverdose = selectedChemicalAmount > optimalDose * 1.5;
  const isInsufficientStirring = selectedStirringTime < level.parameters.minStirringTime;

  return (
    <div className="bg-slate-800/50 rounded-xl p-4 backdrop-blur-sm border border-slate-700">
      <h3 className="text-lg font-semibold text-white mb-4">参数控制</h3>

      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <FlaskConical size={18} className="text-blue-400" />
              <span className="text-sm font-medium text-white">药剂投加量</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-lg font-mono font-bold ${isOverdose ? 'text-red-400' : 'text-blue-400'}`}>
                {selectedChemicalAmount.toFixed(0)}
              </span>
              <span className="text-sm text-slate-400">单位</span>
            </div>
          </div>
          
          <input
            type="range"
            min="0"
            max={level.parameters.maxChemicalDose}
            value={selectedChemicalAmount}
            onChange={(e) => onChemicalChange(Number(e.target.value))}
            disabled={isProcessing}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-50"
          />
          
          <div className="flex justify-between mt-1 text-xs text-slate-500">
            <span>0</span>
            <span className="text-green-400">建议: ~{optimalDose}</span>
            <span>{level.parameters.maxChemicalDose}</span>
          </div>
          
          {isOverdose && (
            <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
              <span className="text-xs text-red-400">⚠️ 投加量严重超标，可能导致指标反弹！</span>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Timer size={18} className="text-green-400" />
              <span className="text-sm font-medium text-white">搅拌时间</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-lg font-mono font-bold ${isInsufficientStirring ? 'text-orange-400' : 'text-green-400'}`}>
                {selectedStirringTime.toFixed(0)}
              </span>
              <span className="text-sm text-slate-400">秒</span>
            </div>
          </div>
          
          <input
            type="range"
            min="0"
            max="20"
            value={selectedStirringTime}
            onChange={(e) => onStirringChange(Number(e.target.value))}
            disabled={isProcessing}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-green-500 disabled:opacity-50"
          />
          
          <div className="flex justify-between mt-1 text-xs text-slate-500">
            <span>0</span>
            <span className="text-yellow-400">最少: {level.parameters.minStirringTime}s</span>
            <span>20</span>
          </div>
          
          {isInsufficientStirring && (
            <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <span className="text-xs text-yellow-400">⚠️ 搅拌时间不足，处理效果会降低！</span>
            </div>
          )}
        </div>

        <div className="p-3 bg-slate-900/50 rounded-lg">
          <div className="text-xs text-slate-500 mb-2">预估成本</div>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">药剂成本:</span>
              <span className="font-mono text-blue-400">¥{estimatedChemicalCost.toFixed(0)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">搅拌成本:</span>
              <span className="font-mono text-green-400">¥{estimatedStirringCost.toFixed(0)}</span>
            </div>
            <div className="border-t border-slate-700 pt-1 mt-1">
              <div className="flex justify-between">
                <span className="text-slate-300 font-medium">总计:</span>
                <span className="font-mono text-cyan-400 font-bold">¥{estimatedTotalCost.toFixed(0)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onExecute}
            disabled={isProcessing}
            className="flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/30"
          >
            <PlayCircle size={20} />
            执行处理
          </button>
          
          <button
            onClick={onNextRound}
            disabled={isProcessing}
            className="flex items-center justify-center gap-2 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <SkipForward size={20} />
            下一回合
          </button>
        </div>

        <div className="flex gap-3">
          <button
            onClick={isPaused ? onResume : onPause}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg transition-all"
          >
            {isPaused ? <PlayCircle size={18} /> : <Pause size={18} />}
            {isPaused ? '继续' : '暂停'}
          </button>
          
          <button
            onClick={onRestart}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg transition-all"
            title="重新开始"
          >
            <RotateCcw size={18} />
          </button>
          
          <button
            onClick={onQuit}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-red-600/30 text-slate-300 hover:text-red-400 rounded-lg transition-all"
            title="退出游戏"
          >
            <Home size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
