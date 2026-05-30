import {
  Clock,
  Navigation,
  Battery,
  Zap,
  Wind,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Gauge,
  Target,
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { formatTime, formatDistance } from '@/utils/calculator';

export default function ResultDashboard() {
  const result = useAppStore((state) => state.calculationResult);

  if (!result) {
    return (
      <div className="card p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-700/50 flex items-center justify-center">
          <Gauge className="w-8 h-8 text-slate-500" />
        </div>
        <h3 className="text-lg font-semibold text-slate-300 mb-2">
          等待计算
        </h3>
        <p className="text-sm text-slate-500">
          配置好参数后点击"开始计算"按钮获取续航估算结果
        </p>
      </div>
    );
  }

  const getMarginColor = (margin: number) => {
    if (margin < 0) return 'bg-danger-500';
    if (margin < 10) return 'bg-warning-500';
    return 'bg-success-500';
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 80) return 'text-success-400';
    if (score >= 60) return 'text-warning-400';
    return 'text-danger-400';
  };

  const criticalRisks = result.risks.filter((r) => r.level === 'critical').length;
  const warningRisks = result.risks.filter((r) => r.level === 'warning').length;

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-200 flex items-center gap-2">
            <Target className="w-5 h-5 text-aviation-400" />
            计算摘要
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">置信度:</span>
            <span className={`font-mono font-semibold ${getConfidenceColor(result.confidenceScore)}`}>
              {result.confidenceScore}%
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-slate-700/30 rounded-lg">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <Clock className="w-3 h-3" />
              估算飞行时间
            </div>
            <div className="text-2xl font-mono font-bold text-slate-100">
              {formatTime(result.estimatedFlightTime)}
            </div>
          </div>

          <div className="p-3 bg-slate-700/30 rounded-lg">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <Navigation className="w-3 h-3" />
              估算航程
            </div>
            <div className="text-2xl font-mono font-bold text-slate-100">
              {formatDistance(result.estimatedRange)}
            </div>
          </div>

          <div className="p-3 bg-slate-700/30 rounded-lg">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <Zap className="w-3 h-3" />
              基础功率
            </div>
            <div className="text-2xl font-mono font-bold text-aviation-300">
              {result.basePower.toFixed(1)}
              <span className="text-sm font-normal text-slate-400 ml-1">W</span>
            </div>
          </div>

          <div className="p-3 bg-slate-700/30 rounded-lg">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <Battery className="w-3 h-3" />
              返航阈值
            </div>
            <div className="text-2xl font-mono font-bold text-warning-400">
              {result.returnBatteryThreshold.toFixed(1)}
              <span className="text-sm font-normal text-slate-400 ml-1">%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <Battery className="w-5 h-5 text-aviation-400" />
          电量余量分析
        </h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-slate-400">剩余电量余量</span>
              <span
                className={`font-mono font-semibold ${
                  result.remainingBatteryMargin < 0
                    ? 'text-danger-400'
                    : result.remainingBatteryMargin < 10
                      ? 'text-warning-400'
                      : 'text-success-400'
                }`}
              >
                {result.remainingBatteryMargin.toFixed(1)}%
              </span>
            </div>
            <div className="gauge-container">
              <div
                className={`gauge-fill ${getMarginColor(result.remainingBatteryMargin)}`}
                style={{
                  width: `${Math.max(0, Math.min(100, result.remainingBatteryMargin + 20))}%`,
                }}
              />
            </div>
            <div className="flex justify-between mt-1 text-xs text-slate-500">
              <span>-20%</span>
              <span>0%</span>
              <span>安全线 20%</span>
              <span>80%</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-700">
            <div className="text-center">
              <div className="text-xs text-slate-400 mb-1">任务距离</div>
              <div className="font-mono text-slate-200">
                {formatDistance(result.totalDistance)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-slate-400 mb-1">返航距离</div>
              <div className="font-mono text-slate-200">
                {formatDistance(result.returnDistance)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <Wind className="w-5 h-5 text-aviation-400" />
          风阻影响分析
        </h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-400">逆风分量</span>
            <span className="font-mono text-slate-200">
              {result.headwindComponent.toFixed(1)} m/s
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-400">空气密度</span>
            <span className="font-mono text-slate-200">
              {result.airDensity.toFixed(4)} kg/m³
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-400">风阻力</span>
            <span className="font-mono text-slate-200">
              {result.dragForce.toFixed(3)} N
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-400">风阻功率</span>
            <span className="font-mono text-slate-200">
              {result.dragPower.toFixed(2)} W
            </span>
          </div>
          <div className="pt-2 border-t border-slate-700">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-slate-400">风阻影响系数</span>
              <span
                className={`font-mono font-semibold ${
                  result.windResistanceImpact > 1.5
                    ? 'text-danger-400'
                    : result.windResistanceImpact > 1.2
                      ? 'text-warning-400'
                      : 'text-success-400'
                }`}
              >
                {result.windResistanceImpact.toFixed(2)}x
              </span>
            </div>
            <div className="gauge-container">
              <div
                className={`gauge-fill ${
                  result.windResistanceImpact > 1.5
                    ? 'bg-danger-500'
                    : result.windResistanceImpact > 1.2
                      ? 'bg-warning-500'
                      : 'bg-success-500'
                }`}
                style={{
                  width: `${Math.min(100, (result.windResistanceImpact - 1) * 100)}%`,
                }}
              />
            </div>
          </div>
          <div className="pt-2 border-t border-slate-700">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-slate-400">载重影响系数</span>
              <span
                className={`font-mono font-semibold ${
                  result.payloadEnergyImpact > 1.3
                    ? 'text-warning-400'
                    : 'text-success-400'
                }`}
              >
                {result.payloadEnergyImpact.toFixed(2)}x
              </span>
            </div>
            <div className="gauge-container">
              <div
                className={`gauge-fill ${
                  result.payloadEnergyImpact > 1.3
                    ? 'bg-warning-500'
                    : 'bg-success-500'
                }`}
                style={{
                  width: `${Math.min(100, (result.payloadEnergyImpact - 1) * 150)}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-aviation-400" />
          风险概览
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <div
            className={`p-3 rounded-lg text-center ${
              criticalRisks > 0 ? 'bg-danger-500/20 border border-danger-500/50' : 'bg-slate-700/30'
            }`}
          >
            <div className="flex justify-center mb-1">
              {criticalRisks > 0 ? (
                <XCircle className="w-6 h-6 text-danger-400" />
              ) : (
                <CheckCircle className="w-6 h-6 text-slate-500" />
              )}
            </div>
            <div
              className={`text-2xl font-mono font-bold ${
                criticalRisks > 0 ? 'text-danger-400' : 'text-slate-500'
              }`}
            >
              {criticalRisks}
            </div>
            <div className="text-xs text-slate-400">严重</div>
          </div>
          <div
            className={`p-3 rounded-lg text-center ${
              warningRisks > 0 ? 'bg-warning-500/20 border border-warning-500/50' : 'bg-slate-700/30'
            }`}
          >
            <div className="flex justify-center mb-1">
              {warningRisks > 0 ? (
                <AlertTriangle className="w-6 h-6 text-warning-400" />
              ) : (
                <CheckCircle className="w-6 h-6 text-slate-500" />
              )}
            </div>
            <div
              className={`text-2xl font-mono font-bold ${
                warningRisks > 0 ? 'text-warning-400' : 'text-slate-500'
              }`}
            >
              {warningRisks}
            </div>
            <div className="text-xs text-slate-400">警告</div>
          </div>
          <div className="p-3 rounded-lg text-center bg-slate-700/30">
            <div className="flex justify-center mb-1">
              <CheckCircle className="w-6 h-6 text-success-400" />
            </div>
            <div className="text-2xl font-mono font-bold text-success-400">
              {result.risks.filter((r) => r.level === 'notice').length}
            </div>
            <div className="text-xs text-slate-400">注意</div>
          </div>
        </div>
      </div>
    </div>
  );
}
