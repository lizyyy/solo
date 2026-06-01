import { useCraneStore } from '@/store'
import { normalizeAngle, normalizeLength } from '@/utils/physics'
import { Activity, Clock, TrendingDown, Waves } from 'lucide-react'

export default function CalcCards() {
  const records = useCraneStore(s => s.records)
  const calculations = useCraneStore(s => s.calculations)

  if (records.length === 0) {
    return (
      <div className="harbor-panel p-6 text-center text-gray-500">
        <Waves className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">尚未录入数据，请先录入传感器日志</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h3 className="font-display text-base font-bold text-harbor-amber flex items-center gap-2">
        <Activity className="w-4 h-4" />
        物理计算结果
      </h3>
      <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
        {records.map(record => {
          const calc = calculations.find(c => c.recordId === record.id)
          if (!calc) return null
          const angleDeg = normalizeAngle(record.swingAngle, record.swingAngleUnit)
          const ropeM = normalizeLength(record.ropeLength, record.ropeLengthUnit)
          const statusColor = record.status === 'pass'
            ? 'border-harbor-green/30'
            : record.status === 'needs_review'
            ? 'border-harbor-yellow/30'
            : 'border-harbor-red/30'

          return (
            <div key={record.id} className={`harbor-card border-l-4 ${statusColor}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs text-gray-500">{record.id.slice(0, 16)}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded
                  ${record.status === 'pass' ? 'bg-harbor-green/10 text-harbor-green'
                    : record.status === 'needs_review' ? 'bg-harbor-yellow/10 text-harbor-yellow'
                    : record.status === 'supplemented' ? 'bg-blue-400/10 text-blue-400'
                    : 'bg-harbor-red/10 text-harbor-red'
                  }`}>
                  {record.status === 'pass' ? '通过' : record.status === 'needs_review' ? '需确认' : record.status === 'supplemented' ? '已补录' : '例外'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-gray-400">周期 T</span>
                  <span className="font-mono font-semibold text-gray-200">{calc.period.toFixed(3)}s</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-gray-400">阻尼 ζ</span>
                  <span className={`font-mono font-semibold ${calc.dampingRatio < 0.05 ? 'text-harbor-red' : 'text-gray-200'}`}>
                    {calc.dampingRatio.toFixed(4)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Waves className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-gray-400">残余角</span>
                  <span className={`font-mono font-semibold ${calc.residualAngle > 3 ? 'text-harbor-red' : 'text-gray-200'}`}>
                    {calc.residualAngle.toFixed(4)}°
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-gray-400">绳长</span>
                  <span className="font-mono font-semibold text-gray-200">{ropeM.toFixed(1)}m</span>
                </div>
              </div>
              {record.caliberTag !== 'current' && (
                <div className="mt-2 text-xs text-blue-400 bg-blue-400/5 px-2 py-1 rounded">
                  口径: {record.caliberTag} | 摆角原始: {record.swingAngle}{record.swingAngleUnit} → {angleDeg.toFixed(2)}°
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
