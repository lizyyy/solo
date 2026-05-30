import { useFiberStore } from '@/store';
import { ANOMALY_TYPE_LABELS, ANOMALY_TYPE_DESCRIPTIONS } from '@/types';
import type { AnomalyType } from '@/types';
import { AlertTriangle, AlertCircle, TrendingDown, BarChart3, Zap } from 'lucide-react';

export default function Calculation() {
  const records = useFiberStore((s) => s.records);
  const runCalculation = useFiberStore((s) => s.runCalculation);
  const getFilteredResults = useFiberStore((s) => s.getFilteredResults);
  const getGroupedAnomalies = useFiberStore((s) => s.getGroupedAnomalies);
  const getStats = useFiberStore((s) => s.getStats);

  const results = getFilteredResults();
  const grouped = getGroupedAnomalies();
  const stats = getStats();

  const anomalyTypes: AnomalyType[] = ['unit_error', 'zero_length', 'duplicate_connector'];
  const severityConfig = {
    unit_error: { icon: AlertCircle, color: 'amber', bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-800' },
    zero_length: { icon: AlertTriangle, color: 'red', bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-800' },
    duplicate_connector: { icon: AlertCircle, color: 'orange', bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-800' },
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#1B2A4A]">损耗计算</h2>
          <p className="text-sm text-gray-500 mt-0.5">查看损耗系数计算结果与异常分段解释</p>
        </div>
        <button
          onClick={runCalculation}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#E8A838] text-[#1B2A4A] text-sm font-semibold hover:bg-[#d4962e] transition-colors shadow-sm"
        >
          <Zap size={15} />
          重新计算
        </button>
      </div>

      {results.length === 0 && records.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex items-center gap-2">
          <AlertCircle size={16} />
          数据已录入但尚未计算，请点击"重新计算"按钮
        </div>
      )}

      {records.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center text-gray-400">
          <BarChart3 size={40} className="mx-auto mb-3 opacity-30" />
          <p>请先在"数据录入"页添加测量数据</p>
        </div>
      )}

      {results.length > 0 && (
        <>
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="text-xs text-gray-500 mb-1">平均损耗</div>
              <div className="text-2xl font-bold text-[#1B2A4A]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {stats.avg}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">dB/km</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="text-xs text-gray-500 mb-1">最大损耗</div>
              <div className="text-2xl font-bold text-red-600" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {stats.max}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">dB/km</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="text-xs text-gray-500 mb-1">最小损耗</div>
              <div className="text-2xl font-bold text-emerald-600" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {stats.min}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">dB/km</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="text-xs text-gray-500 mb-1">异常率</div>
              <div className="text-2xl font-bold text-amber-600" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {stats.anomalyRate}%
              </div>
              <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                <TrendingDown size={12} />
                {stats.count} 条中 {Math.round(stats.count * stats.anomalyRate / 100)} 条异常
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-[#1B2A4A]">计算结果明细</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500">
                    <th className="px-4 py-2.5 text-left font-medium">记录ID</th>
                    <th className="px-4 py-2.5 text-right font-medium">损耗 (dB)</th>
                    <th className="px-4 py-2.5 text-right font-medium">每公里损耗 (dB/km)</th>
                    <th className="px-4 py-2.5 text-right font-medium">接头损耗 (dB)</th>
                    <th className="px-4 py-2.5 text-right font-medium">总损耗 (dB)</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2.5" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
                        {r.recordId.slice(0, 8)}
                      </td>
                      <td className="px-4 py-2.5 text-right" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        {r.lossDB === Infinity || r.lossDB === -Infinity ? '—' : r.lossDB}
                      </td>
                      <td className="px-4 py-2.5 text-right" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        {r.lossPerKm === Infinity || r.lossPerKm === -Infinity ? (
                          <span className="text-red-500">∞</span>
                        ) : (
                          r.lossPerKm
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        {r.connectorLoss}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        {r.totalLoss === Infinity || r.totalLoss === -Infinity ? '—' : r.totalLoss}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <div>
        <h3 className="text-base font-semibold text-[#1B2A4A] mb-3">异常分段展示</h3>
        <div className="grid grid-cols-3 gap-4">
          {anomalyTypes.map((type) => {
            const config = severityConfig[type];
            const items = grouped[type];
            const Icon = config.icon;
            return (
              <div key={type} className={`${config.bg} border ${config.border} rounded-xl p-4`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon size={16} className={`text-${config.color}-600`} />
                    <span className="text-sm font-semibold text-gray-800">{ANOMALY_TYPE_LABELS[type]}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${config.badge}`}>
                    {items.length}
                  </span>
                </div>
                {items.length === 0 ? (
                  <div className="text-xs text-gray-400 py-4 text-center">暂无此类异常</div>
                ) : (
                  <div className="space-y-2 mb-3">
                    {items.map((a) => (
                      <div key={a.id} className="bg-white/60 rounded-lg px-3 py-2 text-xs text-gray-700">
                        {a.message}
                      </div>
                    ))}
                  </div>
                )}
                <div className="border-t border-current/10 pt-2 mt-2">
                  <p className="text-xs text-gray-600 leading-relaxed">{ANOMALY_TYPE_DESCRIPTIONS[type]}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
