import { Calculator, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { usePendulumStore } from '@/store/usePendulumStore';
import { formatNumber } from '@/utils/statistics';
import { STANDARD_GRAVITY } from '@/utils/constants';

export default function ResultDisplay() {
  const { result, isCalculating, error, calculateGravity, data } = usePendulumStore();

  const validDataCount = data.filter(d => !d.excluded && d.length > 0 && d.period > 0).length;
  const canCalculate = validDataCount >= 2;

  return (
    <div className="bg-slate-800/50 rounded-2xl p-6 backdrop-blur-sm border border-slate-700/50">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Calculator className="w-5 h-5 text-blue-400" />
          计算结果
        </h2>
        <button
          onClick={calculateGravity}
          disabled={!canCalculate || isCalculating}
          className={`px-5 py-2 rounded-xl font-medium transition-all flex items-center gap-2 ${
            canCalculate && !isCalculating
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25'
              : 'bg-slate-700 text-slate-500 cursor-not-allowed'
          }`}
        >
          {isCalculating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Calculator className="w-4 h-4" />
          )}
          {isCalculating ? '计算中...' : '开始计算'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 font-medium">计算出错</p>
            <p className="text-red-300 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {!canCalculate && !result && (
        <div className="text-center py-8 text-slate-500">
          <div className="text-4xl mb-3">🔬</div>
          <p>需要至少 2 条有效数据才能进行计算</p>
          <p className="text-xs mt-1">当前有效数据: {validDataCount} 条</p>
        </div>
      )}

      {result && (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-blue-600/20 to-indigo-600/20 rounded-xl p-6 border border-blue-500/30">
            <div className="text-center">
              <p className="text-slate-400 text-sm mb-2">当地重力加速度估算值</p>
              <div className="text-5xl font-bold text-white mb-2">
                {formatNumber(result.gravity, 3)}
                <span className="text-2xl text-slate-400 ml-2">m/s²</span>
              </div>
              <p className="text-slate-400">
                不确定度: ±{formatNumber(result.gravityUncertainty, 4)} m/s²
              </p>
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full">
                <span className="text-slate-400 text-sm">与标准值 9.80665 偏差:</span>
                <span className={`font-mono font-bold ${
                  Math.abs(result.gravity - STANDARD_GRAVITY) < 0.5
                    ? 'text-green-400'
                    : Math.abs(result.gravity - STANDARD_GRAVITY) < 1
                    ? 'text-amber-400'
                    : 'text-red-400'
                }`}>
                  {result.gravity > STANDARD_GRAVITY ? '+' : ''}
                  {formatNumber(result.gravity - STANDARD_GRAVITY, 3)}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-700/30 rounded-xl p-4 text-center">
              <p className="text-slate-400 text-xs mb-1">拟合斜率</p>
              <p className="text-xl font-bold text-white">{formatNumber(result.fitSlope, 4)}</p>
              <p className="text-slate-500 text-xs">T²/L (s²/m)</p>
            </div>
            <div className="bg-slate-700/30 rounded-xl p-4 text-center">
              <p className="text-slate-400 text-xs mb-1">拟合优度 R²</p>
              <p className={`text-xl font-bold ${
                result.rSquared > 0.99 ? 'text-green-400' :
                result.rSquared > 0.95 ? 'text-amber-400' : 'text-red-400'
              }`}>
                {formatNumber(result.rSquared, 6)}
              </p>
              <div className="flex justify-center mt-1">
                {result.rSquared > 0.99 && <CheckCircle className="w-4 h-4 text-green-400" />}
              </div>
            </div>
            <div className="bg-slate-700/30 rounded-xl p-4 text-center">
              <p className="text-slate-400 text-xs mb-1">数据点数</p>
              <p className="text-xl font-bold text-white">
                {result.validDataCount}/{result.totalDataCount}
              </p>
              <p className="text-slate-500 text-xs">有效/总数</p>
            </div>
          </div>

          {result.outliers.length > 0 && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
              <p className="text-amber-400 font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                检测到 {result.outliers.length} 个离群点
              </p>
              <p className="text-amber-300/70 text-sm mt-1">
                建议检查这些数据点，可在数据表格中选择排除后重新计算
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
