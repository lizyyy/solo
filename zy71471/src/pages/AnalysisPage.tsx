import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { FitChart } from '@/components/charts/FitChart';
import { ResidualChart } from '@/components/charts/ResidualChart';
import { ParameterImpactChart } from '@/components/charts/ParameterImpactChart';
import { useBatchStore } from '@/store/useBatchStore';
import { useExponentialFit } from '@/hooks/useExponentialFit';
import { calculateTheoreticalTau, formatTime } from '@/utils/units';
import { AlertTriangle, BarChart3, Activity, Target, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AnalysisPage() {
  const { id } = useParams<{ id: string }>();
  const currentBatch = useBatchStore((state) => state.currentBatch);
  const samplePoints = useBatchStore((state) => state.samplePoints);
  const fitResult = useBatchStore((state) => state.fitResult);
  const fitMode = useBatchStore((state) => state.fitMode);
  const showOutliers = useBatchStore((state) => state.showOutliers);
  const loading = useBatchStore((state) => state.loading);
  const setCurrentBatch = useBatchStore((state) => state.setCurrentBatch);
  const runFit = useBatchStore((state) => state.runFit);

  useEffect(() => {
    if (id) {
      setCurrentBatch(id);
    }
    return () => setCurrentBatch(null);
  }, [id, setCurrentBatch]);

  const { theoryCurve, parameterImpacts, statistics } = useExponentialFit(
    samplePoints,
    fitResult,
    fitMode,
    currentBatch?.timeUnit || 's'
  );

  const theoreticalTau = useMemo(() => {
    if (!currentBatch) return null;
    return calculateTheoreticalTau(
      currentBatch.resistance,
      currentBatch.resistanceUnit,
      currentBatch.capacitance,
      currentBatch.capacitanceUnit
    );
  }, [currentBatch]);

  const tauComparison = useMemo(() => {
    if (!fitResult || theoreticalTau === null) return null;
    const fittedTau = fitResult.tau;
    const errorPercent = Math.abs((fittedTau - theoreticalTau) / theoreticalTau) * 100;
    return {
      fittedTau,
      theoreticalTau,
      errorPercent,
      withinTolerance: errorPercent < 10,
    };
  }, [fitResult, theoreticalTau]);

  const formula = useMemo(() => {
    if (fitMode === 'discharge') {
      return 'V(t) = V₀e^(-t/τ)';
    }
    return 'V(t) = Vs + (V₀ - Vs)e^(-t/τ)';
  }, [fitMode]);

  if (!currentBatch) return null;

  const hasData = samplePoints.length >= 3;
  const hasFitResult = fitResult !== null;

  return (
    <div className="space-y-6">
      {!hasData ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
          <BarChart3 className="w-16 h-16 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
          <h3 className="text-lg font-medium text-slate-800 dark:text-white mb-2">数据不足</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            请先在"数据录入"页面添加至少 3 个采样点
          </p>
        </div>
      ) : !hasFitResult ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
          <Activity className="w-16 h-16 mx-auto mb-4 text-blue-400" />
          <h3 className="text-lg font-medium text-slate-800 dark:text-white mb-2">等待分析</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            已录入 {samplePoints.length} 个采样点，点击"开始分析"进行指数拟合
          </p>
          <button
            onClick={() => runFit()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:bg-blue-300"
          >
            <Zap className={cn('w-4 h-4', loading && 'animate-spin')} />
            {loading ? '正在计算...' : '开始分析'}
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <div className="xl:col-span-9 space-y-6">
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
                      {fitMode === 'discharge' ? '放电曲线拟合' : '充电曲线拟合'}
                    </h3>
                    <p className="text-sm font-mono text-slate-500 dark:text-slate-400 mt-1">
                      {formula}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <Target className="w-4 h-4" />
                    <span>算法: {fitResult.algorithm}</span>
                  </div>
                </div>
                <div className="h-[400px]">
                  <FitChart
                    points={samplePoints}
                    theoryCurve={theoryCurve}
                    fitMode={fitMode}
                    showOutliers={showOutliers}
                    timeUnit={currentBatch.timeUnit}
                    confidenceInterval={fitResult.confidenceInterval}
                  />
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">残差分析</h3>
                <div className="h-[250px]">
                  <ResidualChart points={samplePoints} rmse={fitResult.rootMeanSquaredError} />
                </div>
              </div>
            </div>

            <div className="xl:col-span-3 space-y-6">
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">拟合参数</h3>
                <div className="space-y-4">
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-100 dark:border-blue-800/30">
                    <div className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">时间常数 τ</div>
                    <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                      {formatTime(fitResult.tau, currentBatch.timeUnit)}
                    </div>
                    <div className="text-xs text-blue-500 dark:text-blue-400/70 mt-1">
                      ±{(fitResult.tauStdErr * 100 / fitResult.tau).toFixed(2)}% 标准误差
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                      <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">R² 决定系数</div>
                      <div className="text-lg font-bold text-slate-800 dark:text-white">
                        {fitResult.rSquared.toFixed(6)}
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                      <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">RMSE 均方根</div>
                      <div className="text-lg font-bold text-slate-800 dark:text-white">
                        {fitResult.rootMeanSquaredError.toFixed(6)}
                      </div>
                    </div>
                  </div>

                  {tauComparison && (
                    <div className={cn(
                      'p-4 rounded-xl border',
                      tauComparison.withinTolerance
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/30'
                        : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/30'
                    )}>
                      <div className="flex items-center gap-2 mb-3">
                        <Zap className={cn('w-4 h-4', tauComparison.withinTolerance ? 'text-emerald-500' : 'text-amber-500')} />
                        <span className={cn('text-sm font-medium', tauComparison.withinTolerance ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400')}>
                          τ 值对比
                        </span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-500 dark:text-slate-400">理论值:</span>
                          <span className="font-medium text-slate-800 dark:text-white">
                            {formatTime(tauComparison.theoreticalTau, currentBatch.timeUnit)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500 dark:text-slate-400">拟合值:</span>
                          <span className="font-medium text-slate-800 dark:text-white">
                            {formatTime(tauComparison.fittedTau, currentBatch.timeUnit)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-700">
                          <span className="text-slate-500 dark:text-slate-400">相对误差:</span>
                          <span className={cn(
                            'font-bold',
                            tauComparison.withinTolerance
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-amber-600 dark:text-amber-400'
                          )}>
                            {tauComparison.errorPercent.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                      {!tauComparison.withinTolerance && (
                        <div className="mt-3 flex items-start gap-2 p-2 bg-amber-100/50 dark:bg-amber-900/20 rounded-lg">
                          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-amber-700 dark:text-amber-400">
                            误差超过 10%，建议检查 R、C 参数或实验数据
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {statistics && (
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                      <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">数据统计</div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500 dark:text-slate-400">采样点:</span>
                          <span className="text-slate-800 dark:text-white font-medium">{statistics.numPoints}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500 dark:text-slate-400">异常点:</span>
                          <span className="text-slate-800 dark:text-white font-medium">{statistics.numOutliers}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500 dark:text-slate-400">电压范围:</span>
                          <span className="text-slate-800 dark:text-white font-medium">
                            {statistics.voltageRange.toFixed(2)}V
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">参数影响度</h3>
                <div className="h-[250px]">
                  <ParameterImpactChart impacts={parameterImpacts} />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
