import useDataStore from '@/stores/dataStore'
import useSceneStore from '@/stores/sceneStore'

interface TraceData {
  title: string
  value: number
  dataSource: string
  measuredAt?: string
  seatId?: string
  frequencyBand?: string
}

interface SummaryBarProps {
  onShowTrace: (data: TraceData) => void
}

export default function SummaryBar({ onShowTrace }: SummaryBarProps) {
  const currentBand = useSceneStore((state) => state.currentBand)
  const measurements = useDataStore((state) => state.measurements)
  const seats = useDataStore((state) => state.seats)
  const anomalies = useDataStore((state) => state.anomalies)

  const bandMeasurements = measurements.filter(
    (m) => m.frequencyBand === currentBand,
  )

  const avgSpl = bandMeasurements.length > 0
    ? bandMeasurements.reduce((sum, m) => sum + m.splDB, 0) / bandMeasurements.length
    : 0

  let maxMeasurement = bandMeasurements[0]
  let minMeasurement = bandMeasurements[0]

  for (const m of bandMeasurements) {
    if (!maxMeasurement || m.splDB > maxMeasurement.splDB) maxMeasurement = m
    if (!minMeasurement || m.splDB < minMeasurement.splDB) minMeasurement = m
  }

  const maxSeat = maxMeasurement ? seats.find((s) => s.id === maxMeasurement.seatId) : null
  const minSeat = minMeasurement ? seats.find((s) => s.id === minMeasurement.seatId) : null

  const anomalyCount = anomalies.filter(
    (a) => a.frequencyBand === currentBand,
  ).length

  const stats = [
    {
      label: '平均声压',
      value: avgSpl,
      display: `${avgSpl.toFixed(1)} dB`,
      sub: '',
      dataSource: '综合计算',
      measuredAt: new Date().toISOString(),
      trace: {
        title: '平均声压级',
        value: avgSpl,
        dataSource: '综合计算',
        measuredAt: new Date().toISOString(),
        frequencyBand: currentBand,
      },
    },
    {
      label: '最大声压',
      value: maxMeasurement?.splDB ?? 0,
      display: `${(maxMeasurement?.splDB ?? 0).toFixed(1)} dB`,
      sub: maxSeat ? `${maxSeat.rowLabel}${maxSeat.seatNumber}` : '-',
      trace: maxMeasurement ? {
        title: '最大声压级',
        value: maxMeasurement.splDB,
        dataSource: maxMeasurement.dataSource,
        measuredAt: maxMeasurement.measuredAt,
        seatId: maxMeasurement.seatId,
        frequencyBand: currentBand,
      } : null,
    },
    {
      label: '最小声压',
      value: minMeasurement?.splDB ?? 0,
      display: `${(minMeasurement?.splDB ?? 0).toFixed(1)} dB`,
      sub: minSeat ? `${minSeat.rowLabel}${minSeat.seatNumber}` : '-',
      trace: minMeasurement ? {
        title: '最小声压级',
        value: minMeasurement.splDB,
        dataSource: minMeasurement.dataSource,
        measuredAt: minMeasurement.measuredAt,
        seatId: minMeasurement.seatId,
        frequencyBand: currentBand,
      } : null,
    },
    {
      label: '异常数量',
      value: anomalyCount,
      display: anomalyCount.toString(),
      sub: '',
      dataSource: '自动检测',
      trace: {
        title: '异常数量',
        value: anomalyCount,
        dataSource: '自动检测',
        measuredAt: new Date().toISOString(),
        frequencyBand: currentBand,
      },
    },
  ]

  return (
    <div className="absolute bottom-0 left-0 right-0 z-10 glass-panel border-t border-theater-border">
      <div className="flex items-center justify-around px-8 py-3">
        {stats.map((stat, index) => (
          <div key={index} className="text-center">
            <div className="text-xs text-gray-400 mb-1">{stat.label}</div>
            <div
              onClick={() => stat.trace && onShowTrace(stat.trace)}
              className="font-mono text-2xl text-white hover:text-theater-accent cursor-pointer transition-colors"
            >
              {stat.display}
            </div>
            {stat.sub && (
              <div className="text-xs text-gray-500 mt-0.5">{stat.sub}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
