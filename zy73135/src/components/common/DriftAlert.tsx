import { AlertTriangle, Clock, CheckCircle } from 'lucide-react';

interface DriftAlertProps {
  driftAmount: number;
  unit: string;
  parameterName: string;
  onSuspend?: () => void;
  onRelease?: () => void;
  compact?: boolean;
}

export default function DriftAlert({
  driftAmount,
  unit,
  parameterName,
  onSuspend,
  onRelease,
  compact = false,
}: DriftAlertProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-nautical-warning/10 border border-nautical-warning/30 rounded-lg">
        <AlertTriangle className="w-4 h-4 text-nautical-warning animate-pulse" />
        <span className="text-sm text-nautical-warning font-medium">
          传感器漂移: {driftAmount.toFixed(2)} {unit}
        </span>
      </div>
    );
  }

  return (
    <div className="bg-nautical-warning/10 border border-nautical-warning/40 rounded-xl p-5 animate-glow-pulse">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-nautical-warning/20 rounded-full flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-6 h-6 text-nautical-warning" />
        </div>
        <div className="flex-1">
          <h4 className="text-white font-semibold mb-1">
            检测到 {parameterName} 传感器漂移
          </h4>
          <p className="text-sm text-ocean-300 mb-3">
            漂移量：<span className="text-nautical-warning font-mono font-bold">{driftAmount.toFixed(2)} {unit}</span>
            ，可能影响数据准确性
          </p>
          
          <div className="bg-ocean-900/50 rounded-lg p-3 mb-4">
            <p className="text-xs text-ocean-400 mb-2">影响分析：</p>
            <ul className="text-xs text-ocean-300 space-y-1">
              <li className="flex items-center gap-2">
                <Clock className="w-3 h-3 text-ocean-500" />
                <span>挂起：标记为待补件，需现场重测确认后放行</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-3 h-3 text-ocean-500" />
                <span>放行：自动校正后计入统计，保留漂移标记备查</span>
              </li>
            </ul>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onSuspend}
              className="flex-1 px-4 py-2 bg-ocean-700 hover:bg-ocean-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Clock className="w-4 h-4" />
              挂起待补
            </button>
            <button
              onClick={onRelease}
              className="flex-1 px-4 py-2 bg-nautical-warning hover:bg-nautical-warningDark text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              校正放行
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
