import { useCraneStore } from '@/store'
import { DEFAULT_THRESHOLDS } from '@/types'
import { normalizeAngle, normalizeLength, normalizeTime } from '@/utils/physics'
import { Shield, ShieldAlert, ShieldCheck } from 'lucide-react'

export default function ThresholdLights() {
  const records = useCraneStore(s => s.records)
  const calculations = useCraneStore(s => s.calculations)

  if (records.length === 0) return null

  const latestRecord = records[records.length - 1]
  const latestCalc = calculations.find(c => c.recordId === latestRecord.id)

  if (!latestCalc) return null

  const angleDeg = normalizeAngle(latestRecord.swingAngle, latestRecord.swingAngleUnit)
  const intervalS = normalizeTime(latestRecord.sampleInterval, latestRecord.sampleIntervalUnit)

  const angleStatus = angleDeg > DEFAULT_THRESHOLDS.maxSwingAngle
    ? 'fail' : angleDeg > DEFAULT_THRESHOLDS.maxSwingAngle * 0.9 ? 'warn' : 'pass'
  const dampingStatus = latestCalc.dampingRatio < DEFAULT_THRESHOLDS.minDampingRatio
    ? 'fail' : 'pass'
  const intervalStatus = intervalS < DEFAULT_THRESHOLDS.minSampleInterval
    ? 'fail' : intervalS > DEFAULT_THRESHOLDS.maxSampleInterval ? 'fail' : 'pass'

  const indicators = [
    {
      label: '摆角',
      value: `${angleDeg.toFixed(2)}°`,
      status: angleStatus,
      threshold: `≤ ${DEFAULT_THRESHOLDS.maxSwingAngle}°`,
    },
    {
      label: '阻尼',
      value: `ζ=${latestCalc.dampingRatio.toFixed(4)}`,
      status: dampingStatus,
      threshold: `≥ ${DEFAULT_THRESHOLDS.minDampingRatio}`,
    },
    {
      label: '间隔',
      value: `${intervalS.toFixed(2)}s`,
      status: intervalStatus,
      threshold: `${DEFAULT_THRESHOLDS.minSampleInterval}-${DEFAULT_THRESHOLDS.maxSampleInterval}s`,
    },
  ]

  return (
    <div className="harbor-panel p-4">
      <h3 className="font-display text-base font-bold text-harbor-amber flex items-center gap-2 mb-3">
        <Shield className="w-4 h-4" />
        阈值指示灯
      </h3>
      <div className="grid grid-cols-3 gap-3">
        {indicators.map(ind => {
          const colorMap = {
            pass: 'text-harbor-green',
            warn: 'text-harbor-yellow',
            fail: 'text-harbor-red',
          }
          const bgMap = {
            pass: 'bg-harbor-green/10',
            warn: 'bg-harbor-yellow/10',
            fail: 'bg-harbor-red/10',
          }
          const IconMap = {
            pass: ShieldCheck,
            warn: ShieldAlert,
            fail: ShieldAlert,
          }
          const Icon = IconMap[ind.status]

          return (
            <div key={ind.label} className={`${bgMap[ind.status]} rounded-lg p-3 text-center`}>
              <div className={`w-6 h-6 mx-auto mb-1 rounded-full ${colorMap[ind.status]} indicator-pulse
                ${ind.status === 'pass' ? 'bg-harbor-green' : ind.status === 'warn' ? 'bg-harbor-yellow' : 'bg-harbor-red'}`}
              />
              <Icon className={`w-4 h-4 mx-auto mb-1 ${colorMap[ind.status]}`} />
              <div className="text-xs text-gray-400">{ind.label}</div>
              <div className={`font-mono text-sm font-bold ${colorMap[ind.status]}`}>{ind.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">阈值 {ind.threshold}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
