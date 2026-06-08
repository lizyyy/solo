import { useDataStore } from '@/store/useDataStore';
import { StatusBadge } from '@/components/common/StatusBadge';
import { formatDateTime } from '@/utils/csvParser';
import { Flame, TrendingUp, AlertTriangle, Calculator } from 'lucide-react';
import { DEFAULT_THRESHOLD_CONFIG, FIELD_UNITS } from '@/config/thresholds';

export function ExtremeValuesCard() {
  const { records, currentAnalysis } = useDataStore();

  if (records.length === 0 || !currentAnalysis) {
    return null;
  }

  const extremeRecords = records.filter((r) => r.dataQuality.isExtreme);

  return (
    <div className="bg-red-500/5 border-2 border-red-500/30 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
          <Flame className="w-5 h-5 text-red-400 animate-pulse" />
          极端值检测结果
        </h3>
        {extremeRecords.length > 0 ? (
          <StatusBadge type="danger">已排除 {extremeRecords.length} 条极端值</StatusBadge>
        ) : (
          <StatusBadge type="success">未检测到极端值</StatusBadge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="bg-slate-800/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3 text-sm text-slate-400">
              <Calculator className="w-4 h-4" />
              平均值对比（温度）
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">含极端值平均值</span>
                <span className="font-mono text-lg text-slate-300 line-through opacity-50">
                  {currentAnalysis.meanTemperatureWithExtremes.toFixed(1)}{FIELD_UNITS.temperature}
                </span>
              </div>
              <div className="h-px bg-slate-700" />
              <div className="flex items-center justify-between">
                <span className="text-slate-300 text-sm font-medium">排除极端值后平均值</span>
                <span className="font-mono text-xl font-bold text-emerald-400">
                  {currentAnalysis.meanTemperature.toFixed(1)}{FIELD_UNITS.temperature}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-amber-400 mt-2">
                <TrendingUp className="w-4 h-4" />
                <span>
                  差值 {(currentAnalysis.meanTemperatureWithExtremes - currentAnalysis.meanTemperature).toFixed(1)}{FIELD_UNITS.temperature}
                  ，极端值拉高了平均值
                </span>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3 text-sm text-slate-400">
              <AlertTriangle className="w-4 h-4" />
              检测算法参数
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-slate-500">标准差法</span>
                <div className="text-slate-300 font-mono">±{DEFAULT_THRESHOLD_CONFIG.extremeStdDev}σ</div>
                <div className="text-xs text-slate-500">σ = {currentAnalysis.stdDev?.toFixed(1)}</div>
              </div>
              <div>
                <span className="text-slate-500">四分位距法</span>
                <div className="text-slate-300 font-mono">{DEFAULT_THRESHOLD_CONFIG.extremeIQR}×IQR</div>
                <div className="text-xs text-slate-500">IQR = {currentAnalysis.iqr?.toFixed(1)}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="text-sm text-slate-400 mb-3">极端值明细（已从平均值计算中排除）</div>
          {extremeRecords.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {extremeRecords.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
                >
                  <div>
                    <div className="font-mono text-sm text-red-400 font-bold">
                      {record.id}
                    </div>
                    <div className="text-xs text-slate-400">
                      {formatDateTime(record.timestamp)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-xl font-bold text-red-400">
                      {record.temperature?.toFixed(1)}{FIELD_UNITS.temperature}
                    </div>
                    <div className="text-xs text-slate-500">
                      电压 {record.voltage?.toFixed(2)}{FIELD_UNITS.voltage}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <Flame className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>所有数据均在正常范围内</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
