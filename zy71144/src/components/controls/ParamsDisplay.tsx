import { AlertTriangle, CheckCircle, XCircle, Ruler, RotateCcw, ArrowUp, Gauge, Thermometer } from 'lucide-react';
import type { CalculationResult, TrainingParams } from '../../types';

interface ParamsDisplayProps {
  result: CalculationResult | null;
  params: TrainingParams;
}

export function ParamsDisplay({ result, params }: ParamsDisplayProps) {
  if (!result) {
    return (
      <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <Gauge className="w-5 h-5 text-red-400" />
          实时参数
        </h3>
        <div className="text-slate-400 text-sm text-center py-8">
          点击3D场景添加水带路径节点
          <br />
          开始铺设水带后显示参数
        </div>
      </div>
    );
  }

  const lengthPercent = (result.totalLength / params.maxHoseLength) * 100;
  const cornerPercent = (result.cornerCount / params.maxCorners) * 100;
  const pressurePercent = (result.remainingPressure / result.initialPressure) * 100;

  const getStatusColor = (percent: number, isReversed = false) => {
    if (isReversed) {
      if (percent >= 60) return 'text-green-400';
      if (percent >= 30) return 'text-yellow-400';
      return 'text-red-400';
    }
    if (percent <= 75) return 'text-green-400';
    if (percent <= 90) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getBarColor = (percent: number, isReversed = false) => {
    if (isReversed) {
      if (percent >= 60) return 'bg-green-500';
      if (percent >= 30) return 'bg-yellow-500';
      return 'bg-red-500';
    }
    if (percent <= 75) return 'bg-green-500';
    if (percent <= 90) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Gauge className="w-5 h-5 text-red-400" />
          实时参数
        </h3>
        <div className="flex items-center gap-2">
          {result.isValid ? (
            <span className="flex items-center gap-1 text-green-400 text-sm">
              <CheckCircle className="w-4 h-4" />
              合格
            </span>
          ) : (
            <span className="flex items-center gap-1 text-red-400 text-sm">
              <XCircle className="w-4 h-4" />
              不合格
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-slate-300 text-sm flex items-center gap-1">
              <Ruler className="w-4 h-4" />
              水带长度
            </span>
            <span className={`font-mono font-bold ${getStatusColor(lengthPercent)}`}>
              {result.totalLength.toFixed(1)}m / {params.maxHoseLength}m
            </span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full ${getBarColor(lengthPercent)} transition-all duration-300`}
              style={{ width: `${Math.min(lengthPercent, 100)}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-slate-300 text-sm flex items-center gap-1">
              <RotateCcw className="w-4 h-4" />
              转角数量
            </span>
            <span className={`font-mono font-bold ${getStatusColor(cornerPercent)}`}>
              {result.cornerCount}个 / {params.maxCorners}个
            </span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full ${getBarColor(cornerPercent)} transition-all duration-300`}
              style={{ width: `${Math.min(cornerPercent, 100)}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-slate-300 text-sm flex items-center gap-1">
              <ArrowUp className="w-4 h-4" />
              垂直高度
            </span>
            <span className="font-mono font-bold text-blue-400">
              {result.verticalHeight.toFixed(1)}m
            </span>
          </div>
        </div>

        <div className="border-t border-slate-700 pt-4">
          <h4 className="text-slate-300 text-sm mb-3 flex items-center gap-1">
            <Thermometer className="w-4 h-4" />
            压力分析
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-900/50 rounded-lg p-3">
              <div className="text-slate-400 text-xs mb-1">初始压力</div>
              <div className="text-white font-mono font-bold">
                {result.initialPressure.toFixed(2)}
                <span className="text-slate-400 text-xs ml-1">MPa</span>
              </div>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3">
              <div className="text-slate-400 text-xs mb-1">压力损失</div>
              <div className="text-red-400 font-mono font-bold">
                -{result.pressureLoss.toFixed(3)}
                <span className="text-slate-400 text-xs ml-1">MPa</span>
              </div>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-400 text-xs">剩余压力</span>
              <span className={`font-mono font-bold ${getStatusColor(pressurePercent, true)}`}>
                {result.remainingPressure.toFixed(3)} MPa
              </span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full ${getBarColor(pressurePercent, true)} transition-all duration-300`}
                style={{ width: `${pressurePercent}%` }}
              />
            </div>
          </div>
        </div>

        {result.warnings.length > 0 && (
          <div className="border-t border-slate-700 pt-4">
            <h4 className="text-slate-300 text-sm mb-2 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              警告信息
            </h4>
            <div className="space-y-2">
              {result.warnings.map((warning, i) => (
                <div
                  key={i}
                  className={`p-2 rounded-lg text-sm ${
                    warning.severity === 'error'
                      ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                      : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                  }`}
                >
                  {warning.message}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
