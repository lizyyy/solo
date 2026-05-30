import { X, AlertTriangle } from 'lucide-react'
import { usePlanStore, useDataStore } from '@/stores'
import { FREQUENCY_BANDS } from '@/types'
import { formatDateTime, splToColorHex, formatNumber, ANOMALY_LABELS } from '@/utils'

interface PlanComparisonProps {
  planIds: [string, string]
  onClose: () => void
}

export default function PlanComparison({ planIds, onClose }: PlanComparisonProps) {
  const plans = usePlanStore((state) => state.plans)
  const measurements = useDataStore((state) => state.measurements)
  const anomalies = useDataStore((state) => state.anomalies)
  const seats = useDataStore((state) => state.seats)

  const planA = plans.find((p) => p.id === planIds[0])
  const planB = plans.find((p) => p.id === planIds[1])

  if (!planA || !planB) return null

  const getBandAverages = (plan: typeof planA) => {
    return FREQUENCY_BANDS.map((band) => {
      const seatIds = plan.snapshot.map((s) => s.seatId)
      const bandMeasurements = measurements.filter(
        (m) => m.frequencyBand === band && seatIds.includes(m.seatId),
      )

      if (band === plan.frequencyBand) {
        const snapshotVals = plan.snapshot.map((s) => s.splDB)
        return snapshotVals.length > 0
          ? snapshotVals.reduce((a, b) => a + b, 0) / snapshotVals.length
          : 0
      }

      return bandMeasurements.length > 0
        ? bandMeasurements.reduce((a, b) => a + b.splDB, 0) / bandMeasurements.length
        : 0
    })
  }

  const getSnapshotStats = (plan: typeof planA) => {
    const vals = plan.snapshot.map((s) => s.splDB)
    if (vals.length === 0) return { avg: 0, max: 0, min: 0 }
    return {
      avg: vals.reduce((a, b) => a + b, 0) / vals.length,
      max: Math.max(...vals),
      min: Math.min(...vals),
    }
  }

  const getPlanAnomalies = (plan: typeof planA) => {
    const seatIds = plan.snapshot.map((s) => s.seatId)
    return anomalies.filter(
      (a) =>
        seatIds.includes(a.seatId || '') ||
        (a.frequencyBand === plan.frequencyBand),
    )
  }

  const avgA = getBandAverages(planA)
  const avgB = getBandAverages(planB)
  const statsA = getSnapshotStats(planA)
  const statsB = getSnapshotStats(planB)
  const anomaliesA = getPlanAnomalies(planA)
  const anomaliesB = getPlanAnomalies(planB)

  const uniqueAnomaliesA = anomaliesA.filter(
    (a) => !anomaliesB.some((b) => b.id === a.id),
  )
  const uniqueAnomaliesB = anomaliesB.filter(
    (a) => !anomaliesA.some((b) => b.id === a.id),
  )

  const getSeatLabel = (seatId: string) => {
    const seat = seats.find((s) => s.id === seatId)
    return seat ? `${seat.rowLabel}${seat.seatNumber}` : seatId
  }

  const renderFrequencyChart = (averages: number[]) => {
    const maxVal = 105
    const minVal = 45
    const range = maxVal - minVal
    const barWidth = 14
    const gap = 4
    const height = 80

    return (
      <svg width={10 * (barWidth + gap)} height={height} className="mx-auto">
        {averages.map((val, i) => {
          const barHeight = ((val - minVal) / range) * height
          const y = height - barHeight
          return (
            <rect
              key={i}
              x={i * (barWidth + gap)}
              y={y}
              width={barWidth}
              height={barHeight}
              fill={splToColorHex(val)}
              rx={2}
            />
          )
        })}
      </svg>
    )
  }

  const renderPlanColumn = (plan: typeof planA, averages: number[], stats: typeof statsA, planAnomalies: typeof anomaliesA) => (
    <div className="glass-panel rounded-xl p-4 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display text-lg text-white">{plan.name}</h3>
          <span className="text-xs font-mono text-gray-400">{plan.frequencyBand}</span>
        </div>
        <span className="text-xs text-gray-500">{formatDateTime(plan.createdAt)}</span>
      </div>

      <div className="mb-4">
        <div className="text-xs text-gray-400 mb-2">频段响应</div>
        {renderFrequencyChart(averages)}
        <div className="flex justify-between text-[10px] font-mono text-gray-500 mt-1 px-1">
          {FREQUENCY_BANDS.map((b, i) => (
            <span key={i}>{b.replace('Hz', '').replace('kHz', 'k')}</span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-theater-border/30 rounded-lg p-2 text-center">
          <div className="text-xs text-gray-400">平均</div>
          <div className="font-mono text-white">{formatNumber(stats.avg)}</div>
        </div>
        <div className="bg-theater-border/30 rounded-lg p-2 text-center">
          <div className="text-xs text-gray-400">最大</div>
          <div className="font-mono text-theater-red">{formatNumber(stats.max)}</div>
        </div>
        <div className="bg-theater-border/30 rounded-lg p-2 text-center">
          <div className="text-xs text-gray-400">最小</div>
          <div className="font-mono text-theater-accent">{formatNumber(stats.min)}</div>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <div className="text-xs text-gray-400 mb-2">备注 ({plan.notes.length})</div>
        <div className="space-y-2 max-h-32 overflow-y-auto">
          {plan.notes.length === 0 ? (
            <div className="text-xs text-gray-500">暂无备注</div>
          ) : (
            plan.notes.map((note) => (
              <div key={note.id} className="bg-theater-border/20 rounded p-2">
                <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                  <span className="font-medium">{note.targetType === 'seat' ? '座位' : '扬声器'}</span>
                  <span className="font-mono">{getSeatLabel(note.targetId)}</span>
                </div>
                <div className="text-sm text-white">{note.content}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {planAnomalies.length > 0 && (
        <div className="mt-4 pt-4 border-t border-theater-border">
          <div className="text-xs text-gray-400 mb-2">异常 ({planAnomalies.length})</div>
          <div className="space-y-1">
            {planAnomalies.slice(0, 3).map((anomaly) => (
              <div
                key={anomaly.id}
                className={`text-xs p-1.5 rounded ${
                  anomaly.severity === 'error'
                    ? 'bg-theater-red/10 text-theater-red'
                    : 'bg-theater-orange/10 text-theater-orange'
                }`}
              >
                {ANOMALY_LABELS[anomaly.type] || anomaly.type}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="fixed inset-0 bg-theater-dark/90 z-50 flex items-center justify-center p-6 fade-in">
      <div className="w-full max-w-6xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl text-white">方案对比</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-theater-border rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {renderPlanColumn(planA, avgA, statsA, anomaliesA)}

          <div className="glass-panel rounded-xl p-4 flex flex-col">
            <h3 className="font-display text-lg text-white mb-4 text-center">差异分析</h3>

            <div className="space-y-2 mb-4">
              <div className="text-xs text-gray-400 mb-2">频段差异 (Δ dB)</div>
              {FREQUENCY_BANDS.map((band, i) => {
                const diff = avgB[i] - avgA[i]
                return (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="font-mono text-xs text-gray-500 w-16">{band}</span>
                    <span
                      className={`font-mono font-medium ${
                        diff > 0 ? 'text-theater-green' : diff < 0 ? 'text-theater-red' : 'text-gray-400'
                      }`}
                    >
                      {diff > 0 ? '+' : ''}{formatNumber(diff)}
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-theater-border/30 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-400">Δ平均</div>
                <div className={`font-mono ${
                  statsB.avg - statsA.avg > 0 ? 'text-theater-green' : 'text-theater-red'
                }`}>
                  {statsB.avg - statsA.avg > 0 ? '+' : ''}{formatNumber(statsB.avg - statsA.avg)}
                </div>
              </div>
              <div className="bg-theater-border/30 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-400">Δ最大</div>
                <div className={`font-mono ${
                  statsB.max - statsA.max > 0 ? 'text-theater-green' : 'text-theater-red'
                }`}>
                  {statsB.max - statsA.max > 0 ? '+' : ''}{formatNumber(statsB.max - statsA.max)}
                </div>
              </div>
              <div className="bg-theater-border/30 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-400">Δ最小</div>
                <div className={`font-mono ${
                  statsB.min - statsA.min > 0 ? 'text-theater-green' : 'text-theater-red'
                }`}>
                  {statsB.min - statsA.min > 0 ? '+' : ''}{formatNumber(statsB.min - statsA.min)}
                </div>
              </div>
            </div>

            {uniqueAnomaliesA.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-1 text-xs text-theater-orange mb-2">
                  <AlertTriangle className="w-3 h-3" />
                  <span>仅方案 A 存在</span>
                </div>
                <div className="space-y-1">
                  {uniqueAnomaliesA.map((a) => (
                    <div key={a.id} className="text-xs bg-theater-orange/10 text-theater-orange p-1.5 rounded">
                      {ANOMALY_LABELS[a.type]}: {a.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {uniqueAnomaliesB.length > 0 && (
              <div>
                <div className="flex items-center gap-1 text-xs text-theater-purple mb-2">
                  <AlertTriangle className="w-3 h-3" />
                  <span>仅方案 B 存在</span>
                </div>
                <div className="space-y-1">
                  {uniqueAnomaliesB.map((a) => (
                    <div key={a.id} className="text-xs bg-theater-purple/10 text-theater-purple p-1.5 rounded">
                      {ANOMALY_LABELS[a.type]}: {a.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {uniqueAnomaliesA.length === 0 && uniqueAnomaliesB.length === 0 && (
              <div className="text-center text-sm text-gray-500 py-4">
                两个方案异常情况一致
              </div>
            )}
          </div>

          {renderPlanColumn(planB, avgB, statsB, anomaliesB)}
        </div>
      </div>
    </div>
  )
}
